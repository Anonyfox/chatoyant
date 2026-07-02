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

module Fake_http = struct
  type multipart_part = {
    name : string;
    filename : string option;
    content_type : string option;
    body : string;
  }

  type body =
    | Empty
    | Text of string
    | Json of Chatoyant.Runtime.Json.t
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

  let last_request : request option ref = ref None
  let next_response_status = ref 200

  let next_response_body =
    ref
      "{\"id\":\"resp_123\",\"object\":\"response\",\"model\":\"gpt-5.4-mini\",\"status\":\"completed\",\"output\":[{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":\"Hello \
       from \
       Responses\"}]}],\"usage\":{\"input_tokens\":7,\"output_tokens\":3,\"total_tokens\":10}}"

  let send request =
    last_request := Some request;
    Ok
      {
        status = !next_response_status;
        headers = [ ("content-type", "application/json") ];
        body = !next_response_body;
      }
end

module Client = Chatoyant.Provider.Openai.Make_client (Fake_http)

module Provider =
  Chatoyant.Provider.Openai.Make_provider
    (Fake_http)
    (struct
      let api_key = "test-key"
      let base_url = Client.default_base_url
      let timeout_ms = Some 1_000
    end)

module Fake_ws = struct
  type message = Text of string | Binary of string
  type close = { code : int; reason : string }

  type request = {
    url : string;
    headers : (string * string) list;
    protocols : string list;
    timeout_ms : int option;
  }

  type error =
    | Timeout of int
    | Network of string
    | Invalid_response of string
    | Closed of close option

  type connection = {
    incoming : message list ref;
    sent : message list ref;
    mutable closed : close option;
  }

  let last_request : request option ref = ref None
  let last_sent : message list ref = ref []
  let next_incoming = ref [ Text "{\"type\":\"session.created\"}" ]

  let with_connection request fn =
    last_request := Some request;
    let connection =
      { incoming = ref !next_incoming; sent = ref []; closed = None }
    in
    let result = fn connection in
    last_sent := List.rev !(connection.sent);
    Ok result

  let send connection message =
    connection.sent := message :: !(connection.sent);
    Ok ()

  let recv connection =
    match !(connection.incoming) with
    | [] -> Error (Closed connection.closed)
    | message :: rest ->
        connection.incoming := rest;
        Ok message

  let close ?(code = 1000) ?(reason = "") connection =
    connection.closed <- Some { code; reason };
    Ok ()
end

module Realtime = Chatoyant.Provider.Openai.Make_realtime (Fake_ws)

let schema =
  Chatoyant.Runtime.Json.Object
    [
      ("type", Chatoyant.Runtime.Json.String "object");
      ( "properties",
        Chatoyant.Runtime.Json.Object
          [
            ( "answer",
              Chatoyant.Runtime.Json.Object
                [ ("type", Chatoyant.Runtime.Json.String "string") ] );
          ] );
      ( "required",
        Chatoyant.Runtime.Json.Array [ Chatoyant.Runtime.Json.String "answer" ]
      );
      ("additionalProperties", Chatoyant.Runtime.Json.Bool false);
    ]

let function_tool =
  Chatoyant.Provider.Openai.
    {
      tool_name = "lookup";
      tool_description = Some "Lookup data";
      tool_parameters = schema;
      tool_strict = Some true;
    }

let chat_fixture () =
  Chatoyant.Provider.Openai.
    {
      chat_model = "gpt-5.4-mini";
      chat_messages =
        [
          {
            message_role = Developer;
            message_content = Some "Answer as JSON.";
            message_name = None;
            message_tool_call_id = None;
            message_tool_calls = [];
          };
          {
            message_role = User;
            message_content = Some "Hello";
            message_name = Some "tester";
            message_tool_call_id = None;
            message_tool_calls = [];
          };
        ];
      chat_stream = true;
      chat_temperature = Some 0.2;
      chat_max_tokens = Some 128;
      chat_top_p = Some 0.95;
      chat_stop = [ "END" ];
      chat_user = Some "user_123";
      chat_seed = Some 42;
      chat_logprobs = Some true;
      chat_top_logprobs = Some 2;
      chat_n = Some 1;
      chat_tools = [ function_tool ];
      chat_tool_choice = Some (Function_tool "lookup");
      chat_parallel_tool_calls = Some false;
      chat_response_format =
        Some
          (Json_schema
             {
               schema_name = "answer";
               schema_description = Some "A compact answer object";
               schema_value = schema;
               schema_strict = true;
             });
      chat_extra = [ ("service_tier", Chatoyant.Runtime.Json.String "default") ];
    }

let responses_fixture () =
  Chatoyant.Provider.Openai.
    {
      responses_model = "gpt-5.4-mini";
      responses_input =
        Input_items
          [
            Chatoyant.Runtime.Json.Object
              [
                ("role", Chatoyant.Runtime.Json.String "user");
                ("content", Chatoyant.Runtime.Json.String "Return JSON.");
              ];
          ];
      responses_instructions = Some "Be precise.";
      responses_previous_response_id = Some "resp_prev";
      responses_store = Some false;
      responses_stream = false;
      responses_temperature = Some 0.1;
      responses_top_p = Some 0.9;
      responses_max_output_tokens = Some 128;
      responses_reasoning =
        Some
          (Chatoyant.Runtime.Json.Object
             [ ("effort", Chatoyant.Runtime.Json.String "low") ]);
      responses_tools =
        [
          Chatoyant.Runtime.Json.Object
            [ ("type", Chatoyant.Runtime.Json.String "web_search_preview") ];
        ];
      responses_tool_choice = Some Auto;
      responses_text_format =
        Some
          (Responses_json_schema
             {
               response_schema_name = "answer";
               response_schema_description = Some "A compact answer object";
               response_schema_value = schema;
               response_schema_strict = true;
             });
      responses_parallel_tool_calls = Some true;
      responses_truncation = Some "disabled";
      responses_metadata = [ ("purpose", "test") ];
      responses_extra = [];
    }

let test_request_json () =
  let chat_body =
    chat_fixture () |> Chatoyant.Provider.Openai.chat_request_json
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"role\":\"developer\"" chat_body;
  assert_contains "\"tool_choice\"" chat_body;
  assert_contains "\"top_logprobs\":2" chat_body;
  assert_contains "\"service_tier\":\"default\"" chat_body;
  let responses_body =
    responses_fixture () |> Chatoyant.Provider.Openai.responses_request_json
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"previous_response_id\":\"resp_prev\"" responses_body;
  assert_contains "\"store\":false" responses_body;
  assert_contains "\"web_search_preview\"" responses_body;
  assert_contains "\"metadata\":{\"purpose\":\"test\"}" responses_body;
  assert_contains "\"reasoning\":{\"effort\":\"low\"}" responses_body

let test_response_decode () =
  let chat =
    Chatoyant.Provider.Openai.chat_response_of_json
      (Chatoyant.Runtime.Json.Object
         [
           ("id", Chatoyant.Runtime.Json.String "chat_123");
           ("model", Chatoyant.Runtime.Json.String "gpt-5.4-mini");
           ( "choices",
             Chatoyant.Runtime.Json.Array
               [
                 Chatoyant.Runtime.Json.Object
                   [
                     ( "message",
                       Chatoyant.Runtime.Json.Object
                         [
                           ("role", Chatoyant.Runtime.Json.String "assistant");
                           ("content", Chatoyant.Runtime.Json.String "Hello");
                           ( "reasoning_content",
                             Chatoyant.Runtime.Json.String "Because" );
                         ] );
                   ];
               ] );
           ( "usage",
             Chatoyant.Runtime.Json.Object
               [
                 ("prompt_tokens", Chatoyant.Runtime.Json.Float 3.0);
                 ("completion_tokens", Chatoyant.Runtime.Json.Float 4.0);
                 ("total_tokens", Chatoyant.Runtime.Json.Float 7.0);
               ] );
         ])
  in
  assert_equal_string "Hello" chat.chat_response_content;
  assert_equal_string "Because" chat.chat_response_reasoning_content;
  assert_equal_int 7 chat.chat_response_usage.total_tokens;
  let tool_call_generation =
    Chatoyant.Provider.Openai.generation_of_chat_response
      (Chatoyant.Provider.Openai.chat_response_of_json
         (Chatoyant.Runtime.Json.Object
            [
              ( "choices",
                Chatoyant.Runtime.Json.Array
                  [
                    Chatoyant.Runtime.Json.Object
                      [
                        ( "finish_reason",
                          Chatoyant.Runtime.Json.String "tool_calls" );
                        ( "message",
                          Chatoyant.Runtime.Json.Object
                            [
                              ("role", Chatoyant.Runtime.Json.String "assistant");
                              ("content", Chatoyant.Runtime.Json.Null);
                              ( "tool_calls",
                                Chatoyant.Runtime.Json.Array
                                  [
                                    Chatoyant.Runtime.Json.Object
                                      [
                                        ( "id",
                                          Chatoyant.Runtime.Json.String "call_1"
                                        );
                                        ( "type",
                                          Chatoyant.Runtime.Json.String
                                            "function" );
                                        ( "function",
                                          Chatoyant.Runtime.Json.Object
                                            [
                                              ( "name",
                                                Chatoyant.Runtime.Json.String
                                                  "lookup" );
                                              ( "arguments",
                                                Chatoyant.Runtime.Json.String
                                                  "{\"q\":\"ocaml\"}" );
                                            ] );
                                      ];
                                  ] );
                            ] );
                      ];
                  ] );
              ( "usage",
                Chatoyant.Runtime.Json.Object
                  [
                    ("prompt_tokens", Chatoyant.Runtime.Json.Float 1.0);
                    ("completion_tokens", Chatoyant.Runtime.Json.Float 1.0);
                    ("total_tokens", Chatoyant.Runtime.Json.Float 2.0);
                  ] );
            ]))
  in
  assert_equal_string "tool_calls"
    (Option.get tool_call_generation.finish_reason);
  assert_equal_int 1 (List.length tool_call_generation.tool_calls);
  assert_equal_string "lookup" (List.hd tool_call_generation.tool_calls).name;
  let response =
    Chatoyant.Provider.Openai.responses_response_of_json
      (Chatoyant.Runtime.Json.Object
         [
           ("id", Chatoyant.Runtime.Json.String "resp_123");
           ("model", Chatoyant.Runtime.Json.String "gpt-5.4-mini");
           ("status", Chatoyant.Runtime.Json.String "completed");
           ( "output",
             Chatoyant.Runtime.Json.Array
               [
                 Chatoyant.Runtime.Json.Object
                   [
                     ("type", Chatoyant.Runtime.Json.String "message");
                     ( "content",
                       Chatoyant.Runtime.Json.Array
                         [
                           Chatoyant.Runtime.Json.Object
                             [
                               ( "type",
                                 Chatoyant.Runtime.Json.String "output_text" );
                               ( "text",
                                 Chatoyant.Runtime.Json.String
                                   "Hello from Responses" );
                             ];
                         ] );
                   ];
                 Chatoyant.Runtime.Json.Object
                   [
                     ("type", Chatoyant.Runtime.Json.String "reasoning");
                     ( "summary",
                       Chatoyant.Runtime.Json.Array
                         [
                           Chatoyant.Runtime.Json.Object
                             [
                               ( "type",
                                 Chatoyant.Runtime.Json.String "summary_text" );
                               ( "text",
                                 Chatoyant.Runtime.Json.String
                                   "Reasoning summary" );
                             ];
                         ] );
                   ];
               ] );
           ( "usage",
             Chatoyant.Runtime.Json.Object
               [
                 ("input_tokens", Chatoyant.Runtime.Json.Float 10.0);
                 ( "input_tokens_details",
                   Chatoyant.Runtime.Json.Object
                     [ ("cached_tokens", Chatoyant.Runtime.Json.Float 3.0) ] );
                 ("output_tokens", Chatoyant.Runtime.Json.Float 5.0);
                 ( "output_tokens_details",
                   Chatoyant.Runtime.Json.Object
                     [ ("reasoning_tokens", Chatoyant.Runtime.Json.Float 2.0) ]
                 );
                 ("total_tokens", Chatoyant.Runtime.Json.Float 15.0);
               ] );
         ])
  in
  assert_equal_string "Hello from Responses" response.responses_output_text;
  assert_equal_string "Reasoning summary" response.responses_reasoning_text;
  assert_equal_int 3 response.responses_usage.cached_tokens;
  assert_equal_int 2 response.responses_usage.reasoning_tokens

let test_streams () =
  (match
     Chatoyant.Provider.Openai.responses_stream_events_of_chunks
       [
         "data: \
          {\"type\":\"response.output_text.delta\",\"item_id\":\"item_1\",\"output_index\":0,\"content_index\":0,\"delta\":\"Hel\"}\n\n";
         "data: \
          {\"type\":\"response.function_call_arguments.done\",\"item_id\":\"item_2\",\"output_index\":1,\"arguments\":\"{\\\"q\\\":\\\"ocaml\\\"}\"}\n\n";
         "data: \
          {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_123\",\"status\":\"completed\",\"output_text\":\"Hello\",\"usage\":{\"input_tokens\":2,\"output_tokens\":1,\"total_tokens\":3}}}\n\n";
       ]
   with
  | Error message -> failwith message
  | Ok
      [
        Chatoyant.Provider.Openai.Response_output_text_delta
          { delta = "Hel"; _ };
        Chatoyant.Provider.Openai.Response_function_call_arguments_done
          { arguments; _ };
        Chatoyant.Provider.Openai.Response_completed response;
      ] ->
      assert_contains "\"q\":\"ocaml\"" arguments;
      assert_equal_string "Hello" response.responses_output_text
  | Ok _ -> failwith "unexpected OpenAI response stream event sequence");
  (match
     Chatoyant.Provider.Openai.transcription_stream_events_of_chunks
       [
         "data: {\"type\":\"transcript.text.delta\",\"delta\":\"Hel\"}\n\n";
         "data: {\"type\":\"transcript.text.done\",\"text\":\"Hello\"}\n\n";
         "data: \
          {\"type\":\"transcript.text.segment\",\"id\":\"seg_001\",\"start\":0.0,\"end\":1.2,\"text\":\"Hello\",\"speaker\":\"agent\"}\n\n";
       ]
   with
  | Error message -> failwith message
  | Ok
      [
        Chatoyant.Provider.Openai.Transcription_text_delta
          { transcript_delta = "Hel"; _ };
        Chatoyant.Provider.Openai.Transcription_text_done
          { transcript_text = "Hello"; _ };
        Chatoyant.Provider.Openai.Transcription_text_segment
          {
            transcript_segment_speaker = Some "agent";
            transcript_segment_end = Some 1.2;
            _;
          };
      ] ->
      ()
  | Ok _ -> failwith "unexpected OpenAI transcription stream event sequence");
  (match
     Chatoyant.Provider.Openai.chat_response_of_stream_chunks
       [
         "data: \
          {\"choices\":[{\"delta\":{\"content\":\"Hel\",\"reasoning_content\":\"Be\"}}]}\n\n";
         "data: \
          {\"choices\":[{\"delta\":{\"content\":\"lo\",\"reasoning_content\":\"cause\"}}]}\n\n";
         "data: \
          {\"choices\":[{\"finish_reason\":\"stop\",\"delta\":{}}],\"usage\":{\"prompt_tokens\":2,\"completion_tokens\":1,\"total_tokens\":3}}\n\n";
         "data: [DONE]\n\n";
       ]
   with
  | Error message -> failwith message
  | Ok response ->
      assert_equal_string "Hello" response.chat_response_content;
      assert_equal_string "Because" response.chat_response_reasoning_content;
      assert_equal_int 3 response.chat_response_usage.total_tokens);
  match
    Chatoyant.Provider.Openai.response_of_stream_chunks
      [
        "data: {\"type\":\"response.output_text.delta\",\"delta\":\"Hel\"}\n\n";
        "data: \
         {\"type\":\"response.reasoning_summary_text.delta\",\"delta\":\"Because\"}\n\n";
        "data: {\"type\":\"response.output_text.delta\",\"delta\":\"lo\"}\n\n";
        "data: \
         {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\",\"output_text\":\"Hello\",\"usage\":{\"input_tokens\":2,\"output_tokens\":1,\"total_tokens\":3}}}\n\n";
      ]
  with
  | Error message -> failwith message
  | Ok response ->
      assert_equal_string "Hello" response.responses_output_text;
      assert_equal_string "Because" response.responses_reasoning_text;
      assert_equal_int 3 response.responses_usage.total_tokens

let test_realtime_websocket () =
  let url = Chatoyant.Provider.Openai.realtime_url ~model:"gpt-realtime" () in
  assert_contains "wss://api.openai.com/v1/realtime?model=gpt-realtime" url;
  let config =
    Chatoyant.Provider.Openai.
      {
        realtime_api_key = "openai-key";
        realtime_model = "gpt-realtime";
        realtime_base_url = Realtime.default_base_url;
        realtime_timeout_ms = Some 1_000;
        realtime_headers = [ ("X-Test", "yes") ];
        realtime_safety_identifier = Some "safe-user";
      }
  in
  (match
     Realtime.connect config (fun connection ->
         let event = Realtime.receive_json connection in
         let () =
           match event with
           | Error error -> failwith error.error_message
           | Ok json ->
               assert_equal_string "session.created"
                 (Option.get
                    (Option.bind
                       (Chatoyant.Runtime.Json.field "type" json)
                       Chatoyant.Runtime.Json.as_string))
         in
         match
           Realtime.send_json connection
             (Chatoyant.Runtime.Json.Object
                [ ("type", Chatoyant.Runtime.Json.String "response.create") ])
         with
         | Error error -> failwith error.error_message
         | Ok () -> ())
   with
  | Error error -> failwith error.error_message
  | Ok () -> ());
  (match !Fake_ws.last_request with
  | None -> failwith "expected OpenAI realtime websocket request"
  | Some request ->
      assert_contains "model=gpt-realtime" request.url;
      if not (List.mem ("Authorization", "Bearer openai-key") request.headers)
      then failwith "missing realtime authorization";
      if
        not (List.mem ("OpenAI-Safety-Identifier", "safe-user") request.headers)
      then failwith "missing realtime safety identifier";
      if not (List.mem ("X-Test", "yes") request.headers) then
        failwith "missing realtime custom header");
  match !Fake_ws.last_sent with
  | [ Fake_ws.Text text ] -> assert_contains "\"response.create\"" text
  | _ -> failwith "expected sent realtime JSON frame"

let test_client_realtime_bootstrap () =
  let config =
    Client.
      {
        api_key = "test-key";
        base_url = default_base_url;
        timeout_ms = Some 1_000;
      }
  in
  let session =
    Chatoyant.Runtime.Json.Object
      [
        ("type", Chatoyant.Runtime.Json.String "realtime");
        ("model", Chatoyant.Runtime.Json.String "gpt-realtime-2");
      ]
  in
  let secret_body =
    Chatoyant.Provider.Openai.realtime_client_secret_request_json
      {
        realtime_client_secret_session = session;
        realtime_client_secret_extra = [];
      }
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"session\"" secret_body;
  Fake_http.next_response_body :=
    "{\"client_secret\":{\"value\":\"ek_123\",\"expires_at\":1800000000}}";
  (match
     Client.create_realtime_client_secret ~safety_identifier:"safe-user" config
       {
         realtime_client_secret_session = session;
         realtime_client_secret_extra = [];
       }
   with
  | Error error -> failwith error.error_message
  | Ok secret ->
      assert_equal_string "ek_123"
        (Option.get secret.realtime_client_secret_value));
  (match !Fake_http.last_request with
  | Some request -> (
      assert_contains "/realtime/client_secrets" request.url;
      if
        not (List.mem ("OpenAI-Safety-Identifier", "safe-user") request.headers)
      then failwith "missing OpenAI realtime safety identifier";
      match request.body with
      | Json json ->
          assert_contains "\"gpt-realtime-2\""
            (Chatoyant.Runtime.Json.to_string json)
      | _ -> failwith "expected realtime client secret JSON body")
  | None -> failwith "expected realtime client secret request");
  Fake_http.next_response_body := "v=0\r\ns=openai-answer\r\n";
  (match
     Client.create_realtime_call config
       {
         realtime_call_sdp = "v=0\r\ns=offer\r\n";
         realtime_call_session = session;
         realtime_call_extra = [ ("metadata", "demo") ];
       }
   with
  | Error error -> failwith error.error_message
  | Ok answer -> assert_contains "openai-answer" answer);
  match !Fake_http.last_request with
  | Some request -> (
      assert_contains "/realtime/calls" request.url;
      match request.body with
      | Multipart parts ->
          if not (List.exists (fun part -> part.Fake_http.name = "sdp") parts)
          then failwith "missing realtime SDP multipart part";
          if
            not
              (List.exists (fun part -> part.Fake_http.name = "session") parts)
          then failwith "missing realtime session multipart part"
      | _ -> failwith "expected realtime call multipart body")
  | None -> failwith "expected realtime call request"

let test_other_decoders () =
  let image =
    Chatoyant.Provider.Openai.image_response_of_json
      (Chatoyant.Runtime.Json.Object
         [
           ("created", Chatoyant.Runtime.Json.Float 1_700_000_000.0);
           ( "data",
             Chatoyant.Runtime.Json.Array
               [
                 Chatoyant.Runtime.Json.Object
                   [
                     ("b64_json", Chatoyant.Runtime.Json.String "abc");
                     ( "revised_prompt",
                       Chatoyant.Runtime.Json.String "A revised prompt" );
                   ];
               ] );
         ])
  in
  assert_equal_int 1 (List.length image.image_data);
  assert_equal_string "abc"
    (Option.get (List.hd image.image_data).image_b64_json);
  let embedding =
    Chatoyant.Provider.Openai.embedding_response_of_json
      (Chatoyant.Runtime.Json.Object
         [
           ("model", Chatoyant.Runtime.Json.String "text-embedding-3-small");
           ( "data",
             Chatoyant.Runtime.Json.Array
               [
                 Chatoyant.Runtime.Json.Object
                   [
                     ("index", Chatoyant.Runtime.Json.Float 0.0);
                     ( "embedding",
                       Chatoyant.Runtime.Json.Array
                         [
                           Chatoyant.Runtime.Json.Float 0.1;
                           Chatoyant.Runtime.Json.Float 0.2;
                         ] );
                   ];
               ] );
           ( "usage",
             Chatoyant.Runtime.Json.Object
               [
                 ("prompt_tokens", Chatoyant.Runtime.Json.Float 2.0);
                 ("total_tokens", Chatoyant.Runtime.Json.Float 2.0);
               ] );
         ])
  in
  assert_equal_int 1 (List.length embedding.embedding_data);
  assert_equal_int 2 embedding.embedding_usage.total_tokens;
  let models =
    Chatoyant.Provider.Openai.model_list_of_json
      (Chatoyant.Runtime.Json.Object
         [
           ( "data",
             Chatoyant.Runtime.Json.Array
               [
                 Chatoyant.Runtime.Json.Object
                   [
                     ("id", Chatoyant.Runtime.Json.String "gpt-5.4-mini");
                     ("object", Chatoyant.Runtime.Json.String "model");
                     ("created", Chatoyant.Runtime.Json.Float 1_700_000_000.0);
                     ("owned_by", Chatoyant.Runtime.Json.String "openai");
                   ];
               ] );
         ])
  in
  assert_equal_int 1 (List.length models.models);
  assert_equal_string "gpt-5.4-mini"
    (Option.get (List.hd models.models).model_id)

let test_moderation_and_batches () =
  let moderation_body =
    Chatoyant.Provider.Openai.moderation_request_json
      {
        moderation_model = Some "omni-moderation-latest";
        moderation_input = Moderation_texts [ "hello"; "bad" ];
        moderation_extra = [];
      }
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"model\":\"omni-moderation-latest\"" moderation_body;
  assert_contains "\"input\":[\"hello\",\"bad\"]" moderation_body;
  let moderation =
    Chatoyant.Provider.Openai.moderation_response_of_json
      (Chatoyant.Runtime.Json.Object
         [
           ("id", Chatoyant.Runtime.Json.String "modr_123");
           ("model", Chatoyant.Runtime.Json.String "omni-moderation-latest");
           ( "results",
             Chatoyant.Runtime.Json.Array
               [
                 Chatoyant.Runtime.Json.Object
                   [
                     ("flagged", Chatoyant.Runtime.Json.Bool true);
                     ("categories", Chatoyant.Runtime.Json.Object []);
                     ("category_scores", Chatoyant.Runtime.Json.Object []);
                   ];
               ] );
         ])
  in
  assert_equal_int 1 (List.length moderation.moderation_results);
  if not (List.hd moderation.moderation_results).moderation_flagged then
    failwith "expected flagged moderation result";
  let batch_body =
    Chatoyant.Provider.Openai.batch_create_request_json
      {
        batch_input_file_id = "file_123";
        batch_endpoint = "/v1/responses";
        batch_completion_window = "24h";
        batch_metadata = [ ("purpose", "test") ];
        batch_extra = [];
      }
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"input_file_id\":\"file_123\"" batch_body;
  assert_contains "\"metadata\":{\"purpose\":\"test\"}" batch_body;
  let batch =
    Chatoyant.Provider.Openai.batch_of_json
      (Chatoyant.Runtime.Json.Object
         [
           ("id", Chatoyant.Runtime.Json.String "batch_123");
           ("object", Chatoyant.Runtime.Json.String "batch");
           ("endpoint", Chatoyant.Runtime.Json.String "/v1/responses");
           ("input_file_id", Chatoyant.Runtime.Json.String "file_123");
           ("completion_window", Chatoyant.Runtime.Json.String "24h");
           ("status", Chatoyant.Runtime.Json.String "completed");
           ("output_file_id", Chatoyant.Runtime.Json.String "file_out");
           ("created_at", Chatoyant.Runtime.Json.Float 1_700_000_000.0);
           ( "request_counts",
             Chatoyant.Runtime.Json.Object
               [
                 ("total", Chatoyant.Runtime.Json.Float 10.0);
                 ("completed", Chatoyant.Runtime.Json.Float 9.0);
                 ("failed", Chatoyant.Runtime.Json.Float 1.0);
               ] );
         ])
  in
  assert_equal_string "batch_123" (Option.get batch.batch_id);
  assert_equal_int 10 (Option.get batch.batch_request_counts).total;
  let batches =
    Chatoyant.Provider.Openai.batch_list_of_json
      (Chatoyant.Runtime.Json.Object
         [
           ( "data",
             Chatoyant.Runtime.Json.Array
               [
                 Chatoyant.Runtime.Json.Object
                   [
                     ("id", Chatoyant.Runtime.Json.String "batch_123");
                     ("status", Chatoyant.Runtime.Json.String "completed");
                   ];
               ] );
           ("has_more", Chatoyant.Runtime.Json.Bool false);
         ])
  in
  assert_equal_int 1 (List.length batches.batches)

let test_files () =
  let file =
    Chatoyant.Provider.Openai.file_object_of_json
      (Chatoyant.Runtime.Json.Object
         [
           ("id", Chatoyant.Runtime.Json.String "file_123");
           ("object", Chatoyant.Runtime.Json.String "file");
           ("bytes", Chatoyant.Runtime.Json.Float 12.0);
           ("created_at", Chatoyant.Runtime.Json.Float 1_700_000_000.0);
           ("filename", Chatoyant.Runtime.Json.String "input.jsonl");
           ("purpose", Chatoyant.Runtime.Json.String "batch");
         ])
  in
  assert_equal_string "file_123" (Option.get file.file_id);
  assert_equal_string "batch" (Option.get file.file_purpose);
  let files =
    Chatoyant.Provider.Openai.file_list_of_json
      (Chatoyant.Runtime.Json.Object
         [
           ( "data",
             Chatoyant.Runtime.Json.Array
               [
                 Chatoyant.Runtime.Json.Object
                   [
                     ("id", Chatoyant.Runtime.Json.String "file_123");
                     ("object", Chatoyant.Runtime.Json.String "file");
                   ];
               ] );
           ("has_more", Chatoyant.Runtime.Json.Bool false);
         ])
  in
  assert_equal_int 1 (List.length files.files);
  let deleted =
    Chatoyant.Provider.Openai.file_delete_of_json
      (Chatoyant.Runtime.Json.Object
         [
           ("id", Chatoyant.Runtime.Json.String "file_123");
           ("deleted", Chatoyant.Runtime.Json.Bool true);
         ])
  in
  if not deleted.deleted then failwith "expected OpenAI deleted file"

let test_client_and_provider () =
  let config =
    Client.
      {
        api_key = "test-key";
        base_url = default_base_url;
        timeout_ms = Some 1_000;
      }
  in
  Fake_http.next_response_status := 200;
  Fake_http.next_response_body :=
    "{\"id\":\"resp_123\",\"object\":\"response\",\"model\":\"gpt-5.4-mini\",\"status\":\"completed\",\"output\":[{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":\"Hello \
     from \
     Responses\"}]}],\"usage\":{\"input_tokens\":7,\"output_tokens\":3,\"total_tokens\":10}}";
  (match Client.create_response config (responses_fixture ()) with
  | Error error -> failwith error.error_message
  | Ok response ->
      assert_equal_string "Hello from Responses" response.responses_output_text);
  (match !Fake_http.last_request with
  | None -> failwith "expected captured OpenAI request"
  | Some request ->
      assert_equal_string "POST" request.method_;
      assert_contains "/responses" request.url;
      if not (List.mem ("Authorization", "Bearer test-key") request.headers)
      then failwith "missing authorization header");
  Fake_http.next_response_status := 400;
  Fake_http.next_response_body :=
    "{\"error\":{\"type\":\"invalid_request_error\",\"message\":\"bad \
     request\",\"code\":\"bad\",\"param\":\"input\"}}";
  (match Client.create_response config (responses_fixture ()) with
  | Ok _ -> failwith "expected OpenAI client error"
  | Error error ->
      assert_contains "bad request" error.error_message;
      assert_equal_string "bad" (Option.get error.error_code));
  Fake_http.next_response_status := 200;
  Fake_http.next_response_body :=
    "{\"id\":\"resp_123\",\"object\":\"response\",\"model\":\"gpt-5.4-mini\",\"status\":\"completed\",\"output\":[{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":\"Hello \
     from \
     Responses\"}]}],\"usage\":{\"input_tokens\":7,\"output_tokens\":3,\"total_tokens\":10}}";
  (match
     Provider.generate
       [
         {
           Chatoyant.Provider.Provider.role = Chatoyant.Provider.Provider.User;
           content = Some "Hello";
           name = None;
           tool_call_id = None;
           tool_calls = [];
           tool_result_error = None;
         };
       ]
       {
         Chatoyant.Provider.Provider.model = "gpt-5.4-mini";
         temperature = None;
         max_tokens = Some 64;
         top_p = None;
         stop = [];
         frequency_penalty = None;
         presence_penalty = None;
         web_search = None;
         thinking_budget = None;
         reasoning_effort = None;
         timeout_ms = Some 1_000;
         tools = [];
         tool_choice = None;
         extra = None;
       }
   with
  | Error _ -> failwith "OpenAI provider adapter failed"
  | Ok generation ->
      assert_equal_string "Hello from Responses" generation.content);
  let loose_tool_schema =
    Chatoyant.Schema.Schema.(
      object_ [ ("q", string ()); ("limit", integer ~optional:true ()) ]
      |> to_json_schema)
  in
  (match
     Provider.generate
       [
         {
           Chatoyant.Provider.Provider.role = Chatoyant.Provider.Provider.User;
           content = Some "Use the lookup tool";
           name = None;
           tool_call_id = None;
           tool_calls = [];
           tool_result_error = None;
         };
       ]
       {
         Chatoyant.Provider.Provider.model = "gpt-5.4-mini";
         temperature = None;
         max_tokens = Some 64;
         top_p = Some 0.5;
         stop = [ "END" ];
         frequency_penalty = Some 0.1;
         presence_penalty = Some 0.2;
         web_search = None;
         thinking_budget = None;
         reasoning_effort = Some "low";
         timeout_ms = Some 1_000;
         tools =
           [
             {
               Chatoyant.Provider.Provider.tool_name = "lookup";
               tool_description = Some "Lookup data";
               tool_parameters = loose_tool_schema;
               tool_strict = Some true;
             };
           ];
         tool_choice = None;
         extra = None;
       }
   with
  | Error _ -> failwith "OpenAI provider adapter with strict tool schema failed"
  | Ok _ -> ());
  (match !Fake_http.last_request with
  | Some { body = Json json; _ } ->
      let body = Chatoyant.Runtime.Json.to_string json in
      assert_contains "\"additionalProperties\":false" body;
      assert_contains "\"required\":[\"q\",\"limit\"]" body;
      assert_contains "\"top_p\":0.5" body;
      assert_contains "\"stop\":[\"END\"]" body;
      assert_contains "\"frequency_penalty\":0.1" body;
      assert_contains "\"presence_penalty\":0.2" body;
      assert_contains "\"reasoning\":{\"effort\":\"low\"}" body
  | _ ->
      failwith "expected JSON OpenAI provider request with strict tool schema");
  Fake_http.next_response_body :=
    "{\"object\":\"list\",\"data\":[{\"id\":\"gpt-5.4-mini\",\"object\":\"model\",\"created\":1700000000,\"owned_by\":\"openai\"}]}";
  match Client.list_models config with
  | Error error -> failwith error.error_message
  | Ok list ->
      assert_equal_string "gpt-5.4-mini"
        (Option.get (List.hd list.models).model_id)

let test_client_responses_and_conversations () =
  let config =
    Client.
      {
        api_key = "test-key";
        base_url = default_base_url;
        timeout_ms = Some 1_000;
      }
  in
  Fake_http.next_response_status := 200;
  Fake_http.next_response_body :=
    "{\"object\":\"list\",\"data\":[{\"id\":\"msg_abc\",\"type\":\"message\"}],\"first_id\":\"msg_abc\",\"last_id\":\"msg_abc\",\"has_more\":false}";
  (match Client.list_response_input_items config ~response_id:"resp_123" with
  | Error error -> failwith error.error_message
  | Ok items -> assert_equal_int 1 (List.length items.api_list_data));
  (match !Fake_http.last_request with
  | Some request ->
      assert_equal_string "GET" request.method_;
      assert_contains "/responses/resp_123/input_items" request.url
  | None -> failwith "expected response input items request");
  Fake_http.next_response_body :=
    "{\"object\":\"response.input_tokens\",\"input_tokens\":11}";
  (match Client.count_response_input_tokens config (responses_fixture ()) with
  | Error error -> failwith error.error_message
  | Ok count -> assert_equal_int 11 count.response_input_tokens);
  (match !Fake_http.last_request with
  | Some request -> (
      assert_equal_string "POST" request.method_;
      assert_contains "/responses/input_tokens" request.url;
      match request.body with
      | Json json ->
          let body = Chatoyant.Runtime.Json.to_string json in
          assert_contains "\"model\":\"gpt-5.4-mini\"" body;
          if contains_substring "\"stream\"" body then
            failwith "count input tokens body should not include stream"
      | _ -> failwith "expected count input tokens JSON body")
  | None -> failwith "expected response token count request");
  Fake_http.next_response_body :=
    "{\"id\":\"conv_123\",\"object\":\"conversation\",\"created_at\":1741900000,\"metadata\":{\"topic\":\"demo\"}}";
  let conversation_body =
    Chatoyant.Runtime.Json.Object
      [
        ( "metadata",
          Chatoyant.Runtime.Json.Object
            [ ("topic", Chatoyant.Runtime.Json.String "demo") ] );
      ]
  in
  (match Client.create_conversation config conversation_body with
  | Error error -> failwith error.error_message
  | Ok conversation ->
      assert_equal_string "conv_123" (Option.get conversation.api_object_id));
  (match !Fake_http.last_request with
  | Some request ->
      assert_equal_string "POST" request.method_;
      assert_contains "/conversations" request.url
  | None -> failwith "expected conversation create request");
  (match Client.retrieve_conversation config ~conversation_id:"conv_123" with
  | Error error -> failwith error.error_message
  | Ok conversation ->
      assert_equal_string "conversation"
        (Option.get conversation.api_object_type));
  (match !Fake_http.last_request with
  | Some request ->
      assert_equal_string "GET" request.method_;
      assert_contains "/conversations/conv_123" request.url
  | None -> failwith "expected conversation retrieve request");
  (match
     Client.update_conversation config ~conversation_id:"conv_123"
       conversation_body
   with
  | Error error -> failwith error.error_message
  | Ok conversation ->
      assert_equal_string "conv_123" (Option.get conversation.api_object_id));
  (match !Fake_http.last_request with
  | Some request ->
      assert_equal_string "POST" request.method_;
      assert_contains "/conversations/conv_123" request.url
  | None -> failwith "expected conversation update request");
  Fake_http.next_response_body :=
    "{\"object\":\"list\",\"data\":[{\"id\":\"msg_abc\",\"type\":\"message\"}],\"first_id\":\"msg_abc\",\"last_id\":\"msg_abc\",\"has_more\":false}";
  let items_body =
    Chatoyant.Runtime.Json.Object
      [
        ( "items",
          Chatoyant.Runtime.Json.Array
            [
              Chatoyant.Runtime.Json.Object
                [
                  ("type", Chatoyant.Runtime.Json.String "message");
                  ("role", Chatoyant.Runtime.Json.String "user");
                  ("content", Chatoyant.Runtime.Json.String "Hello");
                ];
            ] );
      ]
  in
  (match
     Client.create_conversation_items config ~conversation_id:"conv_123"
       items_body
   with
  | Error error -> failwith error.error_message
  | Ok items ->
      assert_equal_string "msg_abc"
        (Option.get (List.hd items.api_list_data).api_object_id));
  (match !Fake_http.last_request with
  | Some request ->
      assert_equal_string "POST" request.method_;
      assert_contains "/conversations/conv_123/items" request.url
  | None -> failwith "expected conversation item create request");
  Fake_http.next_response_body :=
    "{\"id\":\"msg_abc\",\"type\":\"message\",\"status\":\"completed\",\"role\":\"user\"}";
  (match
     Client.retrieve_conversation_item config ~conversation_id:"conv_123"
       ~item_id:"msg_abc"
   with
  | Error error -> failwith error.error_message
  | Ok item -> assert_equal_string "msg_abc" (Option.get item.api_object_id));
  (match !Fake_http.last_request with
  | Some request ->
      assert_equal_string "GET" request.method_;
      assert_contains "/conversations/conv_123/items/msg_abc" request.url
  | None -> failwith "expected conversation item retrieve request");
  Fake_http.next_response_body :=
    "{\"object\":\"list\",\"data\":[{\"id\":\"msg_abc\",\"type\":\"message\"}],\"first_id\":\"msg_abc\",\"last_id\":\"msg_abc\",\"has_more\":false}";
  (match Client.list_conversation_items config ~conversation_id:"conv_123" with
  | Error error -> failwith error.error_message
  | Ok items -> assert_equal_int 1 (List.length items.api_list_data));
  Fake_http.next_response_body :=
    "{\"id\":\"conv_123\",\"object\":\"conversation\",\"created_at\":1741900000}";
  (match
     Client.delete_conversation_item config ~conversation_id:"conv_123"
       ~item_id:"msg_abc"
   with
  | Error error -> failwith error.error_message
  | Ok conversation ->
      assert_equal_string "conv_123" (Option.get conversation.api_object_id));
  Fake_http.next_response_body :=
    "{\"id\":\"conv_123\",\"object\":\"conversation.deleted\",\"deleted\":true}";
  match Client.delete_conversation config ~conversation_id:"conv_123" with
  | Error error -> failwith error.error_message
  | Ok deleted ->
      assert_equal_string "conv_123" (Option.get deleted.api_delete_id);
      if not deleted.api_delete_deleted then
        failwith "expected deleted conversation"

let test_client_moderation_and_batches () =
  let config =
    Client.
      {
        api_key = "test-key";
        base_url = default_base_url;
        timeout_ms = Some 1_000;
      }
  in
  Fake_http.next_response_status := 200;
  Fake_http.next_response_body :=
    "{\"id\":\"modr_123\",\"model\":\"omni-moderation-latest\",\"results\":[{\"flagged\":false,\"categories\":{},\"category_scores\":{}}]}";
  (match
     Client.create_moderation config
       {
         moderation_model = None;
         moderation_input = Moderation_text "hello";
         moderation_extra = [];
       }
   with
  | Error error -> failwith error.error_message
  | Ok response -> assert_equal_int 1 (List.length response.moderation_results));
  (match !Fake_http.last_request with
  | Some request ->
      assert_equal_string "POST" request.method_;
      assert_contains "/moderations" request.url
  | None -> failwith "expected moderation request");
  Fake_http.next_response_body :=
    "{\"id\":\"batch_123\",\"object\":\"batch\",\"endpoint\":\"/v1/responses\",\"input_file_id\":\"file_123\",\"completion_window\":\"24h\",\"status\":\"validating\",\"created_at\":1700000000}";
  (match
     Client.create_batch config
       {
         batch_input_file_id = "file_123";
         batch_endpoint = "/v1/responses";
         batch_completion_window = "24h";
         batch_metadata = [];
         batch_extra = [];
       }
   with
  | Error error -> failwith error.error_message
  | Ok batch -> assert_equal_string "batch_123" (Option.get batch.batch_id));
  (match !Fake_http.last_request with
  | Some request ->
      assert_equal_string "POST" request.method_;
      assert_contains "/batches" request.url
  | None -> failwith "expected batch request");
  Fake_http.next_response_body :=
    "{\"data\":[{\"id\":\"batch_123\",\"status\":\"completed\"}],\"has_more\":false}";
  match Client.list_batches config with
  | Error error -> failwith error.error_message
  | Ok list -> assert_equal_int 1 (List.length list.batches)

let test_client_files () =
  let config =
    Client.
      {
        api_key = "test-key";
        base_url = default_base_url;
        timeout_ms = Some 1_000;
      }
  in
  Fake_http.next_response_status := 200;
  Fake_http.next_response_body :=
    "{\"id\":\"file_123\",\"object\":\"file\",\"bytes\":12,\"created_at\":1700000000,\"filename\":\"input.jsonl\",\"purpose\":\"batch\"}";
  (match
     Client.upload_file config
       {
         file_filename = "input.jsonl";
         file_content_type = Some "application/jsonl";
         file_body = "{}\n";
         file_purpose = "batch";
       }
   with
  | Error error -> failwith error.error_message
  | Ok file -> assert_equal_string "file_123" (Option.get file.file_id));
  (match !Fake_http.last_request with
  | Some request -> (
      assert_equal_string "POST" request.method_;
      assert_contains "/files" request.url;
      match request.body with
      | Multipart parts ->
          assert_equal_int 2 (List.length parts);
          if
            not
              (List.exists
                 (fun part ->
                   part.Fake_http.name = "purpose" && part.body = "batch")
                 parts)
          then failwith "missing purpose multipart part"
      | _ -> failwith "expected OpenAI multipart file upload")
  | None -> failwith "expected file upload request");
  Fake_http.next_response_body :=
    "{\"data\":[{\"id\":\"file_123\",\"object\":\"file\"}],\"has_more\":false}";
  (match Client.list_files config with
  | Error error -> failwith error.error_message
  | Ok files -> assert_equal_int 1 (List.length files.files));
  Fake_http.next_response_body := "downloaded body";
  match Client.download_file config ~file_id:"file_123" with
  | Error error -> failwith error.error_message
  | Ok body -> assert_equal_string "downloaded body" body

let png_part =
  Chatoyant.Provider.Openai.
    {
      upload_filename = "image.png";
      upload_content_type = Some "image/png";
      upload_body = "\137PNG";
    }

let wav_part =
  Chatoyant.Provider.Openai.
    {
      upload_filename = "speech.wav";
      upload_content_type = Some "audio/wav";
      upload_body = "RIFF";
    }

let test_media_vector_and_fine_tuning_json () =
  let speech_body =
    Chatoyant.Provider.Openai.
      {
        speech_model = "gpt-4o-mini-tts";
        speech_input = "hello";
        speech_voice = "alloy";
        speech_response_format = Some "mp3";
        speech_speed = Some 1.1;
        speech_instructions = Some "calm";
        speech_extra = [];
      }
    |> Chatoyant.Provider.Openai.speech_request_json
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"voice\":\"alloy\"" speech_body;
  let vector_body =
    Chatoyant.Provider.Openai.
      {
        vector_store_name = Some "docs";
        vector_store_file_ids = [ "file_123" ];
        vector_store_expires_after =
          Some
            (Chatoyant.Runtime.Json.Object
               [
                 ("anchor", Chatoyant.Runtime.Json.String "last_active_at");
                 ("days", Chatoyant.Runtime.Json.Float 7.0);
               ]);
        vector_store_metadata = [ ("team", "sdk") ];
        vector_store_extra = [];
      }
    |> Chatoyant.Provider.Openai.vector_store_request_json
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"file_ids\":[\"file_123\"]" vector_body;
  assert_contains "\"metadata\":{\"team\":\"sdk\"}" vector_body;
  let fine_tuning_body =
    Chatoyant.Provider.Openai.
      {
        fine_tuning_model = "gpt-4.1-mini";
        fine_tuning_training_file = "file_train";
        fine_tuning_validation_file = Some "file_valid";
        fine_tuning_suffix = Some "demo";
        fine_tuning_hyperparameters =
          Some
            (Chatoyant.Runtime.Json.Object
               [ ("n_epochs", Chatoyant.Runtime.Json.Float 2.0) ]);
        fine_tuning_integrations = [];
        fine_tuning_seed = Some 42;
        fine_tuning_extra = [];
      }
    |> Chatoyant.Provider.Openai.fine_tuning_job_request_json
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"training_file\":\"file_train\"" fine_tuning_body;
  assert_contains "\"seed\":42" fine_tuning_body

let test_client_media () =
  let config =
    Client.
      {
        api_key = "test-key";
        base_url = default_base_url;
        timeout_ms = Some 1_000;
      }
  in
  Fake_http.next_response_status := 200;
  Fake_http.next_response_body :=
    "{\"created\":1700000000,\"data\":[{\"b64_json\":\"abc\",\"revised_prompt\":\"edited\"}]}";
  (match
     Client.edit_image config
       {
         edit_model = "gpt-image-1";
         edit_prompt = "make it blue";
         edit_images = [ png_part ];
         edit_mask = None;
         edit_background = Some "transparent";
         edit_n = Some 1;
         edit_output_compression = None;
         edit_output_format = Some "png";
         edit_quality = Some "high";
         edit_response_format = Some Base64_json;
         edit_size = Some "1024x1024";
         edit_user = None;
         edit_extra = [];
       }
   with
  | Error error -> failwith error.error_message
  | Ok response ->
      assert_equal_string "abc"
        (Option.get (List.hd response.image_data).image_b64_json));
  (match !Fake_http.last_request with
  | Some request -> (
      assert_contains "/images/edits" request.url;
      if
        List.exists
          (fun (name, _) -> String.lowercase_ascii name = "content-type")
          request.headers
      then failwith "multipart request should let runtime set content-type";
      match request.body with
      | Multipart parts ->
          if not (List.exists (fun part -> part.Fake_http.name = "image") parts)
          then failwith "missing image part";
          if
            not (List.exists (fun part -> part.Fake_http.name = "prompt") parts)
          then failwith "missing prompt part"
      | _ -> failwith "expected image edit multipart body")
  | None -> failwith "expected image edit request");
  Fake_http.next_response_body :=
    "{\"text\":\"hello world\",\"language\":\"en\",\"duration\":1.2}";
  (match
     Client.create_transcription config
       {
         transcription_file = wav_part;
         transcription_model = "gpt-4o-transcribe";
         transcription_language = Some "en";
         transcription_prompt = None;
         transcription_response_format = Some Audio_verbose_json;
         transcription_temperature = Some 0.0;
         transcription_timestamp_granularities = [ "word" ];
         transcription_include = [ "logprobs" ];
         transcription_stream = Some false;
         transcription_extra = [];
       }
   with
  | Error error -> failwith error.error_message
  | Ok transcript ->
      assert_equal_string "hello world" transcript.transcription_text);
  (match !Fake_http.last_request with
  | Some request -> (
      assert_contains "/audio/transcriptions" request.url;
      match request.body with
      | Multipart parts ->
          if
            not
              (List.exists
                 (fun part ->
                   part.Fake_http.name = "timestamp_granularities[]"
                   && part.body = "word")
                 parts)
          then failwith "missing timestamp granularities multipart field"
      | _ -> failwith "expected transcription multipart body")
  | None -> failwith "expected transcription request");
  Fake_http.next_response_body := "MP3DATA";
  match
    Client.create_speech config
      {
        speech_model = "gpt-4o-mini-tts";
        speech_input = "hello";
        speech_voice = "alloy";
        speech_response_format = Some "mp3";
        speech_speed = None;
        speech_instructions = None;
        speech_extra = [];
      }
  with
  | Error error -> failwith error.error_message
  | Ok body -> assert_equal_string "MP3DATA" body

let test_client_vector_and_fine_tuning () =
  let config =
    Client.
      {
        api_key = "test-key";
        base_url = default_base_url;
        timeout_ms = Some 1_000;
      }
  in
  Fake_http.next_response_status := 200;
  Fake_http.next_response_body :=
    "{\"id\":\"vs_123\",\"object\":\"vector_store\",\"name\":\"docs\",\"status\":\"completed\",\"usage_bytes\":10,\"created_at\":1700000000}";
  (match
     Client.create_vector_store config
       {
         vector_store_name = Some "docs";
         vector_store_file_ids = [ "file_123" ];
         vector_store_expires_after = None;
         vector_store_metadata = [];
         vector_store_extra = [];
       }
   with
  | Error error -> failwith error.error_message
  | Ok store -> assert_equal_string "vs_123" (Option.get store.vector_store_id));
  (match !Fake_http.last_request with
  | Some request -> assert_contains "/vector_stores" request.url
  | None -> failwith "expected vector store request");
  Fake_http.next_response_body :=
    "{\"data\":[{\"file_id\":\"file_123\",\"filename\":\"guide.md\",\"score\":0.9,\"content\":[]}]}";
  (match
     Client.search_vector_store config ~vector_store_id:"vs_123"
       {
         vector_store_search_query = "hello";
         vector_store_search_max_num_results = Some 5;
         vector_store_search_rewrite_query = Some true;
         vector_store_search_filters = None;
         vector_store_search_ranking_options = None;
         vector_store_search_extra = [];
       }
   with
  | Error error -> failwith error.error_message
  | Ok response ->
      assert_equal_string "file_123"
        (Option.get
           (List.hd response.vector_store_search_results)
             .vector_store_search_file_id));
  (match !Fake_http.last_request with
  | Some request -> assert_contains "/vector_stores/vs_123/search" request.url
  | None -> failwith "expected vector search request");
  Fake_http.next_response_body :=
    "{\"id\":\"vsfb_123\",\"status\":\"in_progress\",\"file_counts\":{\"in_progress\":1},\"created_at\":1700000000}";
  (match
     Client.create_vector_store_file_batch config ~vector_store_id:"vs_123"
       {
         vector_store_file_batch_file_ids = [ "file_123" ];
         vector_store_file_batch_attributes = None;
         vector_store_file_batch_chunking_strategy = None;
         vector_store_file_batch_extra = [];
       }
   with
  | Error error -> failwith error.error_message
  | Ok batch ->
      assert_equal_string "vsfb_123"
        (Option.get batch.vector_store_file_batch_id));
  (match !Fake_http.last_request with
  | Some request ->
      assert_contains "/vector_stores/vs_123/file_batches" request.url
  | None -> failwith "expected vector file batch request");
  Fake_http.next_response_body :=
    "{\"id\":\"ftjob_123\",\"object\":\"fine_tuning.job\",\"model\":\"gpt-4.1-mini\",\"status\":\"validating_files\",\"created_at\":1700000000}";
  (match
     Client.create_fine_tuning_job config
       {
         fine_tuning_model = "gpt-4.1-mini";
         fine_tuning_training_file = "file_train";
         fine_tuning_validation_file = None;
         fine_tuning_suffix = None;
         fine_tuning_hyperparameters = None;
         fine_tuning_integrations = [];
         fine_tuning_seed = None;
         fine_tuning_extra = [];
       }
   with
  | Error error -> failwith error.error_message
  | Ok job -> assert_equal_string "ftjob_123" (Option.get job.fine_tuning_id));
  Fake_http.next_response_body :=
    "{\"data\":[{\"id\":\"ftevent_123\",\"message\":\"queued\",\"level\":\"info\",\"created_at\":1700000001}]}";
  (match Client.list_fine_tuning_events config ~job_id:"ftjob_123" with
  | Error error -> failwith error.error_message
  | Ok events -> assert_equal_int 1 (List.length events.fine_tuning_events));
  Fake_http.next_response_body :=
    "{\"data\":[{\"id\":\"ftckpt_123\",\"fine_tuned_model_checkpoint\":\"ft:gpt-4.1-mini:demo\",\"step_number\":10,\"metrics\":{\"valid_loss\":0.1},\"created_at\":1700000002,\"fine_tuning_job_id\":\"ftjob_123\"}],\"has_more\":false}";
  match Client.list_fine_tuning_checkpoints config ~job_id:"ftjob_123" with
  | Error error -> failwith error.error_message
  | Ok checkpoints ->
      assert_equal_int 1 (List.length checkpoints.fine_tuning_checkpoints)

let test_client_evals_containers_and_admin () =
  let config =
    Client.
      {
        api_key = "test-key";
        base_url = default_base_url;
        timeout_ms = Some 1_000;
      }
  in
  Fake_http.next_response_status := 200;
  Fake_http.next_response_body :=
    "{\"id\":\"eval_123\",\"object\":\"eval\",\"name\":\"nightly parity\"}";
  (match
     Client.create_eval config
       (Chatoyant.Runtime.Json.Object
          [ ("name", Chatoyant.Runtime.Json.String "nightly parity") ])
   with
  | Error error -> failwith error.error_message
  | Ok eval -> assert_equal_string "eval_123" (Option.get eval.api_object_id));
  (match !Fake_http.last_request with
  | Some request ->
      assert_equal_string "POST" request.method_;
      assert_contains "/evals" request.url
  | None -> failwith "expected eval create request");
  Fake_http.next_response_body :=
    "{\"data\":[{\"id\":\"run_123\",\"object\":\"eval.run\"}],\"has_more\":false}";
  (match Client.list_eval_runs config ~eval_id:"eval_123" with
  | Error error -> failwith error.error_message
  | Ok runs -> assert_equal_int 1 (List.length runs.api_list_data));
  (match !Fake_http.last_request with
  | Some request -> assert_contains "/evals/eval_123/runs" request.url
  | None -> failwith "expected eval runs request");
  Fake_http.next_response_body :=
    "{\"id\":\"container_123\",\"object\":\"container\",\"name\":\"sandbox\"}";
  (match
     Client.create_container config
       (Chatoyant.Runtime.Json.Object
          [ ("name", Chatoyant.Runtime.Json.String "sandbox") ])
   with
  | Error error -> failwith error.error_message
  | Ok container ->
      assert_equal_string "container_123" (Option.get container.api_object_id));
  (match !Fake_http.last_request with
  | Some request -> assert_contains "/containers" request.url
  | None -> failwith "expected container create request");
  Fake_http.next_response_body := "CONTAINER_FILE";
  (match
     Client.download_container_file config ~container_id:"container_123"
       ~file_id:"file_123"
   with
  | Error error -> failwith error.error_message
  | Ok body -> assert_equal_string "CONTAINER_FILE" body);
  let admin =
    Client.
      {
        admin_api_key = "admin-key";
        admin_base_url = default_base_url;
        admin_timeout_ms = Some 1_000;
      }
  in
  Fake_http.next_response_body :=
    "{\"data\":[{\"id\":\"key_123\",\"object\":\"organization.admin_api_key\"}],\"has_more\":false}";
  (match Client.list_admin_api_keys admin with
  | Error error -> failwith error.error_message
  | Ok keys -> assert_equal_int 1 (List.length keys.api_list_data));
  match !Fake_http.last_request with
  | Some request ->
      assert_contains "/organization/admin_api_keys" request.url;
      if not (List.mem ("Authorization", "Bearer admin-key") request.headers)
      then failwith "missing admin authorization"
  | None -> failwith "expected admin request"

let () =
  test_request_json ();
  test_response_decode ();
  test_streams ();
  test_realtime_websocket ();
  test_client_realtime_bootstrap ();
  test_other_decoders ();
  test_moderation_and_batches ();
  test_files ();
  test_media_vector_and_fine_tuning_json ();
  test_client_and_provider ();
  test_client_responses_and_conversations ();
  test_client_moderation_and_batches ();
  test_client_files ();
  test_client_media ();
  test_client_vector_and_fine_tuning ();
  test_client_evals_containers_and_admin ()
