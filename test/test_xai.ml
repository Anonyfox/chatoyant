let assert_equal_string expected actual =
  if expected <> actual then
    failwith (Printf.sprintf "expected %S, got %S" expected actual)

let assert_equal_int expected actual =
  if expected <> actual then
    failwith (Printf.sprintf "expected %d, got %d" expected actual)

let assert_equal_float expected actual =
  if abs_float (expected -. actual) > 0.000_000_1 then
    failwith (Printf.sprintf "expected %f, got %f" expected actual)

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
      "{\"id\":\"chatcmpl_xai\",\"object\":\"chat.completion\",\"model\":\"grok-4-1-fast-non-reasoning\",\"choices\":[{\"index\":0,\"message\":{\"role\":\"assistant\",\"content\":\"Hello \
       from Grok\",\"reasoning_content\":\"short \
       reasoning\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":9,\"completion_tokens\":4,\"total_tokens\":13,\"cost_in_usd_ticks\":2500000000}}"

  let send request =
    last_request := Some request;
    Ok
      {
        status = !next_response_status;
        headers = [ ("content-type", "application/json") ];
        body = !next_response_body;
      }
end

module Client = Chatoyant.Provider.Xai.Make_client (Fake_http)

module Provider =
  Chatoyant.Provider.Xai.Make_provider
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

module Xai_ws = Chatoyant.Provider.Xai.Make_websocket (Fake_ws)

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

let request_fixture () =
  Chatoyant.Provider.Xai.
    {
      chat_model = "grok-4-1-fast-non-reasoning";
      chat_messages =
        [
          {
            message_role = System;
            message_content = Some "Answer tightly.";
            message_name = None;
            message_tool_call_id = None;
            message_tool_calls = [];
          };
          {
            message_role = User;
            message_content = Some "Use web search and return JSON.";
            message_name = Some "tester";
            message_tool_call_id = None;
            message_tool_calls = [];
          };
        ];
      chat_stream = true;
      chat_temperature = Some 0.1;
      chat_max_tokens = Some 128;
      chat_top_p = Some 0.9;
      chat_stop = [ "END" ];
      chat_user = Some "user_123";
      chat_seed = Some 42;
      chat_logprobs = Some true;
      chat_top_logprobs = Some 2;
      chat_n = Some 1;
      chat_response_format =
        Some
          (Json_schema
             {
               schema_name = "answer";
               schema_description = Some "A compact answer object";
               schema_value = schema;
               schema_strict = true;
             });
      chat_tools =
        [
          Web_search;
          Function
            {
              Chatoyant.Provider.Openai.tool_name = "lookup";
              tool_description = Some "Lookup structured data";
              tool_parameters = schema;
              tool_strict = Some true;
            };
        ];
      chat_tool_choice = Some (Tool "lookup");
      chat_parallel_tool_calls = Some false;
      chat_extra = [ ("search_parameters", Chatoyant.Runtime.Json.Object []) ];
    }

let test_chat_request_json () =
  let body =
    request_fixture () |> Chatoyant.Provider.Xai.chat_request_json
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"model\":\"grok-4-1-fast-non-reasoning\"" body;
  assert_contains "\"type\":\"web_search\"" body;
  assert_contains "\"response_format\"" body;
  assert_contains "\"json_schema\"" body;
  assert_contains "\"parallel_tool_calls\":false" body;
  assert_contains "\"search_parameters\"" body;
  assert_contains "\"tool_choice\"" body;
  let prioritized =
    let open Chatoyant.Provider.Xai in
    let request = request_fixture () in
    {
      request with
      chat_extra = [ service_tier_extra Priority_tier; background_extra true ];
    }
    |> chat_request_json |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"service_tier\":\"priority\"" prioritized;
  assert_contains "\"background\":true" prioritized

let test_chat_response_decode () =
  let json =
    Chatoyant.Runtime.Json.Object
      [
        ("id", Chatoyant.Runtime.Json.String "chatcmpl_xai");
        ("model", Chatoyant.Runtime.Json.String "grok-4-1-fast-non-reasoning");
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
                          Chatoyant.Runtime.Json.String "Why" );
                      ] );
                  ("finish_reason", Chatoyant.Runtime.Json.String "stop");
                ];
            ] );
        ( "usage",
          Chatoyant.Runtime.Json.Object
            [
              ("prompt_tokens", Chatoyant.Runtime.Json.Float 9.0);
              ("completion_tokens", Chatoyant.Runtime.Json.Float 4.0);
              ("total_tokens", Chatoyant.Runtime.Json.Float 13.0);
              ("cost_in_usd_ticks", Chatoyant.Runtime.Json.Float 2_500_000_000.0);
            ] );
      ]
  in
  let response = Chatoyant.Provider.Xai.chat_response_of_json json in
  assert_equal_string "Hello" response.response_content;
  assert_equal_string "Why" response.response_reasoning_content;
  assert_equal_int 9 response.response_usage.input_tokens;
  assert_equal_float 0.25 (Option.get response.response_usage.actual_cost_usd)

let responses_fixture () =
  Chatoyant.Provider.Xai.
    {
      responses_model = "grok-4.20-0309-non-reasoning";
      responses_input =
        Responses_items
          [
            Chatoyant.Runtime.Json.Object
              [
                ("role", Chatoyant.Runtime.Json.String "system");
                ("content", Chatoyant.Runtime.Json.String "Answer tightly.");
              ];
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
      responses_temperature = Some 0.2;
      responses_top_p = Some 0.95;
      responses_max_output_tokens = Some 128;
      responses_tools = [ Web_search ];
      responses_tool_choice = Some Auto;
      responses_text_format =
        Some
          (Json_schema
             {
               schema_name = "answer";
               schema_description = None;
               schema_value = schema;
               schema_strict = true;
             });
      responses_parallel_tool_calls = Some true;
      responses_top_logprobs = Some 0;
      responses_truncation = Some "disabled";
      responses_extra = [];
    }

let test_responses_api () =
  let body =
    responses_fixture () |> Chatoyant.Provider.Xai.responses_request_json
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"previous_response_id\":\"resp_prev\"" body;
  assert_contains "\"store\":false" body;
  assert_contains "\"text\":{\"format\":{\"type\":\"json_schema\"" body;
  assert_contains "\"type\":\"web_search\"" body;
  let json =
    Chatoyant.Runtime.Json.Object
      [
        ("id", Chatoyant.Runtime.Json.String "resp_123");
        ("model", Chatoyant.Runtime.Json.String "grok-4.20-0309-reasoning");
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
                            ("type", Chatoyant.Runtime.Json.String "output_text");
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
                              Chatoyant.Runtime.Json.String "Reasoning summary"
                            );
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
                  [ ("reasoning_tokens", Chatoyant.Runtime.Json.Float 2.0) ] );
              ("total_tokens", Chatoyant.Runtime.Json.Float 15.0);
              ("cost_in_usd_ticks", Chatoyant.Runtime.Json.Float 1_000_000_000.0);
            ] );
      ]
  in
  let response = Chatoyant.Provider.Xai.responses_response_of_json json in
  assert_equal_string "Hello from Responses" response.responses_output_text;
  assert_equal_string "Reasoning summary" response.responses_reasoning_text;
  assert_equal_int 3 response.responses_usage.cached_tokens;
  assert_equal_int 2 response.responses_usage.reasoning_tokens;
  assert_equal_float 0.1 (Option.get response.responses_usage.actual_cost_usd)

let test_stream_chunks () =
  (match
     Chatoyant.Provider.Xai.responses_stream_events_of_chunks
       [
         "data: \
          {\"type\":\"response.output_text.delta\",\"item_id\":\"item_1\",\"output_index\":0,\"content_index\":0,\"delta\":\"Hel\"}\n\n";
         "data: \
          {\"type\":\"response.function_call_arguments.done\",\"item_id\":\"item_2\",\"output_index\":1,\"arguments\":\"{\\\"q\\\":\\\"ocaml\\\"}\"}\n\n";
         "data: \
          {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_123\",\"status\":\"completed\",\"output_text\":\"Hello\",\"usage\":{\"input_tokens\":2,\"output_tokens\":1,\"total_tokens\":3,\"cost_in_usd_ticks\":1000000000}}}\n\n";
       ]
   with
  | Error message -> failwith message
  | Ok
      [
        Chatoyant.Provider.Xai.Response_output_text_delta { delta = "Hel"; _ };
        Chatoyant.Provider.Xai.Response_function_call_arguments_done
          { arguments; _ };
        Chatoyant.Provider.Xai.Response_completed response;
      ] ->
      assert_contains "\"q\":\"ocaml\"" arguments;
      assert_equal_string "Hello" response.responses_output_text;
      assert_equal_float 0.1
        (Option.get response.responses_usage.actual_cost_usd)
  | Ok _ -> failwith "unexpected xAI response stream event sequence");
  (match
     Chatoyant.Provider.Xai.response_of_stream_chunks
       [
         "data: {\"type\":\"response.output_text.delta\",\"delta\":\"Hel\"}\n\n";
         "data: \
          {\"type\":\"response.reasoning_summary_text.delta\",\"delta\":\"Because\"}\n\n";
         "data: {\"type\":\"response.output_text.delta\",\"delta\":\"lo\"}\n\n";
         "data: \
          {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\",\"output_text\":\"Hello\",\"usage\":{\"input_tokens\":2,\"output_tokens\":1,\"total_tokens\":3,\"cost_in_usd_ticks\":1000000000}}}\n\n";
       ]
   with
  | Error message -> failwith message
  | Ok response ->
      assert_equal_string "Hello" response.responses_output_text;
      assert_equal_string "Because" response.responses_reasoning_text;
      assert_equal_int 3 response.responses_usage.total_tokens;
      assert_equal_float 0.1
        (Option.get response.responses_usage.actual_cost_usd));
  let response =
    Chatoyant.Provider.Xai.stream_response_of_chunks
      [
        "data: \
         {\"choices\":[{\"delta\":{\"content\":\"Hel\",\"reasoning_content\":\"Be\"}}]}\n\n";
        "data: \
         {\"choices\":[{\"delta\":{\"content\":\"lo\",\"reasoning_content\":\"cause\"}}]}\n\n";
        "data: \
         {\"choices\":[{\"finish_reason\":\"stop\",\"delta\":{}}],\"usage\":{\"prompt_tokens\":2,\"completion_tokens\":1,\"total_tokens\":3,\"cost_in_usd_ticks\":1000000000}}\n\n";
        "data: [DONE]\n\n";
      ]
  in
  match response with
  | Error message -> failwith message
  | Ok response ->
      assert_equal_string "Hello" response.response_content;
      assert_equal_string "Because" response.response_reasoning_content;
      assert_equal_int 3 response.response_usage.total_tokens;
      assert_equal_float 0.1
        (Option.get response.response_usage.actual_cost_usd)

let test_websocket_helpers () =
  let voice_url =
    Chatoyant.Provider.Xai.voice_agent_url ~model:"grok-voice-latest" ()
  in
  assert_contains "wss://api.x.ai/v1/realtime?model=grok-voice-latest" voice_url;
  let tts_url =
    Chatoyant.Provider.Xai.streaming_tts_url ~voice:"eve" ~codec:"mp3"
      ~sample_rate:24000 ~bit_rate:128000 ~speed:1.2
      ~optimize_streaming_latency:2 ~text_normalization:true
      ~with_timestamps:true ()
  in
  assert_contains "wss://api.x.ai/v1/tts?language=en" tts_url;
  assert_contains "voice=eve" tts_url;
  assert_contains "codec=mp3" tts_url;
  assert_contains "speed=1.2" tts_url;
  assert_contains "optimize_streaming_latency=2" tts_url;
  assert_contains "text_normalization=true" tts_url;
  assert_contains "with_timestamps=true" tts_url;
  let stt_url =
    Chatoyant.Provider.Xai.streaming_stt_url ~sample_rate:16000 ~encoding:"pcm"
      ~interim_results:true ~language:"en"
      ~keyterms:[ "Understand The Universe"; "Grok" ]
      ~smart_turn:0.7 ~smart_turn_timeout:3000 ()
  in
  assert_contains "wss://api.x.ai/v1/stt?sample_rate=16000" stt_url;
  assert_contains "interim_results=true" stt_url;
  assert_contains "keyterm=Understand%20The%20Universe" stt_url;
  assert_contains "smart_turn=0.7" stt_url;
  assert_equal_string "wss://api.x.ai/v1/responses"
    (Chatoyant.Provider.Xai.responses_websocket_url ());
  assert_equal_string "wss://api.x.ai/v1/responses"
    Xai_ws.default_responses_base_url;
  assert_equal_string "wss://api.x.ai/v1/stt" Xai_ws.default_stt_base_url;
  Fake_ws.next_incoming := [ Text "{\"type\":\"session.created\"}" ];
  (match
     Xai_ws.connect
       {
         websocket_api_key = "xai-key";
         websocket_url = voice_url;
         websocket_timeout_ms = Some 1_000;
         websocket_headers = [ ("X-Test", "yes") ];
         websocket_protocols = [];
       }
       (fun connection ->
         (match Xai_ws.receive_json connection with
         | Error error -> failwith error.error_message
         | Ok json ->
             assert_equal_string "session.created"
               (Option.get
                  (Option.bind
                     (Chatoyant.Runtime.Json.field "type" json)
                     Chatoyant.Runtime.Json.as_string)));
         match
           Xai_ws.send_json connection
             (Chatoyant.Runtime.Json.Object
                [ ("type", Chatoyant.Runtime.Json.String "session.update") ])
         with
         | Error error -> failwith error.error_message
         | Ok () -> ())
   with
  | Error error -> failwith error.error_message
  | Ok () -> ());
  (match !Fake_ws.last_request with
  | Some request ->
      assert_contains "model=grok-voice-latest" request.url;
      if not (List.mem ("Authorization", "Bearer xai-key") request.headers) then
        failwith "missing xAI websocket authorization";
      if not (List.mem ("X-Test", "yes") request.headers) then
        failwith "missing xAI websocket custom header"
  | None -> failwith "expected xAI websocket request");
  (match !Fake_ws.last_sent with
  | [ Fake_ws.Text text ] -> assert_contains "\"session.update\"" text
  | _ -> failwith "expected xAI websocket JSON frame");
  Fake_ws.next_incoming := [ Binary "AUDIO" ];
  match
    Xai_ws.connect
      {
        websocket_api_key = "xai-key";
        websocket_url = tts_url;
        websocket_timeout_ms = Some 1_000;
        websocket_headers = [];
        websocket_protocols = [];
      } (fun connection ->
        match
          Xai_ws.send_text connection
            "{\"type\":\"text.delta\",\"text\":\"hi\"}"
        with
        | Error error -> failwith error.error_message
        | Ok () -> Xai_ws.receive_frame connection)
  with
  | Error error -> failwith error.error_message
  | Ok (Error error) -> failwith error.error_message
  | Ok (Ok (Fake_ws.Binary "AUDIO")) -> ()
  | Ok (Ok _) -> failwith "expected xAI streaming TTS binary frame"

let test_image_and_video_requests () =
  let image_body =
    Chatoyant.Provider.Xai.
      {
        image_model = Some "grok-imagine-image-quality";
        image_prompt = "A precise product render";
        image_n = Some 2;
        image_response_format = Some Base64_json;
        image_aspect_ratio = Some "16:9";
        image_resolution = Some "1024x576";
        image_user = Some "user_123";
        image_extra = [];
      }
    |> Chatoyant.Provider.Xai.image_request_json
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"model\":\"grok-imagine-image-quality\"" image_body;
  assert_contains "\"response_format\":\"b64_json\"" image_body;
  assert_contains "\"aspect_ratio\":\"16:9\"" image_body;
  let edit_body =
    Chatoyant.Provider.Xai.
      {
        edit_model = Some "grok-imagine-image-quality";
        edit_prompt = "Replace the background";
        edit_images =
          [
            {
              source_url = "https://example.com/a.png";
              source_type = "image_url";
            };
            {
              source_url = "https://example.com/b.png";
              source_type = "image_url";
            };
          ];
        edit_n = Some 1;
        edit_response_format = Some Url;
        edit_aspect_ratio = Some "1:1";
        edit_resolution = Some "1024x1024";
        edit_extra = [];
      }
    |> Chatoyant.Provider.Xai.image_edit_request_json
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"image\":[{\"url\":\"https://example.com/a.png\"" edit_body;
  let video_body =
    Chatoyant.Provider.Xai.
      {
        video_model = Some "grok-imagine-video-1.5";
        video_prompt = "A rotating object";
        video_duration = Some 6;
        video_aspect_ratio = Some "9:16";
        video_resolution = Some "720x1280";
        video_image_url = Some "https://example.com/source.png";
        video_url = None;
        video_extra = [];
      }
    |> Chatoyant.Provider.Xai.video_request_json
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"model\":\"grok-imagine-video-1.5\"" video_body;
  assert_contains "\"duration\":6" video_body;
  assert_contains "\"image_url\":\"https://example.com/source.png\"" video_body

let test_image_and_video_response_decode () =
  let image_json =
    Chatoyant.Runtime.Json.Object
      [
        ("created", Chatoyant.Runtime.Json.Float 1_700_000_000.0);
        ("model", Chatoyant.Runtime.Json.String "grok-imagine-image-quality");
        ( "data",
          Chatoyant.Runtime.Json.Array
            [
              Chatoyant.Runtime.Json.Object
                [
                  ( "url",
                    Chatoyant.Runtime.Json.String
                      "https://example.com/image.png" );
                  ( "revised_prompt",
                    Chatoyant.Runtime.Json.String "A revised prompt" );
                ];
            ] );
      ]
  in
  let image = Chatoyant.Provider.Xai.image_response_of_json image_json in
  assert_equal_int 1 (List.length image.image_data);
  assert_equal_string "https://example.com/image.png"
    (Option.get (List.hd image.image_data).image_url);
  let video_start =
    Chatoyant.Provider.Xai.video_start_response_of_json
      (Chatoyant.Runtime.Json.Object
         [ ("request_id", Chatoyant.Runtime.Json.String "vid_123") ])
  in
  assert_equal_string "vid_123" video_start.request_id;
  let video_status =
    Chatoyant.Provider.Xai.video_status_response_of_json
      (Chatoyant.Runtime.Json.Object
         [
           ("status", Chatoyant.Runtime.Json.String "completed");
           ( "video",
             Chatoyant.Runtime.Json.Object
               [
                 ( "url",
                   Chatoyant.Runtime.Json.String "https://example.com/video.mp4"
                 );
                 ("duration", Chatoyant.Runtime.Json.Float 6.0);
                 ( "model",
                   Chatoyant.Runtime.Json.String "grok-imagine-video-1.5" );
               ] );
         ])
  in
  (match video_status.status with
  | Chatoyant.Provider.Xai.Done -> ()
  | _ -> failwith "expected completed video status");
  assert_equal_string "https://example.com/video.mp4"
    (Option.get video_status.video_url);
  assert_equal_int 6 (Option.get video_status.video_duration)

let test_voice_and_audio_requests () =
  let tts_body =
    Chatoyant.Provider.Xai.
      {
        tts_text = "Hello [laugh]";
        tts_voice_id = Some "eve";
        tts_language = "en";
        tts_output_format =
          Some
            {
              output_codec = Some "mp3";
              output_sample_rate = Some 44100;
              output_bit_rate = Some 192000;
            };
        tts_speed = Some 1.2;
        tts_optimize_streaming_latency = Some 1;
        tts_text_normalization = Some true;
        tts_with_timestamps = Some false;
        tts_extra = [];
      }
    |> Chatoyant.Provider.Xai.tts_request_json
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"text\":\"Hello [laugh]\"" tts_body;
  assert_contains "\"voice_id\":\"eve\"" tts_body;
  assert_contains "\"codec\":\"mp3\"" tts_body;
  let stt_parts =
    Chatoyant.Provider.Xai.stt_request_parts
      {
        stt_file =
          Some
            {
              upload_filename = "audio.mp3";
              upload_content_type = Some "audio/mpeg";
              upload_body = "MP3";
            };
        stt_url = None;
        stt_audio_format = None;
        stt_sample_rate = None;
        stt_language = Some "en";
        stt_format = Some true;
        stt_multichannel = Some false;
        stt_channels = None;
        stt_diarize = Some true;
        stt_keyterms = [ "Understand The Universe"; "Grok" ];
        stt_filler_words = Some true;
        stt_extra = [ ("trace_id", "trace_123") ];
      }
  in
  assert_equal_string "file" (List.hd (List.rev stt_parts)).form_name;
  assert_equal_string "audio.mp3"
    (Option.get (List.hd (List.rev stt_parts)).form_filename);
  let custom_parts =
    Chatoyant.Provider.Xai.custom_voice_request_parts
      {
        custom_voice_file =
          {
            upload_filename = "reference.wav";
            upload_content_type = Some "audio/wav";
            upload_body = "WAV";
          };
        custom_voice_name = Some "Friendly Narrator";
        custom_voice_description = Some "Warm";
        custom_voice_gender = Some "female";
        custom_voice_accent = Some "American";
        custom_voice_age = Some "young";
        custom_voice_language = Some "en";
        custom_voice_use_case = Some "narration";
        custom_voice_tone = Some "warm";
        custom_voice_extra = [];
      }
  in
  assert_equal_string "file" (List.hd (List.rev custom_parts)).form_name;
  let stt =
    Chatoyant.Provider.Xai.stt_response_of_json
      (Chatoyant.Runtime.Json.Object
         [
           ("text", Chatoyant.Runtime.Json.String "The balance is $100.");
           ("language", Chatoyant.Runtime.Json.String "English");
           ("duration", Chatoyant.Runtime.Json.Float 3.45);
           ( "words",
             Chatoyant.Runtime.Json.Array
               [
                 Chatoyant.Runtime.Json.Object
                   [
                     ("text", Chatoyant.Runtime.Json.String "The");
                     ("start", Chatoyant.Runtime.Json.Float 0.24);
                     ("end", Chatoyant.Runtime.Json.Float 0.48);
                     ("speaker", Chatoyant.Runtime.Json.Float 1.0);
                   ];
               ] );
         ])
  in
  assert_equal_string "The balance is $100." (Option.get stt.stt_text);
  assert_equal_int 1 (List.length stt.stt_words);
  assert_equal_int 1 (Option.get (List.hd stt.stt_words).word_speaker);
  let voices =
    Chatoyant.Provider.Xai.voice_list_of_json
      (Chatoyant.Runtime.Json.Object
         [
           ( "voices",
             Chatoyant.Runtime.Json.Array
               [
                 Chatoyant.Runtime.Json.Object
                   [
                     ("voice_id", Chatoyant.Runtime.Json.String "eve");
                     ("name", Chatoyant.Runtime.Json.String "Eve");
                   ];
               ] );
         ])
  in
  assert_equal_string "eve" (Option.get (List.hd voices.voices).voice_id)

let test_batches () =
  let create_body =
    Chatoyant.Provider.Xai.batch_create_request_json
      { batch_name = "nightly evals" }
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"name\":\"nightly evals\"" create_body;
  let add_body =
    Chatoyant.Provider.Xai.batch_requests_add_json
      {
        batch_requests =
          [
            Chatoyant.Runtime.Json.Object
              [
                ("custom_id", Chatoyant.Runtime.Json.String "case_1");
                ("method", Chatoyant.Runtime.Json.String "POST");
                ("url", Chatoyant.Runtime.Json.String "/v1/chat/completions");
                ("body", Chatoyant.Runtime.Json.Object []);
              ];
          ];
      }
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"batch_requests\"" add_body;
  let batch =
    Chatoyant.Provider.Xai.batch_of_json
      (Chatoyant.Runtime.Json.Object
         [
           ("batch_id", Chatoyant.Runtime.Json.String "batch_123");
           ("create_api_key_id", Chatoyant.Runtime.Json.String "key_123");
           ("create_time", Chatoyant.Runtime.Json.String "2026-01-01T00:00:00Z");
           ("name", Chatoyant.Runtime.Json.String "nightly evals");
           ( "state",
             Chatoyant.Runtime.Json.Object
               [ ("succeeded", Chatoyant.Runtime.Json.Float 1.0) ] );
         ])
  in
  assert_equal_string "batch_123" (Option.get batch.batch_id);
  let batches =
    Chatoyant.Provider.Xai.batch_list_of_json
      (Chatoyant.Runtime.Json.Object
         [
           ( "batches",
             Chatoyant.Runtime.Json.Array
               [
                 Chatoyant.Runtime.Json.Object
                   [ ("batch_id", Chatoyant.Runtime.Json.String "batch_123") ];
               ] );
           ("pagination_token", Chatoyant.Runtime.Json.String "next");
         ])
  in
  assert_equal_int 1 (List.length batches.batches);
  let metadata =
    Chatoyant.Provider.Xai.batch_request_metadata_list_of_json
      (Chatoyant.Runtime.Json.Object
         [
           ( "batch_request_metadata",
             Chatoyant.Runtime.Json.Array
               [
                 Chatoyant.Runtime.Json.Object
                   [ ("request_id", Chatoyant.Runtime.Json.String "req_123") ];
               ] );
         ])
  in
  assert_equal_int 1 (List.length metadata.batch_request_metadata)

let test_client_and_provider () =
  let config =
    Client.
      {
        api_key = "test-key";
        base_url = default_base_url;
        timeout_ms = Some 1_000;
      }
  in
  (match Client.create_chat config (request_fixture ()) with
  | Error error -> failwith error.error_message
  | Ok response ->
      assert_equal_string "Hello from Grok" response.response_content;
      assert_equal_string "short reasoning" response.response_reasoning_content);
  (match !Fake_http.last_request with
  | None -> failwith "expected captured xAI request"
  | Some request ->
      assert_equal_string "POST" request.method_;
      assert_contains "/chat/completions" request.url;
      if not (List.mem ("Authorization", "Bearer test-key") request.headers)
      then failwith "missing authorization header");
  Fake_http.next_response_status := 400;
  Fake_http.next_response_body :=
    "{\"error\":{\"type\":\"invalid_request\",\"message\":\"bad xai request\"}}";
  (match Client.create_chat config (request_fixture ()) with
  | Ok _ -> failwith "expected xAI client error"
  | Error error -> assert_contains "bad xai request" error.error_message);
  Fake_http.next_response_status := 200;
  Fake_http.next_response_body :=
    "{\"id\":\"chatcmpl_xai\",\"object\":\"chat.completion\",\"model\":\"grok-4-1-fast-non-reasoning\",\"choices\":[{\"index\":0,\"message\":{\"role\":\"assistant\",\"content\":\"Hello \
     from Grok\",\"reasoning_content\":\"short \
     reasoning\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":9,\"completion_tokens\":4,\"total_tokens\":13,\"cost_in_usd_ticks\":2500000000}}";
  match
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
        Chatoyant.Provider.Provider.model = "grok-4-1-fast-non-reasoning";
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
  | Error _ -> failwith "xAI provider adapter failed"
  | Ok generation ->
      assert_equal_string "Hello from Grok" generation.content;
      assert_equal_string "short reasoning" generation.reasoning_content

let test_client_batches () =
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
    "{\"batch_id\":\"batch_123\",\"create_api_key_id\":\"key_123\",\"create_time\":\"2026-01-01T00:00:00Z\",\"name\":\"nightly \
     evals\",\"state\":{\"processing\":0}}";
  (match Client.create_batch config { batch_name = "nightly evals" } with
  | Error error -> failwith error.error_message
  | Ok batch -> assert_equal_string "batch_123" (Option.get batch.batch_id));
  (match !Fake_http.last_request with
  | Some request ->
      assert_equal_string "POST" request.method_;
      assert_contains "/batches" request.url
  | None -> failwith "expected xAI batch request");
  Fake_http.next_response_body :=
    "{\"batch_request_metadata\":[{\"request_id\":\"req_123\"}],\"pagination_token\":\"next\"}";
  (match
     Client.add_batch_requests config ~batch_id:"batch_123"
       {
         batch_requests =
           [
             Chatoyant.Runtime.Json.Object
               [
                 ("custom_id", Chatoyant.Runtime.Json.String "case_1");
                 ("body", Chatoyant.Runtime.Json.Object []);
               ];
           ];
       }
   with
  | Error error -> failwith error.error_message
  | Ok metadata ->
      assert_equal_int 1 (List.length metadata.batch_request_metadata));
  Fake_http.next_response_body :=
    "{\"batches\":[{\"batch_id\":\"batch_123\"}],\"pagination_token\":\"next\"}";
  match Client.list_batches config with
  | Error error -> failwith error.error_message
  | Ok batches -> assert_equal_int 1 (List.length batches.batches)

let test_client_responses_and_models () =
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
    "{\"id\":\"resp_123\",\"object\":\"response\",\"model\":\"grok-4.20-0309-reasoning\",\"status\":\"completed\",\"output\":[{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":\"Hello \
     from \
     Responses\"}]}],\"usage\":{\"input_tokens\":1,\"output_tokens\":2,\"total_tokens\":3}}";
  (match Client.create_response config (responses_fixture ()) with
  | Error error -> failwith error.error_message
  | Ok response ->
      assert_equal_string "Hello from Responses" response.responses_output_text);
  (match !Fake_http.last_request with
  | None -> failwith "expected captured responses request"
  | Some request ->
      assert_equal_string "POST" request.method_;
      assert_contains "/responses" request.url);
  (match Client.retrieve_response config ~response_id:"resp_123" with
  | Error error -> failwith error.error_message
  | Ok response ->
      assert_equal_string "Hello from Responses" response.responses_output_text);
  (match Client.retrieve_deferred_response config ~request_id:"req_123" with
  | Error error -> failwith error.error_message
  | Ok response ->
      assert_equal_string "Hello from Responses" response.responses_output_text);
  (match !Fake_http.last_request with
  | Some request ->
      assert_contains "/responses/deferred-completion/req_123" request.url
  | None -> failwith "expected xAI deferred response request");
  Fake_http.next_response_body :=
    "{\"id\":\"chatcmpl_xai\",\"object\":\"chat.completion\",\"model\":\"grok-4-1-fast-non-reasoning\",\"choices\":[{\"index\":0,\"message\":{\"role\":\"assistant\",\"content\":\"deferred \
     chat\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":1,\"completion_tokens\":1,\"total_tokens\":2}}";
  (match Client.retrieve_deferred_chat config ~request_id:"chat_req_123" with
  | Error error -> failwith error.error_message
  | Ok response -> assert_equal_string "deferred chat" response.response_content);
  (match !Fake_http.last_request with
  | Some request ->
      assert_contains "/chat/deferred-completion/chat_req_123" request.url
  | None -> failwith "expected xAI deferred chat request");
  Fake_http.next_response_body :=
    "{\"id\":\"resp_123\",\"object\":\"response\",\"deleted\":true}";
  (match Client.delete_response config ~response_id:"resp_123" with
  | Error error -> failwith error.error_message
  | Ok response ->
      if not response.deleted then failwith "expected deleted response");
  Fake_http.next_response_body :=
    "{\"object\":\"list\",\"data\":[{\"id\":\"grok-4.20-0309-non-reasoning\",\"object\":\"model\",\"created\":1770000000,\"owned_by\":\"xai\"}]}";
  match Client.list_models config with
  | Error error -> failwith error.error_message
  | Ok list ->
      assert_equal_int 1 (List.length list.models);
      assert_equal_string "grok-4.20-0309-non-reasoning"
        (Option.get (List.hd list.models).model_id)

let test_client_voice_endpoints () =
  let config =
    Client.
      {
        api_key = "test-key";
        base_url = default_base_url;
        timeout_ms = Some 1_000;
      }
  in
  Fake_http.next_response_status := 200;
  Fake_http.next_response_body := "AUDIO";
  (match
     Client.synthesize_speech config
       {
         tts_text = "Hello";
         tts_voice_id = Some "eve";
         tts_language = "en";
         tts_output_format = None;
         tts_speed = None;
         tts_optimize_streaming_latency = None;
         tts_text_normalization = None;
         tts_with_timestamps = None;
         tts_extra = [];
       }
   with
  | Error error -> failwith error.error_message
  | Ok audio -> assert_equal_string "AUDIO" audio.audio_body);
  (match !Fake_http.last_request with
  | Some request -> (
      assert_contains "/tts" request.url;
      match request.body with
      | Fake_http.Json body ->
          assert_contains "\"voice_id\":\"eve\""
            (Chatoyant.Runtime.Json.to_string body)
      | _ -> failwith "expected xAI TTS JSON request")
  | None -> failwith "expected xAI TTS request");
  Fake_http.next_response_body :=
    "{\"voices\":[{\"voice_id\":\"eve\",\"name\":\"Eve\"},{\"voice_id\":\"ara\",\"name\":\"Ara\"}]}";
  (match Client.list_tts_voices config with
  | Error error -> failwith error.error_message
  | Ok voices -> assert_equal_int 2 (List.length voices.voices));
  Fake_http.next_response_body :=
    "{\"text\":\"Hello \
     world\",\"language\":\"English\",\"duration\":1.25,\"words\":[{\"text\":\"Hello\",\"start\":0.0,\"end\":0.5}]}";
  (match
     Client.transcribe_speech config
       {
         stt_file =
           Some
             {
               upload_filename = "audio.mp3";
               upload_content_type = Some "audio/mpeg";
               upload_body = "MP3";
             };
         stt_url = None;
         stt_audio_format = None;
         stt_sample_rate = None;
         stt_language = Some "en";
         stt_format = Some true;
         stt_multichannel = None;
         stt_channels = None;
         stt_diarize = None;
         stt_keyterms = [ "Grok" ];
         stt_filler_words = None;
         stt_extra = [];
       }
   with
  | Error error -> failwith error.error_message
  | Ok stt -> assert_equal_string "Hello world" (Option.get stt.stt_text));
  (match !Fake_http.last_request with
  | Some request -> (
      assert_contains "/stt" request.url;
      match request.body with
      | Fake_http.Multipart parts ->
          assert_equal_string "file" (List.hd (List.rev parts)).name;
          assert_equal_string "audio.mp3"
            (Option.get (List.hd (List.rev parts)).filename)
      | _ -> failwith "expected xAI STT multipart request")
  | None -> failwith "expected xAI STT request");
  Fake_http.next_response_body :=
    "{\"client_secret\":{\"value\":\"xai_eph_123\",\"expires_at\":1800000000}}";
  (match
     Client.create_realtime_client_secret config
       {
         realtime_client_secret_expires_after_seconds = Some 300;
         realtime_client_secret_extra = [];
       }
   with
  | Error error -> failwith error.error_message
  | Ok secret ->
      assert_equal_string "xai_eph_123"
        (Option.get secret.realtime_client_secret_value));
  (match !Fake_http.last_request with
  | Some request -> (
      assert_contains "/realtime/client_secrets" request.url;
      match request.body with
      | Fake_http.Json body ->
          let text = Chatoyant.Runtime.Json.to_string body in
          assert_contains "\"expires_after\"" text;
          assert_contains "\"seconds\":300" text
      | _ -> failwith "expected xAI realtime client secret JSON request")
  | None -> failwith "expected xAI realtime client secret request");
  Fake_http.next_response_body :=
    "{\"voice_id\":\"nlbqfwie\",\"name\":\"Friendly \
     Narrator\",\"description\":\"Warm\",\"gender\":\"female\",\"language\":\"en\",\"tone\":\"warm\",\"created_at\":\"2026-04-26T18:56:34Z\"}";
  (match
     Client.create_custom_voice config
       {
         custom_voice_file =
           {
             upload_filename = "reference.wav";
             upload_content_type = Some "audio/wav";
             upload_body = "WAV";
           };
         custom_voice_name = Some "Friendly Narrator";
         custom_voice_description = Some "Warm";
         custom_voice_gender = Some "female";
         custom_voice_accent = None;
         custom_voice_age = None;
         custom_voice_language = Some "en";
         custom_voice_use_case = Some "narration";
         custom_voice_tone = Some "warm";
         custom_voice_extra = [];
       }
   with
  | Error error -> failwith error.error_message
  | Ok voice -> assert_equal_string "nlbqfwie" (Option.get voice.voice_id));
  (match !Fake_http.last_request with
  | Some request -> assert_contains "/custom-voices" request.url
  | None -> failwith "expected xAI custom voice create request");
  Fake_http.next_response_body :=
    "{\"voices\":[{\"voice_id\":\"nlbqfwie\",\"name\":\"Friendly \
     Narrator\"}],\"pagination_token\":\"next\"}";
  (match Client.list_custom_voices ~limit:50 config with
  | Error error -> failwith error.error_message
  | Ok voices ->
      assert_equal_string "next" (Option.get voices.voices_pagination_token));
  Fake_http.next_response_body :=
    "{\"voice_id\":\"nlbqfwie\",\"name\":\"Friendly \
     Narrator\",\"tone\":\"calm\"}";
  (match
     Client.update_custom_voice config ~voice_id:"nlbqfwie"
       {
         custom_voice_update_name = None;
         custom_voice_update_description = Some "Updated";
         custom_voice_update_gender = None;
         custom_voice_update_accent = None;
         custom_voice_update_age = None;
         custom_voice_update_language = None;
         custom_voice_update_use_case = None;
         custom_voice_update_tone = Some "calm";
         custom_voice_update_extra = [];
       }
   with
  | Error error -> failwith error.error_message
  | Ok voice -> assert_equal_string "calm" (Option.get voice.voice_tone));
  Fake_http.next_response_body := "WAV";
  (match Client.download_custom_voice_audio config ~voice_id:"nlbqfwie" with
  | Error error -> failwith error.error_message
  | Ok audio -> assert_equal_string "WAV" audio.audio_body);
  Fake_http.next_response_body := "{\"voice_id\":\"nlbqfwie\",\"deleted\":true}";
  match Client.delete_custom_voice config ~voice_id:"nlbqfwie" with
  | Error error -> failwith error.error_message
  | Ok deleted ->
      assert_equal_string "nlbqfwie" (Option.get deleted.deleted_voice_id);
      if not deleted.voice_deleted then failwith "expected custom voice delete"

let test_files_and_collections_json () =
  let collection_body =
    Chatoyant.Provider.Xai.
      {
        collection_name = "SEC Filings";
        collection_description = Some "Reports";
        collection_index_configuration =
          Some
            (Chatoyant.Runtime.Json.Object
               [ ("chunk_size", Chatoyant.Runtime.Json.Float 800.0) ]);
        collection_field_definitions =
          [
            Chatoyant.Runtime.Json.Object
              [
                ("name", Chatoyant.Runtime.Json.String "ticker");
                ("type", Chatoyant.Runtime.Json.String "string");
              ];
          ];
        collection_extra = [];
      }
    |> Chatoyant.Provider.Xai.collection_request_json
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"collection_name\":\"SEC Filings\"" collection_body;
  assert_contains "\"field_definitions\"" collection_body;
  let search_body =
    Chatoyant.Provider.Xai.
      {
        collection_search_query = "revenue";
        collection_search_limit = Some 5;
        collection_search_filter = Some "fields.ticker:TSLA";
        collection_search_extra = [];
      }
    |> Chatoyant.Provider.Xai.collection_search_request_json
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"query\":\"revenue\"" search_body;
  assert_contains "\"limit\":5" search_body

let test_client_files_and_downloads () =
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
    "{\"id\":\"file_123\",\"object\":\"file\",\"filename\":\"doc.pdf\",\"bytes\":12,\"purpose\":\"assistants\",\"created_at\":1700000000,\"expires_at\":\"2026-06-21T00:00:00Z\"}";
  (match
     Client.upload_file config
       {
         file_filename = "doc.pdf";
         file_content_type = Some "application/pdf";
         file_body = "%PDF";
         file_purpose = "assistants";
         file_expires_after = Some 3600;
       }
   with
  | Error error -> failwith error.error_message
  | Ok file -> assert_equal_string "file_123" (Option.get file.file_id));
  (match !Fake_http.last_request with
  | Some request -> (
      assert_contains "/files" request.url;
      if
        List.exists
          (fun (name, _) -> String.lowercase_ascii name = "content-type")
          request.headers
      then failwith "multipart xAI file upload should not force content-type";
      match request.body with
      | Multipart parts ->
          assert_equal_int 3 (List.length parts);
          assert_equal_string "purpose" (List.nth parts 0).Fake_http.name;
          assert_equal_string "expires_after" (List.nth parts 1).Fake_http.name;
          assert_equal_string "file" (List.nth parts 2).Fake_http.name
      | _ -> failwith "expected xAI file multipart body")
  | None -> failwith "expected xAI file upload request");
  Fake_http.next_response_body :=
    "{\"data\":[{\"id\":\"file_123\",\"filename\":\"doc.pdf\",\"size\":12}],\"pagination_token\":\"next\"}";
  (match
     Client.list_files ~limit:10 ~order:"desc" ~sort_by:"created_at" config
   with
  | Error error -> failwith error.error_message
  | Ok files -> assert_equal_int 1 (List.length files.files));
  (match !Fake_http.last_request with
  | Some request -> assert_contains "limit=10" request.url
  | None -> failwith "expected list files request");
  Fake_http.next_response_body := "FILEDATA";
  (match Client.download_file config ~file_id:"file_123" with
  | Error error -> failwith error.error_message
  | Ok body -> assert_equal_string "FILEDATA" body);
  Fake_http.next_response_body := "MP4DATA";
  match Client.download_video config ~request_id:"vid_123" with
  | Error error -> failwith error.error_message
  | Ok body -> assert_equal_string "MP4DATA" body

let test_client_collections () =
  let management =
    Client.
      {
        management_api_key = "management-key";
        management_base_url = default_management_base_url;
        management_timeout_ms = Some 1_000;
      }
  in
  Fake_http.next_response_status := 200;
  Fake_http.next_response_body :=
    "{\"collection_id\":\"collection_123\",\"collection_name\":\"SEC \
     Filings\",\"collection_description\":\"Reports\",\"documents_count\":0,\"created_at\":\"2026-06-20T00:00:00Z\"}";
  (match
     Client.create_collection management
       {
         collection_name = "SEC Filings";
         collection_description = Some "Reports";
         collection_index_configuration = None;
         collection_field_definitions = [];
         collection_extra = [];
       }
   with
  | Error error -> failwith error.error_message
  | Ok collection ->
      assert_equal_string "collection_123" (Option.get collection.collection_id));
  (match !Fake_http.last_request with
  | Some request ->
      assert_contains "management-api.x.ai/v1/collections" request.url;
      if
        not
          (List.mem ("Authorization", "Bearer management-key") request.headers)
      then failwith "missing xAI management authorization"
  | None -> failwith "expected create collection request");
  Fake_http.next_response_body :=
    "{\"collections\":[{\"collection_id\":\"collection_123\",\"collection_name\":\"SEC \
     Filings\"}],\"pagination_token\":\"next\"}";
  (match
     Client.list_collections ~limit:10 ~filter:"collection_name:SEC" management
   with
  | Error error -> failwith error.error_message
  | Ok collections -> assert_equal_int 1 (List.length collections.collections));
  Fake_http.next_response_body :=
    "{\"file_metadata\":{\"id\":\"file_123\",\"filename\":\"doc.pdf\"},\"status\":\"DOCUMENT_STATUS_PROCESSING\",\"fields\":{\"ticker\":\"TSLA\"}}";
  (match
     Client.add_collection_document management ~collection_id:"collection_123"
       ~file_id:"file_123"
       ~fields:
         (Some
            (Chatoyant.Runtime.Json.Object
               [ ("ticker", Chatoyant.Runtime.Json.String "TSLA") ]))
   with
  | Error error -> failwith error.error_message
  | Ok document ->
      assert_equal_string "DOCUMENT_STATUS_PROCESSING"
        (Option.get document.document_status));
  (match !Fake_http.last_request with
  | Some request ->
      assert_contains "/collections/collection_123/documents/file_123"
        request.url
  | None -> failwith "expected add collection document request");
  Fake_http.next_response_body :=
    "{\"documents\":[{\"file_metadata\":{\"id\":\"file_123\"},\"status\":\"DOCUMENT_STATUS_PROCESSED\"}]}";
  (match
     Client.list_collection_documents management ~collection_id:"collection_123"
   with
  | Error error -> failwith error.error_message
  | Ok documents ->
      assert_equal_int 1 (List.length documents.collection_documents));
  Fake_http.next_response_body :=
    "{\"results\":[{\"file_id\":\"file_123\",\"score\":0.9}]}";
  match
    Client.search_collection management ~collection_id:"collection_123"
      {
        collection_search_query = "revenue";
        collection_search_limit = Some 3;
        collection_search_filter = None;
        collection_search_extra = [];
      }
  with
  | Error error -> failwith error.error_message
  | Ok response ->
      assert_equal_int 1 (List.length response.collection_search_results)

let () =
  test_chat_request_json ();
  test_chat_response_decode ();
  test_responses_api ();
  test_stream_chunks ();
  test_websocket_helpers ();
  test_image_and_video_requests ();
  test_image_and_video_response_decode ();
  test_voice_and_audio_requests ();
  test_batches ();
  test_client_and_provider ();
  test_client_batches ();
  test_client_responses_and_models ();
  test_client_voice_endpoints ();
  test_files_and_collections_json ();
  test_client_files_and_downloads ();
  test_client_collections ()
