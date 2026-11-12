module Json = Chatoyant.Runtime.Json
module A = Chatoyant.Provider.Anthropic
module P = Chatoyant.Provider.Provider
module Core = Chatoyant.Core

let parse text =
  match Json.parse text with Ok value -> value | Error e -> failwith e

let get name json = Option.value (Json.field name json) ~default:Json.Null

let array = function
  | Json.Array values -> values
  | _ -> failwith "expected array"

let check label expected actual = if expected <> actual then failwith label

let blocks =
  parse
    {|[{"type":"thinking","thinking":"  first\nβ  ","signature":"opaque+/==\nA","extra":{"keep":true}},
       {"type":"redacted_thinking","data":"opaque-redacted+/==","extra":[1,2]},
       {"type":"text","text":"Checking"},
       {"type":"thinking","thinking":"second","signature":"sig-B"},
       {"type":"tool_use","id":"toolu_1","name":"lookup","input":{"q":"x"}}]|}

let second_blocks =
  let values = array blocks in
  Json.Array
    (List.map
       (fun block ->
         match get "type" block with
         | Json.String "thinking" -> (
             match block with
             | Json.Object fields ->
                 Json.Object
                   (("signature", Json.String "distinct")
                   :: List.remove_assoc "signature" fields)
             | _ -> block)
         | Json.String "tool_use" ->
             parse
               {|{"type":"tool_use","id":"toolu_2","name":"lookup","input":{"q":"y"}}|}
         | _ -> block)
       values
    @ [
        parse
          {|{"type":"tool_use","id":"toolu_3","name":"lookup","input":{"q":"z"}}|};
      ])

let response content stop =
  Json.Object
    [
      ("role", Json.String "assistant");
      ("model", Json.String "claude-test-a");
      ("content", content);
      ("stop_reason", Json.String stop);
    ]

module Http = struct
  type multipart_part = {
    name : string;
    filename : string option;
    content_type : string option;
    body : string;
  }

  type body =
    | Empty
    | Text of string
    | Json of Json.t
    | Multipart of multipart_part list

  type request = {
    method_ : string;
    url : string;
    headers : (string * string) list;
    body : body;
    timeout_ms : int option;
  }

  type response = {
    status : int;
    headers : (string * string) list;
    body : string;
  }

  type error = Timeout of int | Network of string | Invalid_response of string

  let responses = ref []
  let requests = ref []

  let send (request : request) =
    let body =
      match request.body with
      | Json body -> body
      | _ -> failwith "expected JSON"
    in
    requests := !requests @ [ body ];
    match !responses with
    | [] -> failwith "unexpected HTTP request"
    | body :: rest ->
        responses := rest;
        Ok { status = 200; headers = []; body = Json.to_string body }
end

module Provider =
  A.Make_provider
    (Http)
    (struct
      let api_key = "synthetic"
      let base_url = "https://fake.invalid"
      let timeout_ms = None
      let beta_headers = []
    end)

module Clock = struct
  let now_ms () = 0
end

module Session = Core.Session.Make (Provider) (Clock)

let tool =
  Core.Tool.create ~name:"lookup" ~description:"Synthetic lookup"
    ~parameters:
      (Chatoyant.Schema.Schema.object_
         [ ("q", Chatoyant.Schema.Schema.string ()) ])
    (fun _ args -> Ok args)

let run ?options session =
  match Session.generate_with_result ?options session with
  | Ok result -> result
  | Error error -> failwith (P.error_to_string error)

let assistants request =
  get "messages" request |> array
  |> List.filter (fun message -> get "role" message = Json.String "assistant")
  |> List.map (get "content")

let final = response (parse {|[{"type":"text","text":"Done"}]|}) "end_turn"

let replay_once ?options session =
  Http.requests := [];
  Http.responses := [ final ];
  ignore (Session.user "Continue" session);
  ignore (run ?options session);
  List.hd !Http.requests

let restore session =
  match Session.stringify session |> parse |> Session.of_json with
  | Ok session ->
      ignore (Session.add_tool tool session);
      session
  | Error e -> failwith e

let test_loop () =
  Http.requests := [];
  Http.responses :=
    [ response blocks "tool_use"; response second_blocks "tool_use"; final ];
  let session = Session.create ~model:"claude-test-a" () in
  ignore (Session.system "System" session);
  ignore (Session.add_tool tool session);
  ignore (Session.user "Start" session);
  ignore (run session);
  let requests = !Http.requests in
  List.iter
    (fun request ->
      check "private replay option never reaches HTTP" None
        (Json.field "chatoyant_provider_replay" request))
    requests;
  check "second request preserves ordered blocks" [ blocks ]
    (assistants (List.nth requests 1));
  check "third request retains both turns" [ blocks; second_blocks ]
    (assistants (List.nth requests 2));
  let tool_results =
    get "messages" (List.nth requests 1)
    |> array
    |> List.concat_map (fun message -> get "content" message |> array)
    |> List.filter (fun block -> get "type" block = Json.String "tool_result")
  in
  check "matching tool result ID" [ Json.String "toolu_1" ]
    (List.map (get "tool_use_id") tool_results);
  let restored = restore session in
  List.iter
    (fun session ->
      ignore (Session.set_model "claude-test-b" session);
      let request = replay_once session in
      check "set_model" (Json.String "claude-test-b") (get "model" request);
      check "restore/clone/fork preserves thinking" blocks
        (List.hd (assistants request));
      let options =
        { Core.Options.default with model = Some "claude-test-override" }
      in
      let request = replay_once ~options session in
      check "per-call model" (Json.String "claude-test-override")
        (get "model" request);
      check "override preserves thinking" second_blocks
        (List.nth (assistants request) 1);
      ignore (Session.set_model "claude-test-a" session);
      check "switch back" blocks (List.hd (assistants (replay_once session))))
    [ restored; Session.clone session; Session.fork session ];
  let pending = Session.create () in
  ignore
    (Session.add_messages
       (List.filter
          (fun (message : Core.Message.t) -> message.content <> "Done")
          (Session.messages session))
       pending);
  check "pending history survives restore" blocks
    (List.hd (assistants (replay_once (restore pending))))

let test_legacy () =
  let session =
    match
      Session.of_json
        (parse
           {|{"model":"claude-test-a","messages":[{"role":"assistant","content":"Legacy","metadata":{},"tool_calls":[]}]}|})
    with
    | Ok session -> session
    | Error e -> failwith e
  in
  check "legacy fallback"
    [ parse {|[{"type":"text","text":"Legacy"}]|} ]
    (assistants (replay_once session));
  let message = Core.Message.assistant "Legacy" in
  check "legacy JSON shape unchanged"
    (parse
       {|{"metadata":{},"tool_calls":[],"content":"Legacy","role":"assistant"}|})
    (Core.Message.to_json message);
  check "legacy JSON unchanged" message
    (match Core.Message.of_json (Core.Message.to_json message) with
    | Ok m -> m
    | Error e -> failwith e)

let test_final_thinking () =
  let content =
    Json.Array
      (List.filter
         (fun block -> get "type" block <> Json.String "tool_use")
         (array blocks))
  in
  Http.responses := [ response content "end_turn" ];
  let session = Session.create () in
  ignore (Session.user "Think" session);
  ignore (run session);
  check "final assistant thinking survives restore" content
    (List.hd (assistants (replay_once (restore session))))

module Other_provider = struct
  let id = P.Openai
  let seen_extra = ref None

  let generate _ (options : P.options) =
    seen_extra := options.extra;
    Ok
      {
        P.content = "Other";
        reasoning_content = "";
        usage = Chatoyant.Tokens.Cost.empty_usage;
        usage_source = Chatoyant.Tokens.Cost.Unknown;
        tool_calls = [];
        finish_reason = None;
        raw = Some (response blocks "end_turn");
      }
end

module Other_session = Core.Session.Make (Other_provider) (Clock)

let test_other_provider () =
  let session = Other_session.create () in
  ignore (Other_session.user "Hello" session);
  (match Other_session.generate session with
  | Ok _ -> ()
  | Error _ -> failwith "other provider failed");
  check "other provider options unchanged" None !Other_provider.seen_extra;
  let message = List.nth (Other_session.messages session) 1 in
  check "other provider does not attach Anthropic replay" [] message.metadata

let test_unsigned () =
  let content =
    parse
      {|[{"type":"thinking","thinking":"unsigned"},{"type":"text","text":"Hello"}]|}
  in
  Http.responses := [ response content "end_turn" ];
  let session = Session.create () in
  ignore (run session);
  check "unsigned thinking never fabricates signature" content
    (List.hd (assistants (replay_once session)))

let event kind index fields =
  Json.Object
    (("type", Json.String kind)
    :: ("index", Json.Float (Float.of_int index))
    :: fields)

let test_stream () =
  let events =
    array blocks
    |> List.mapi (fun index block ->
        let kind = get "type" block in
        let start, deltas =
          if kind = Json.String "thinking" then
            let text = get "thinking" block
            and signature = get "signature" block in
            let fields = Option.get (Json.as_object block) in
            let start =
              Json.Object
                (List.map
                   (fun (key, value) ->
                     ( key,
                       if key = "thinking" || key = "signature" then
                         Json.String ""
                       else value ))
                   fields)
            in
            let split = function
              | Json.String text ->
                  let n = String.length text / 2 in
                  [
                    String.sub text 0 n;
                    String.sub text n (String.length text - n);
                  ]
              | _ -> []
            in
            let deltas name field value =
              split value
              |> List.map (fun text ->
                  Json.Object
                    [ ("type", Json.String name); (field, Json.String text) ])
            in
            ( start,
              deltas "thinking_delta" "thinking" text
              @ deltas "signature_delta" "signature" signature )
          else if kind = Json.String "tool_use" then
            ( parse
                {|{"type":"tool_use","id":"toolu_1","name":"lookup","input":{}}|},
              [
                parse {|{"type":"input_json_delta","partial_json":"{\"q\":"}|};
                parse {|{"type":"input_json_delta","partial_json":"\"x\"}"}|};
              ] )
          else (block, [])
        in
        event "content_block_start" index [ ("content_block", start) ]
        :: List.map
             (fun delta ->
               event "content_block_delta" index [ ("delta", delta) ])
             deltas
        @ [ event "content_block_stop" index [] ])
    |> List.concat
  in
  let wire =
    events
    |> List.map (fun json ->
        "event: "
        ^ Option.get (Json.as_string (get "type" json))
        ^ "\ndata: " ^ Json.to_string json ^ "\n\n")
    |> String.concat ""
  in
  let chunks =
    List.init (String.length wire) (fun i -> String.make 1 wire.[i])
  in
  let response =
    match A.response_of_stream_chunks chunks with
    | Ok r -> r
    | Error e -> failwith e
  in
  check "stream assembled full blocks" blocks
    (get "content" response.response_raw);
  check "stream reasoning projection" "  first\nβ  second"
    (A.generation_of_response response).reasoning_content;
  let frames =
    List.map
      (fun raw ->
        {
          Core.Stream.content_delta = None;
          reasoning_delta = None;
          tool_call_deltas = [];
          usage = None;
          usage_source = Chatoyant.Tokens.Cost.Unknown;
          finish_reason = None;
          raw = Some raw;
        })
      events
  in
  let session = Session.create () in
  ignore (Session.stream_accumulate frames session);
  check "stream persistence and replay" blocks
    (List.hd (assistants (replay_once (restore session))))

let () =
  test_loop ();
  test_legacy ();
  test_final_thinking ();
  test_other_provider ();
  test_unsigned ();
  test_stream ()
