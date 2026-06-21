module Json = Chatoyant.Runtime.Json
module Cost = Chatoyant.Tokens.Cost
module Ai = Chatoyant
module Chat = Ai.Chat
module Eio_http = Chatoyant.Http
module Error = Chatoyant.Error

module%tool Calculate = struct
  type operation =
    | Add
    | Subtract
    | Multiply
    | Divide

  type request = {
    operation : operation; (** Arithmetic operation to apply. *)
    values : float list [@min_items 1]; (** Numbers to combine in order. *)
  }

  type answer = {
    expression : string;
    result : float;
  }

  let symbol = function
    | Add -> " + "
    | Subtract -> " - "
    | Multiply -> " * "
    | Divide -> " / "

  let expression operation values =
    values |> List.map string_of_float |> String.concat (symbol operation)

  (** Combine numbers with add, subtract, multiply, or divide. *)
  let run : request -> (answer, string) result =
   fun { operation; values } ->
    match values with
    | [] -> Error "calculator requires at least one value"
    | first :: rest ->
        let step acc value =
          match operation with
          | Add -> Ok (acc +. value)
          | Subtract -> Ok (acc -. value)
          | Multiply -> Ok (acc *. value)
          | Divide ->
              if value = 0.0 then Error "division by zero" else Ok (acc /. value)
        in
        let rec loop acc = function
          | [] -> Ok acc
          | value :: rest -> (
              match step acc value with
              | Ok acc -> loop acc rest
              | Error _ as err -> err)
        in
        Result.map
          (fun result -> { expression = expression operation values; result })
          (loop first rest)
end

module%tool Lookup_city_metric = struct
  type ('net, 'clock) env = {
    net : 'net Eio.Net.t;
    clock : 'clock Eio.Time.clock;
    base_url : string;
  }

  type request = {
    city : string; (** City name, for example Berlin. *)
  }

  type metric = {
    city : string;
    metric : float;
    source : string;
  }

  (** Look up a city metric by making a real HTTP call from inside the tool handler. *)
  let run : ('net, 'clock) env -> request -> (metric, string) result =
   fun { net; clock; base_url } { city } ->
    let url = base_url ^ "/metric?city=" ^ Uri.pct_encode city in
    match
      Eio_http.get_json ~https:Eio_http.Disabled ~net ~clock ~timeout_ms:5_000 url
    with
    | Error error -> Error (Eio_http.error_to_string error)
    | Ok json -> metric_of_json json
end

let metric_response city =
  let normalized = String.lowercase_ascii city in
  let metric =
    match normalized with
    | "berlin" -> 1.19
    | "hamburg" -> 1.17
    | "munich" | "münchen" -> 1.21
    | _ -> 1.11
  in
  Json.Object
    [
      ("city", Json.String city);
      ("metric", Json.Float metric);
      ("source", Json.String "local-eio-http-service");
    ]
  |> Json.to_string

let with_metric_server env run =
  Eio.Switch.run @@ fun sw ->
  let stop, stop_resolver = Eio.Promise.create () in
  let socket =
    Eio.Net.listen ~sw ~backlog:5 env#net (`Tcp (Eio.Net.Ipaddr.V4.loopback, 0))
  in
  let port =
    match Eio.Net.listening_addr socket with
    | `Tcp (_, port) -> port
    | `Unix _ -> failwith "expected tcp listener"
  in
  let server =
    Cohttp_eio.Server.make
      ~callback:(fun _ request _body ->
        let uri = Uri.of_string ("http://localhost" ^ Http.Request.resource request) in
        let city = Option.value (Uri.get_query_param uri "city") ~default:"unknown" in
        let status, body =
          match Http.Request.resource request with
          | resource when String.starts_with ~prefix:"/metric" resource ->
              (`OK, metric_response city)
          | _ -> (`Not_found, "{\"error\":\"not found\"}")
        in
        Cohttp_eio.Server.respond_string
          ~headers:(Http.Header.of_list [ ("content-type", "application/json") ])
          ~status ~body ())
      ()
  in
  Eio.Fiber.fork ~sw (fun () ->
      Cohttp_eio.Server.run ~stop ~on_error:raise socket server);
  Eio.Fiber.yield ();
  Fun.protect
    ~finally:(fun () -> ignore (Eio.Promise.try_resolve stop_resolver ()))
    (fun () -> run ("http://127.0.0.1:" ^ string_of_int port))

let assert_close label expected actual =
  if Float.abs (expected -. actual) > 0.000001 then
    failwith (Printf.sprintf "%s expected %.12g, got %.12g" label expected actual)

let check_direct_tools metric_env =
  (match
     Calculate.run
       { Calculate.operation = Divide; values = [ 10.; 2. ] }
   with
  | Ok answer -> assert_close "direct calculator result" 5. answer.Calculate.result
  | Error message -> failwith ("direct calculator failed: " ^ message));
  match Lookup_city_metric.run metric_env { Lookup_city_metric.city = "Hamburg" } with
  | Ok metric ->
      assert_close "direct metric result" 1.17 metric.Lookup_city_metric.metric
  | Error message -> failwith ("direct metric lookup failed: " ^ message)

let run env =
  let model = Option.value (Sys.getenv_opt "MODEL_OPENAI") ~default:"gpt-5.4-mini" in
  with_metric_server env @@ fun metric_base_url ->
  let metric_env =
    {
      Lookup_city_metric.net = env#net;
      clock = env#clock;
      base_url = metric_base_url;
    }
  in
  let tools = [ Calculate.tool; Lookup_city_metric.make metric_env ] in
  check_direct_tools metric_env;
  let chat = Ai.openai env ~model in
  match
    Chat.ask ~tools ~timeout_ms:120_000 ~max_tokens:1_200
      ~system:
        "Use tools whenever arithmetic or city lookup is needed. For this task, call both available tools before answering. Return a concise final answer."
      "Use the calculator for 83 divided by 3. Also look up the city metric for Berlin through the HTTP-backed tool. Then use the calculator again to multiply the quotient by the metric. Show both calculations and name the metric source."
      chat
  with
  | Error error ->
      prerr_endline (Error.provider error);
      exit 1
  | Ok result ->
      let messages = Chat.messages chat in
      let assistant_tool_calls =
        List.fold_left
          (fun count message -> count + List.length message.Chatoyant.Core.Message.tool_calls)
          0 messages
      in
      let tool_results =
        messages
        |> List.filter (fun message -> message.Chatoyant.Core.Message.role = Tool)
        |> List.length
      in
      Printf.printf "model: %s\n" result.model;
      Printf.printf "iterations: %d\n" result.iterations;
      Printf.printf "assistant_tool_calls: %d\n" assistant_tool_calls;
      Printf.printf "tool_results: %d\n" tool_results;
      Printf.printf "usage_source: %s\n" (Cost.source_to_string result.usage_source);
      Printf.printf "usage: input=%d output=%d total=%d\n" result.usage.input_tokens
        result.usage.output_tokens result.usage.total_tokens;
      Printf.printf "final:\n%s\n" result.content

let () = Eio_main.run run
