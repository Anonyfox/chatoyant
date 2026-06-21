let assert_equal_string expected actual =
  if expected <> actual then
    failwith (Printf.sprintf "expected %S, got %S" expected actual)

let assert_equal_int expected actual =
  if expected <> actual then
    failwith (Printf.sprintf "expected %d, got %d" expected actual)

let contains_substring needle text =
  let needle_len = String.length needle in
  let text_len = String.length text in
  let rec loop index =
    if needle_len = 0 then true
    else if index + needle_len > text_len then false
    else if String.sub text index needle_len = needle then true
    else loop (index + 1)
  in
  loop 0

let assert_contains needle text =
  if not (contains_substring needle text) then
    failwith (Printf.sprintf "expected %S to contain %S" text needle)

(** Structured answer returned by the shortcut smoke provider. *)
type extracted_answer = {
  answer : string; (** Concise answer text. *)
  confidence : float [@minimum 0.] [@maximum 1.]; (** Confidence from 0 to 1. *)
}
[@@deriving chatoyant]

let body_text body =
  body |> Eio.Buf_read.of_flow ~max_size:1_000_000 |> Eio.Buf_read.take_all

let with_server env handler run =
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
      ~callback:(fun _ request body ->
        let status, headers, response_body = handler request (body_text body) in
        Cohttp_eio.Server.respond_string
          ~headers:(Http.Header.of_list headers)
          ~status:(Http.Status.of_int status) ~body:response_body ())
      ()
  in
  Eio.Fiber.fork ~sw (fun () ->
      Cohttp_eio.Server.run ~stop ~on_error:raise socket server);
  Eio.Fiber.yield ();
  Fun.protect
    ~finally:(fun () -> ignore (Eio.Promise.try_resolve stop_resolver ()))
    (fun () -> run ("http://127.0.0.1:" ^ string_of_int port))

let test_http_json env =
  let seen = ref false in
  with_server env
    (fun request body ->
      seen := true;
      assert_equal_string "POST" (request |> Http.Request.meth |> Http.Method.to_string);
      assert_equal_string "/json" (Http.Request.resource request);
      let content_type =
        request |> Http.Request.headers |> fun headers -> Http.Header.get headers "content-type"
      in
      assert_equal_string "application/json" (Option.value content_type ~default:"");
      assert_contains "\"hello\":\"world\"" body;
      (200, [ ("content-type", "application/json") ], "{\"ok\":true}"))
    (fun base_url ->
      let module Http =
        (val Chatoyant.Http.make ~https:Chatoyant.Http.Disabled ~net:env#net
               ~clock:env#clock ())
      in
      let request : Http.request =
        {
          method_ = "POST";
          url = base_url ^ "/json";
          headers = [];
          body =
            Json
              (Chatoyant.Runtime.Json.Object
                 [ ("hello", Chatoyant.Runtime.Json.String "world") ]);
          timeout_ms = Some 1_000;
        }
      in
      match Http.send request with
      | Ok response ->
          assert_equal_int 200 response.status;
          assert_equal_string "{\"ok\":true}" response.body
      | Error (Timeout ms) -> failwith (Printf.sprintf "unexpected timeout after %d ms" ms)
      | Error (Network message) | Error (Invalid_response message) -> failwith message);
  if not !seen then failwith "server did not receive JSON request"

let test_http_multipart env =
  with_server env
    (fun request body ->
      let content_type =
        request |> Http.Request.headers |> fun headers -> Http.Header.get headers "content-type"
      in
      assert_contains "multipart/form-data; boundary=" (Option.value content_type ~default:"");
      assert_contains "Content-Disposition: form-data; name=\"purpose\"" body;
      assert_contains "Content-Disposition: form-data; name=\"file\"; filename=\"tiny.txt\"" body;
      assert_contains "Content-Type: text/plain" body;
      assert_contains "hello multipart" body;
      (201, [], "uploaded"))
    (fun base_url ->
      let module Http =
        (val Chatoyant.Http.make ~https:Chatoyant.Http.Disabled ~net:env#net
               ~clock:env#clock ())
      in
      let request : Http.request =
        {
          method_ = "POST";
          url = base_url ^ "/upload";
          headers = [];
          body =
            Multipart
              [
                { name = "purpose"; filename = None; content_type = None; body = "assistants" };
                {
                  name = "file";
                  filename = Some "tiny.txt";
                  content_type = Some "text/plain";
                  body = "hello multipart";
                };
              ];
          timeout_ms = Some 1_000;
        }
      in
      match Http.send request with
      | Ok response ->
          assert_equal_int 201 response.status;
          assert_equal_string "uploaded" response.body
      | Error (Timeout ms) -> failwith (Printf.sprintf "unexpected timeout after %d ms" ms)
      | Error (Network message) | Error (Invalid_response message) -> failwith message)

let test_http_get_json env =
  with_server env
    (fun request _body ->
      assert_equal_string "GET" (request |> Http.Request.meth |> Http.Method.to_string);
      assert_equal_string "/metric" (Http.Request.resource request);
      (200, [ ("content-type", "application/json") ], "{\"ok\":true,\"value\":12}"))
    (fun base_url ->
      match
        Chatoyant.Http.get_json ~https:Chatoyant.Http.Disabled ~net:env#net
          ~clock:env#clock (base_url ^ "/metric")
      with
      | Ok json -> (
          match Chatoyant.Runtime.Json.field "value" json with
          | Some (Chatoyant.Runtime.Json.Float value) -> assert_equal_int 12 (int_of_float value)
          | _ -> failwith "expected value field in JSON helper response")
      | Error (Timeout ms) -> failwith (Printf.sprintf "unexpected timeout after %d ms" ms)
      | Error (Network message) | Error (Invalid_response message) -> failwith message)

let openai_response =
  "{\"id\":\"resp_eio\",\"object\":\"response\",\"model\":\"gpt-4o-mini\",\"status\":\"completed\",\"output\":[{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":\"Eio provider ok\"}]}],\"usage\":{\"input_tokens\":5,\"output_tokens\":4,\"total_tokens\":9}}"

let test_provider_generate env =
  with_server env
    (fun request body ->
      assert_equal_string "POST" (request |> Http.Request.meth |> Http.Method.to_string);
      assert_equal_string "/responses" (Http.Request.resource request);
      assert_contains "\"model\":\"gpt-4o-mini\"" body;
      assert_contains "\"role\":\"user\"" body;
      assert_contains "\"content\":\"Hello from Eio\"" body;
      (200, [ ("content-type", "application/json") ], openai_response))
    (fun base_url ->
      let chat =
        Chatoyant.Chat.openai ~https:Chatoyant.Http.Disabled env
          ~api_key:"test-key" ~base_url ~model:"gpt-4o-mini" ()
      in
      match Chatoyant.Chat.ask "Hello from Eio" chat with
      | Ok generation ->
          assert_equal_string "Eio provider ok" generation.content;
          assert_equal_int 9 generation.usage.total_tokens;
          assert_equal_string "gpt-4o-mini" generation.model
      | Error error -> failwith (Chatoyant.Error.provider error))

let text_shortcut_response =
  "{\"id\":\"resp_text\",\"object\":\"response\",\"model\":\"gpt-4o-mini\",\"status\":\"completed\",\"output\":[{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":\"shortcut text ok\"}]}],\"usage\":{\"input_tokens\":3,\"output_tokens\":3,\"total_tokens\":6}}"

let data_shortcut_response =
  "{\"id\":\"resp_data\",\"object\":\"response\",\"model\":\"gpt-4o-mini\",\"status\":\"completed\",\"output\":[{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":\"{\\\"answer\\\":\\\"Berlin\\\",\\\"confidence\\\":0.99}\"}]}],\"usage\":{\"input_tokens\":9,\"output_tokens\":5,\"total_tokens\":14}}"

let test_top_level_shortcuts env =
  let saw_text = ref false in
  let saw_data = ref false in
  with_server env
    (fun request body ->
      assert_equal_string "POST" (request |> Http.Request.meth |> Http.Method.to_string);
      assert_equal_string "/responses" (Http.Request.resource request);
      if contains_substring "\"json_schema\"" body then (
        saw_data := true;
        assert_contains "\"name\":\"extracted_answer\"" body;
        assert_contains "\"text\":{\"format\"" body;
        assert_contains "\"additionalProperties\":false" body;
        (200, [ ("content-type", "application/json") ], data_shortcut_response))
      else (
        saw_text := true;
        assert_contains "\"content\":\"Say hi\"" body;
        (200, [ ("content-type", "application/json") ], text_shortcut_response)))
    (fun base_url ->
      let ai =
        Chatoyant.openai ~https:Chatoyant.Http.Disabled env
          ~api_key:"test-key" ~base_url ~model:"gpt-4o-mini"
      in
      (match Chatoyant.gen_text ai "Say hi" with
      | Ok text -> assert_equal_string "shortcut text ok" text
      | Error error -> failwith (Chatoyant.Error.provider error));
      (match [%chatoyant.gen_data: extracted_answer] ai "Extract the answer" with
      | Ok answer ->
          assert_equal_string "Berlin" answer.answer;
          assert_equal_int 99 (int_of_float (answer.confidence *. 100.))
      | Error error -> failwith (Chatoyant.Error.provider error));
      assert_equal_int 0 (List.length (Chatoyant.Chat.messages ai)));
  if not !saw_text then failwith "text shortcut did not hit test provider";
  if not !saw_data then failwith "data shortcut did not hit test provider"

let () =
  Eio_main.run @@ fun env ->
  test_http_json env;
  test_http_multipart env;
  test_http_get_json env;
  test_provider_generate env;
  test_top_level_shortcuts env
