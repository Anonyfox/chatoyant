let assert_equal_int expected actual =
  if expected <> actual then
    failwith (Printf.sprintf "expected %d, got %d" expected actual)

let assert_equal_string expected actual =
  if expected <> actual then
    failwith (Printf.sprintf "expected %S, got %S" expected actual)

let assert_equal_provider expected actual =
  if expected <> actual then failwith "provider mismatch"

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

module Fake_provider : Chatoyant.Provider.Provider.CHAT = struct
  let id = Chatoyant.Provider.Provider.Openai

  let generate messages options =
    if messages = [] then Error (Chatoyant.Provider.Provider.Runtime_error "missing messages")
    else
      Ok
        {
          Chatoyant.Provider.Provider.content = "fake";
          reasoning_content = "";
          usage =
            {
              Chatoyant.Tokens.Cost.empty_usage with
              input_tokens = 1_000;
              output_tokens = 500;
              total_tokens = 1_500;
            };
          usage_source = Chatoyant.Tokens.Cost.Provider_reported;
          tool_calls = [];
          finish_reason = Some "stop";
          raw = None;
        }
end

module Fake_tool_provider : Chatoyant.Provider.Provider.CHAT = struct
  let id = Chatoyant.Provider.Provider.Openai

  let has_tool_result =
    List.exists (fun (message : Chatoyant.Provider.Provider.message) ->
        message.role = Chatoyant.Provider.Provider.Tool)

  let generate messages options =
    if options.Chatoyant.Provider.Provider.tools = [] then
      Error (Chatoyant.Provider.Provider.Runtime_error "missing tool definitions")
    else if has_tool_result messages then
      Ok
        {
          Chatoyant.Provider.Provider.content = "weather: Berlin";
          reasoning_content = "";
          usage =
            {
              Chatoyant.Tokens.Cost.empty_usage with
              input_tokens = 3;
              output_tokens = 4;
              total_tokens = 7;
            };
          usage_source = Chatoyant.Tokens.Cost.Provider_reported;
          tool_calls = [];
          finish_reason = Some "stop";
          raw = None;
        }
    else
      Ok
        {
          Chatoyant.Provider.Provider.content = "";
          reasoning_content = "";
          usage =
            {
              Chatoyant.Tokens.Cost.empty_usage with
              input_tokens = 2;
              output_tokens = 1;
              total_tokens = 3;
            };
          usage_source = Chatoyant.Tokens.Cost.Provider_reported;
          tool_calls =
            [
              {
                Chatoyant.Provider.Provider.id = "call_weather";
                name = "weather";
                arguments =
                  Chatoyant.Runtime.Json.Object
                    [ ("city", Chatoyant.Runtime.Json.String "Berlin") ];
                arguments_json = "{\"city\":\"Berlin\"}";
                raw = None;
              };
            ];
          finish_reason = Some "tool_calls";
          raw = None;
        }
end

module Fake_clock = struct
  let value = ref 0

  let now_ms () =
    let current = !value in
    value := current + 25;
    current
end

module Fake_generator = Chatoyant.Core.Generator.Make (Fake_provider) (Fake_clock)
module Fake_session = Chatoyant.Core.Session.Make (Fake_provider) (Fake_clock)
module Fake_shortcuts = Chatoyant.Core.Shortcuts.Make (Fake_provider) (Fake_clock)
module Fake_tool_session = Chatoyant.Core.Session.Make (Fake_tool_provider) (Fake_clock)

module Fake_anthropic_http = struct
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

  type error =
    | Timeout of int
    | Network of string
    | Invalid_response of string

  let last_request : request option ref = ref None

  let send request =
    last_request := Some request;
    Ok
      {
        status = 200;
        headers = [ ("content-type", "application/json") ];
        body =
          "{\"id\":\"msg_1\",\"type\":\"message\",\"role\":\"assistant\",\"model\":\"claude-sonnet-4-6\",\"content\":[{\"type\":\"text\",\"text\":\"Hello from Claude\"}],\"stop_reason\":\"end_turn\",\"usage\":{\"input_tokens\":7,\"output_tokens\":3}}";
      }
end

module Anthropic_client = Chatoyant.Provider.Anthropic.Make_client (Fake_anthropic_http)

  let () =
  assert_equal_int 4 (Chatoyant.Tokens.Token_estimate.estimate "Hello, world!");
  let prompt_estimate = Chatoyant.Tokens.Token_estimate.estimate_prompt ~response:"Hi" "Hello" in
  assert_equal_int (prompt_estimate.input + prompt_estimate.output) prompt_estimate.total;
  assert_equal_int
    128_000
    (Option.get (Chatoyant.Tokens.Context_window.get "gpt-4o"));
  assert_equal_int 131_072 (Option.get (Chatoyant.Tokens.Context_window.get "grok-3"));
  if not (Chatoyant.Tokens.Pricing.has "gpt-5.4-mini") then failwith "missing pricing";
  if Chatoyant.Tokens.Pricing.has "gpt-99" then failwith "fallback pricing should not be explicit";
  (match Chatoyant.Tokens.Pricing.get "gpt-99" with
  | Some pricing when pricing.output_per_million > 0.0 -> ()
  | _ -> failwith "expected conservative pricing fallback");
  let usage =
    {
      Chatoyant.Tokens.Cost.empty_usage with
      input_tokens = 1_000;
      output_tokens = 500;
    }
  in
  let cost =
    Chatoyant.Tokens.Cost.calculate
      ~pricing:(Chatoyant.Tokens.Pricing.get "gpt-4o")
      usage
  in
  if cost.total <= 0.0 then failwith "expected positive cost";
  let custom_pricing =
    Chatoyant.Tokens.Cost.pricing ~input_per_million:10.0 ~output_per_million:20.0
      ~cache_write_per_million:12.5 ()
  in
  let custom_cost =
    Chatoyant.Tokens.Cost.calculate ~pricing:(Some custom_pricing)
      {
        Chatoyant.Tokens.Cost.empty_usage with
        input_tokens = 1_000_000;
        output_tokens = 0;
        cache_write_tokens = 250_000;
      }
  in
  if custom_cost.cache_write <= 0.0 then failwith "expected cache-write cost";
  let batch_cost =
    Chatoyant.Tokens.Cost.calculate_batch ~pricing:(Chatoyant.Tokens.Pricing.get "gpt-4o")
      [
        { Chatoyant.Tokens.Cost.empty_usage with input_tokens = 100; output_tokens = 50 };
        { Chatoyant.Tokens.Cost.empty_usage with input_tokens = 200; output_tokens = 100 };
      ]
  in
  if batch_cost.total <= 0.0 then failwith "expected batch cost";
  let image_cost =
    Chatoyant.Tokens.Cost.calculate_image
      ~pricing:(Chatoyant.Tokens.Pricing.get "grok-imagine-image")
      ~count:4
  in
  if abs_float (image_cost -. 0.08) > 0.000001 then failwith "bad image cost";
  let messages =
    [
      { Chatoyant.Tokens.Message_budget.role = "system"; content = Some "You are helpful"; name = None };
      { role = "user"; content = Some "Hello"; name = None };
      { role = "assistant"; content = Some "Hi"; name = None };
    ]
  in
  assert_equal_int 0 (Chatoyant.Tokens.Message_budget.estimate_chat []);
  let overhead = Chatoyant.Tokens.Message_budget.get_overhead () in
  assert_equal_int 4 overhead.per_message;
  assert_equal_int 3 overhead.conversation;
  assert_equal_int
    2400
    (Chatoyant.Tokens.Message_budget.available_tokens ~context_window:4000
       ~system_prompt_tokens:100 ~reserve_for_response:500 ~history_tokens:1000 ());
  if not (Chatoyant.Tokens.Message_budget.fits ~max_tokens:100 messages) then
    failwith "messages should fit";
  let chunks =
    Chatoyant.Tokens.Chunking.split_text ~max_tokens:10 ("Word " ^ String.make 200 'a')
  in
  if chunks = [] then failwith "expected chunks";
  let pages = Chatoyant.Tokens.Chunking.paginate_messages ~tokens_per_page:20 messages in
  if pages = [] then failwith "expected message pages";
  let truncated = Chatoyant.Tokens.Chunking.truncate_content ~max_tokens:1 "Hello world" in
  assert_contains "..." truncated;
  let merged_options =
    Chatoyant.Core.Options.merge
      { Chatoyant.Core.Options.default with extra = Some (Chatoyant.Runtime.Json.Object [ ("a", Chatoyant.Runtime.Json.Float 1.0) ]) }
      {
        Chatoyant.Core.Options.default with
        top_p = Some 0.9;
        stop = [ "END" ];
        extra = Some (Chatoyant.Runtime.Json.Object [ ("b", Chatoyant.Runtime.Json.Float 2.0) ]);
      }
  in
  if merged_options.top_p <> Some 0.9 || merged_options.stop <> [ "END" ] then
    failwith "option merge lost scalar fields";
  let merged_extra = Chatoyant.Runtime.Json.to_string (Option.get merged_options.extra) in
  assert_contains "\"a\":1" merged_extra;
  assert_contains "\"b\":2" merged_extra;
  let sse_state, events =
    Chatoyant.Runtime.Sse.feed Chatoyant.Runtime.Sse.empty "data: {\"a\":"
  in
  assert_equal_int 0 (List.length events);
  let sse_state, events = Chatoyant.Runtime.Sse.feed sse_state "1}\n\ndata: [DONE]\n\n" in
  ignore sse_state;
  assert_equal_int 2 (List.length events);
  assert_contains "{\"a\":1}" (Chatoyant.Runtime.Sse.data_string (List.hd events));
  if not (Chatoyant.Runtime.Sse.is_done (List.nth events 1)) then failwith "expected done event";

  let open Chatoyant.Core in
  let chat = Chat.create ~model:"gpt-4o" () |> Chat.system "You are helpful" |> Chat.user "Hi" in
  assert_equal_string "gpt-4o" (Chat.model chat);
  assert_equal_int 2 (List.length (Chat.messages chat));
  (match Fake_generator.generate chat with
  | Error _ -> failwith "fake generation failed"
  | Ok result ->
      assert_equal_string "fake" result.content;
      assert_equal_int 25 result.timing.latency_ms;
      assert_equal_int 500 result.token_speed.measured_output_tokens;
      (match result.token_speed.output_tokens_per_second with
      | Some speed when speed > 19_999.0 && speed < 20_001.0 -> ()
      | _ -> failwith "expected exact token speed from reported usage");
      if result.usage_source <> Chatoyant.Tokens.Cost.Provider_reported then
        failwith "expected provider reported usage";
      assert_equal_string "stop" (Option.get result.finish_reason);
      let result_json = Chatoyant.Core.Result.generation_to_json result |> Chatoyant.Runtime.Json.to_string in
      assert_contains "\"usage_source\":\"provider_reported\"" result_json;
      assert_contains "\"output_tokens_per_second\"" result_json);
  let session =
    Fake_session.create ~model:"gpt-4o" ()
    |> Fake_session.system "You are helpful"
    |> Fake_session.user "Hi"
  in
  assert_equal_string "gpt-4o" (Fake_session.model session);
  ignore (Fake_session.set_model "gpt-4o-mini" session);
  assert_equal_string "gpt-4o-mini" (Fake_session.model session);
  (match Fake_session.generate_with_result session with
  | Error _ -> failwith "session generation failed"
  | Ok result ->
      assert_equal_string "fake" result.content;
      assert_equal_int 3 (List.length (Fake_session.messages session));
      assert_equal_string "fake" (Option.get (Fake_session.last_result session)).content);
  let session_json = Fake_session.to_json session |> Chatoyant.Runtime.Json.to_string in
  assert_contains "\"model\":\"gpt-4o-mini\"" session_json;
  assert_contains "\"lastResult\"" session_json;
  let restored =
    match Chatoyant.Runtime.Json.parse session_json with
    | Error message -> failwith message
    | Ok json -> (
        match Fake_session.of_json json with
        | Error message -> failwith message
        | Ok restored -> restored)
  in
  assert_equal_string "gpt-4o-mini" (Fake_session.model restored);
  assert_equal_int 3 (List.length (Fake_session.messages restored));
  let forked = Fake_session.fork session in
  if Fake_session.last_result forked <> None then failwith "fork should clear last result";
  let cloned = Fake_session.clone session in
  assert_equal_int (List.length (Fake_session.messages session)) (List.length (Fake_session.messages cloned));
  (match Fake_shortcuts.gen_text ~system:"You are concise" ~model:"gpt-4o" "Hello" with
  | Error _ -> failwith "shortcut gen_text failed"
  | Ok text -> assert_equal_string "fake" text);
  let tool_params =
    Chatoyant.Schema.Schema.object_ [ ("city", Chatoyant.Schema.Schema.string ()) ]
  in
  let weather_tool =
    Tool.create ~name:"weather" ~description:"Get weather" ~parameters:tool_params
      (fun _ctx args -> Ok args)
  in
  let chat_with_tool = Chat.add_tool weather_tool chat in
  assert_equal_int 1 (List.length (Chat.tools chat_with_tool));
  let tool_result =
    Tool.execute_call
      { model = "gpt-4o"; provider = Chatoyant.Provider.Provider.Openai }
      {
        id = "call_1";
        name = "weather";
        arguments =
          Chatoyant.Runtime.Json.Object [ ("city", Chatoyant.Runtime.Json.String "Berlin") ];
      }
      weather_tool
  in
  if not tool_result.ok then failwith "tool should succeed";
  let tool_result_json = Tool.result_to_json tool_result |> Chatoyant.Runtime.Json.to_string in
  assert_contains "\"ok\":true" tool_result_json;
  let tool_loop_session =
    Fake_tool_session.create ~model:"gpt-4o" ()
    |> Fake_tool_session.user "What is the weather?"
    |> Fake_tool_session.add_tool weather_tool
  in
  (match Fake_tool_session.generate_with_result tool_loop_session with
  | Error _ -> failwith "tool orchestration failed"
  | Ok result ->
      assert_equal_string "weather: Berlin" result.content;
      assert_equal_int 2 result.iterations;
      assert_equal_int 10 result.usage.total_tokens;
      assert_equal_int 1 (List.length result.tool_calls);
      let messages = Fake_tool_session.messages tool_loop_session in
      assert_equal_int 4 (List.length messages);
      if not (Chatoyant.Core.Message.has_tool_calls (List.nth messages 1)) then
        failwith "assistant tool call was not recorded";
      (match List.nth messages 2 with
      | { Chatoyant.Core.Message.role = Tool; tool_result_error = Some false; content; _ } ->
          assert_contains "\"ok\":true" content
      | _ -> failwith "tool result message was not recorded"));
  let message_json =
    Chatoyant.Core.Message.to_json
      (Chatoyant.Core.Message.assistant "Use a tool"
      |> fun message ->
      {
        message with
        tool_calls = [ { id = "call_1"; name = "weather"; arguments_json = "{\"city\":\"Berlin\"}" } ];
      })
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"tool_calls\"" message_json;
  let bad_tool_result =
    Tool.execute_call
      { model = "gpt-4o"; provider = Chatoyant.Provider.Provider.Openai }
      { id = "call_2"; name = "weather"; arguments = Chatoyant.Runtime.Json.Object [] }
      weather_tool
  in
  if bad_tool_result.ok then failwith "tool should reject invalid args";

  let schema =
    Chatoyant.Schema.Schema.object_
      [
        ("name", Chatoyant.Schema.Schema.string ());
        ("age", Chatoyant.Schema.Schema.integer ());
        ("email", Chatoyant.Schema.Schema.string ~optional:true ());
      ]
  in
  let json = Chatoyant.Schema.Schema.to_json_schema schema |> Chatoyant.Runtime.Json.to_string in
  if not (String.contains json '{') then failwith "schema did not encode to an object";
  let valid_user =
    Chatoyant.Runtime.Json.Object
      [
        ("name", Chatoyant.Runtime.Json.String "Ada");
        ("age", Chatoyant.Runtime.Json.Float 36.0);
        ("email", Chatoyant.Runtime.Json.Null);
      ]
  in
  (match Chatoyant.Schema.Value.validate schema valid_user with
  | Ok () -> ()
  | Error error -> failwith (Chatoyant.Schema.Value.error_to_string error));
  let invalid_user =
    Chatoyant.Runtime.Json.Object [ ("name", Chatoyant.Runtime.Json.String "Ada") ]
  in
  (match Chatoyant.Schema.Value.validate schema invalid_user with
  | Ok () -> failwith "expected schema validation failure"
  | Error error -> assert_contains "age" (Chatoyant.Schema.Value.error_to_string error));

  assert_equal_provider
    Chatoyant.Provider.Provider.Openrouter
    (Option.get (Chatoyant.Provider.Registry.detect_by_model "anthropic/claude-opus-4"));
  assert_equal_provider
    Chatoyant.Provider.Provider.Openai
    (Option.get (Chatoyant.Provider.Registry.detect_by_model "gpt-4o"));
  assert_equal_provider
    Chatoyant.Provider.Provider.Anthropic
    (Option.get (Chatoyant.Provider.Registry.detect_by_model "claude-sonnet-4-6"));
  assert_equal_provider
    Chatoyant.Provider.Provider.Xai
    (Option.get (Chatoyant.Provider.Registry.detect_by_model "grok-4"));
  assert_equal_provider
    Chatoyant.Provider.Provider.Local
    (Option.get (Chatoyant.Provider.Registry.resolve_by_model ~local_active:true "Qwen3-4B-MLX"));

  assert_equal_string
    "gpt-5.4-mini"
    (Option.get
       (Chatoyant.Core.Preset.resolve_model_preset
          ~provider:Chatoyant.Provider.Provider.Openai
          Chatoyant.Core.Preset.Balanced));
  assert_equal_string
    "grok-4-1-fast-reasoning"
    (Chatoyant.Core.Preset.adjust_xai_model_for_reasoning
       ~prefer_reasoning:true
       "grok-4-1-fast-non-reasoning");

  let open Chatoyant.Provider.Openai in
  let tool_schema =
    Chatoyant.Runtime.Json.Object
      [
        ("type", Chatoyant.Runtime.Json.String "object");
        ("properties", Chatoyant.Runtime.Json.Object []);
      ]
  in
  let chat_body =
    chat_request_json
      {
        chat_model = "gpt-5.4";
        chat_messages =
          [
            {
              message_role = User;
              message_content = Some "Hello";
              message_name = None;
              message_tool_call_id = None;
              message_tool_calls = [];
            };
          ];
        chat_stream = false;
        chat_temperature = Some 0.7;
        chat_max_tokens = Some 128;
        chat_top_p = None;
        chat_stop = [];
        chat_user = None;
        chat_seed = None;
        chat_logprobs = None;
        chat_top_logprobs = None;
        chat_n = None;
        chat_tools =
          [
            {
              tool_name = "lookup";
              tool_description = Some "Lookup data";
              tool_parameters = tool_schema;
              tool_strict = Some true;
            };
          ];
        chat_tool_choice = None;
        chat_parallel_tool_calls = None;
        chat_response_format =
          Some
            (Json_schema
               {
                 schema_name = "answer";
                 schema_description = None;
                 schema_value = tool_schema;
                 schema_strict = true;
               });
        chat_extra = [];
      }
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"tools\"" chat_body;
  assert_contains "\"response_format\"" chat_body;
  assert_contains "\"json_schema\"" chat_body;

  let responses_body =
    responses_request_json
      {
        responses_model = "gpt-5.4";
        responses_input = Input_text "Hello";
        responses_instructions = None;
        responses_previous_response_id = None;
        responses_store = None;
        responses_stream = true;
        responses_temperature = None;
        responses_top_p = None;
        responses_max_output_tokens = None;
        responses_reasoning = None;
        responses_tools = [];
        responses_tool_choice = None;
        responses_text_format =
          Some
            (Responses_json_schema
               {
                 response_schema_name = "answer";
                 response_schema_description = None;
                 response_schema_value = tool_schema;
                 response_schema_strict = true;
               });
        responses_parallel_tool_calls = None;
        responses_truncation = None;
        responses_metadata = [];
        responses_extra = [];
      }
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"input\":\"Hello\"" responses_body;
  assert_contains "\"text\"" responses_body;
  assert_contains "\"format\"" responses_body;
  assert_contains "\"json_schema\"" responses_body;
  let openai_chunk =
    Chatoyant.Runtime.Json.Object
      [
        ( "choices",
          Chatoyant.Runtime.Json.Array
            [
              Chatoyant.Runtime.Json.Object
                [
                  ( "delta",
                    Chatoyant.Runtime.Json.Object
                      [
                        ("content", Chatoyant.Runtime.Json.String "Hel");
                        ("reasoning_content", Chatoyant.Runtime.Json.String "Think");
                      ] );
                  ("finish_reason", Chatoyant.Runtime.Json.Null);
                ];
            ] );
      ]
  in
  let openai_done_chunk =
    Chatoyant.Runtime.Json.Object
      [
        ( "choices",
          Chatoyant.Runtime.Json.Array
            [
              Chatoyant.Runtime.Json.Object
                [
                  ( "delta",
                    Chatoyant.Runtime.Json.Object [ ("content", Chatoyant.Runtime.Json.String "lo") ] );
                  ("finish_reason", Chatoyant.Runtime.Json.String "stop");
                ];
            ] );
        ("usage", Chatoyant.Runtime.Json.Object [ ("total_tokens", Chatoyant.Runtime.Json.Float 3.0) ]);
      ]
  in
  let accumulated =
    Chatoyant.Provider.Openai_stream.empty
    |> fun acc -> Chatoyant.Provider.Openai_stream.apply_chunk_json acc openai_chunk
    |> fun acc -> Chatoyant.Provider.Openai_stream.apply_chunk_json acc openai_done_chunk
  in
  assert_equal_string "Hello" accumulated.accumulated_content;
  assert_equal_string "Think" accumulated.accumulated_reasoning_content;
  assert_equal_string "stop" (Option.get accumulated.accumulated_finish_reason);
  let chat_response_json =
    Chatoyant.Runtime.Json.Object
      [
        ( "choices",
          Chatoyant.Runtime.Json.Array
            [
              Chatoyant.Runtime.Json.Object
                [
                  ( "message",
                    Chatoyant.Runtime.Json.Object
                      [ ("content", Chatoyant.Runtime.Json.String "decoded chat") ] );
                ];
            ] );
        ( "usage",
          Chatoyant.Runtime.Json.Object
            [
              ("prompt_tokens", Chatoyant.Runtime.Json.Float 2.0);
              ("completion_tokens", Chatoyant.Runtime.Json.Float 3.0);
              ("total_tokens", Chatoyant.Runtime.Json.Float 5.0);
            ] );
      ]
  in
  assert_equal_string
    "decoded chat"
    (Option.get (Chatoyant.Provider.Openai_decode.chat_content chat_response_json));
  let responses_json =
    Chatoyant.Runtime.Json.Object
      [
        ("output_text", Chatoyant.Runtime.Json.String "decoded response");
        ( "usage",
          Chatoyant.Runtime.Json.Object
            [
              ("input_tokens", Chatoyant.Runtime.Json.Float 2.0);
              ("output_tokens", Chatoyant.Runtime.Json.Float 3.0);
            ] );
      ]
  in
  assert_equal_string
    "decoded response"
    (Chatoyant.Provider.Openai_decode.responses_output_text responses_json);
  let usage_json =
    Chatoyant.Runtime.Json.Object
      [
        ("prompt_tokens", Chatoyant.Runtime.Json.Float 10.0);
        ("completion_tokens", Chatoyant.Runtime.Json.Float 5.0);
        ("total_tokens", Chatoyant.Runtime.Json.Float 15.0);
        ( "completion_tokens_details",
          Chatoyant.Runtime.Json.Object [ ("reasoning_tokens", Chatoyant.Runtime.Json.Float 2.0) ] );
        ( "prompt_tokens_details",
          Chatoyant.Runtime.Json.Object [ ("cached_tokens", Chatoyant.Runtime.Json.Float 3.0) ] );
      ]
  in
  let decoded_usage = Chatoyant.Provider.Usage.openai_compatible usage_json in
  assert_equal_int 10 decoded_usage.input_tokens;
  assert_equal_int 2 decoded_usage.reasoning_tokens;
  let xai_usage =
    Chatoyant.Provider.Usage.xai
      (Chatoyant.Runtime.Json.Object
         [
           ("prompt_tokens", Chatoyant.Runtime.Json.Float 1.0);
           ("completion_tokens", Chatoyant.Runtime.Json.Float 1.0);
           ("total_tokens", Chatoyant.Runtime.Json.Float 2.0);
           ("cost_in_usd_ticks", Chatoyant.Runtime.Json.Float 10_000_000_000.0);
         ])
  in
  if Option.get xai_usage.actual_cost_usd <> 1.0 then failwith "bad xAI cost ticks";
  let openrouter_usage =
    Chatoyant.Provider.Usage.openrouter
      (Chatoyant.Runtime.Json.Object
         [
           ("prompt_tokens", Chatoyant.Runtime.Json.Float 1.0);
           ("completion_tokens", Chatoyant.Runtime.Json.Float 1.0);
           ("total_tokens", Chatoyant.Runtime.Json.Float 2.0);
           ("cost", Chatoyant.Runtime.Json.Float 2.0);
         ])
  in
  if Option.get openrouter_usage.actual_cost_usd <> 0.000002 then
    failwith "bad OpenRouter credits";
  let normalized_usage =
    Chatoyant.Tokens.Cost.normalize_total
      { Chatoyant.Tokens.Cost.empty_usage with input_tokens = 4; output_tokens = 6 }
  in
  assert_equal_int 10 normalized_usage.total_tokens;
  let usage_json = Chatoyant.Tokens.Cost.usage_to_json normalized_usage |> Chatoyant.Runtime.Json.to_string in
  assert_contains "\"total_tokens\":10" usage_json;

  let stream_state =
    Chatoyant.Core.Stream.empty
    |> Chatoyant.Core.Stream.note_first_token ~now_ms:125
    |> fun state ->
    Chatoyant.Core.Stream.apply state
      {
        content_delta = Some "Hel";
        reasoning_delta = Some "Think";
        tool_call_deltas =
          [
            {
              index = 0;
              id = Some "call_1";
              name = Some "weather";
              arguments_delta = "{\"city\":\"Ber";
              raw = None;
            };
          ];
        usage = None;
        usage_source = Chatoyant.Tokens.Cost.Unknown;
        finish_reason = None;
        raw = None;
      }
    |> fun state ->
    Chatoyant.Core.Stream.apply state
      {
        content_delta = Some "lo";
        reasoning_delta = Some "ing";
        tool_call_deltas =
          [
            {
              index = 0;
              id = None;
              name = None;
              arguments_delta = "lin\"}";
              raw = None;
            };
          ];
        usage =
          Some
            {
              Chatoyant.Tokens.Cost.empty_usage with
              input_tokens = 10;
              output_tokens = 5;
              total_tokens = 15;
            };
        usage_source = Chatoyant.Tokens.Cost.Provider_reported;
        finish_reason = Some "tool_calls";
        raw = None;
      }
  in
  assert_equal_string "Hello" (Chatoyant.Core.Stream.content stream_state);
  assert_equal_string "Thinking" (Chatoyant.Core.Stream.reasoning_content stream_state);
  let unified_tool_call = List.hd (Chatoyant.Core.Stream.tool_calls stream_state) in
  assert_equal_string "weather" unified_tool_call.name;
  assert_equal_string "{\"city\":\"Berlin\"}" unified_tool_call.arguments_json;
  let streamed_generation =
    Chatoyant.Core.Stream.to_generation
      ~provider:Chatoyant.Provider.Provider.Openai
      ~model:"gpt-4o"
      ~started_ms:100
      ~finished_ms:600
      stream_state
  in
  assert_equal_int 25 (Option.get streamed_generation.timing.time_to_first_token_ms);
  assert_equal_int 5 streamed_generation.token_speed.measured_output_tokens;
  (match streamed_generation.token_speed.output_tokens_per_second with
  | Some speed when speed > 9.99 && speed < 10.01 -> ()
  | _ -> failwith "expected streamed token speed");
  assert_equal_string "tool_calls" (Option.get streamed_generation.finish_reason);
  let stream_json = Chatoyant.Core.Stream.state_to_json stream_state |> Chatoyant.Runtime.Json.to_string in
  assert_contains "\"usage_source\":\"provider_reported\"" stream_json;
  assert_contains "\"arguments_json\":\"{\\\"city\\\":\\\"Berlin\\\"}\"" stream_json;

  let anthropic_body =
    Chatoyant.Provider.Anthropic.request_json
      {
        model = "claude-sonnet-4-6";
        system = Some "You are helpful";
        system_blocks = [];
        messages =
          [
            {
              message_role = Chatoyant.Provider.Anthropic.User;
              message_content = [ Chatoyant.Provider.Anthropic.Text "Hello" ];
            };
          ];
        max_tokens = 4096;
        stream = true;
        temperature = Some 0.2;
        top_p = None;
        top_k = Some 50;
        stop_sequences = [ "END" ];
        metadata_user_id = Some "user_123";
        tools =
          [
            {
              tool_name = "lookup";
              tool_description = Some "Lookup data";
              input_schema = tool_schema;
              tool_cache_control = None;
            };
          ];
        tool_choice = Some (Chatoyant.Provider.Anthropic.Tool "lookup");
        thinking = Some (Enabled { budget_tokens = 2048 });
        cache_control = None;
        extra = [];
      }
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"system\":\"You are helpful\"" anthropic_body;
  assert_contains "\"input_schema\"" anthropic_body;
  assert_contains "\"thinking\"" anthropic_body;
  assert_contains "\"tool_choice\"" anthropic_body;
  assert_contains "\"metadata\"" anthropic_body;
  let anthropic_response_json =
    Chatoyant.Runtime.Json.Object
      [
        ("id", Chatoyant.Runtime.Json.String "msg_1");
        ("role", Chatoyant.Runtime.Json.String "assistant");
        ("model", Chatoyant.Runtime.Json.String "claude-sonnet-4-6");
        ( "content",
          Chatoyant.Runtime.Json.Array
            [
              Chatoyant.Runtime.Json.Object
                [
                  ("type", Chatoyant.Runtime.Json.String "text");
                  ("text", Chatoyant.Runtime.Json.String "Hello");
                ];
              Chatoyant.Runtime.Json.Object
                [
                  ("type", Chatoyant.Runtime.Json.String "tool_use");
                  ("id", Chatoyant.Runtime.Json.String "toolu_1");
                  ("name", Chatoyant.Runtime.Json.String "lookup");
                  ("input", Chatoyant.Runtime.Json.Object [ ("query", Chatoyant.Runtime.Json.String "x") ]);
                ];
            ] );
        ("stop_reason", Chatoyant.Runtime.Json.String "tool_use");
        ( "usage",
          Chatoyant.Runtime.Json.Object
            [
              ("input_tokens", Chatoyant.Runtime.Json.Float 11.0);
              ("output_tokens", Chatoyant.Runtime.Json.Float 7.0);
            ] );
      ]
  in
  let anthropic_response =
    Chatoyant.Provider.Anthropic.response_of_json anthropic_response_json
  in
  assert_equal_int 2 (List.length anthropic_response.response_content);
  assert_equal_int 11 anthropic_response.response_usage.input_tokens;
  let error_json =
    Chatoyant.Runtime.Json.Object
      [
        ( "error",
          Chatoyant.Runtime.Json.Object
            [
              ("type", Chatoyant.Runtime.Json.String "invalid_request_error");
              ("message", Chatoyant.Runtime.Json.String "bad request");
            ] );
      ]
  in
  let api_error = Chatoyant.Provider.Anthropic.api_error_of_json error_json in
  assert_equal_string "bad request" api_error.error_message;
  let start_sse =
    {
      Chatoyant.Runtime.Sse.event = Some "message_start";
      data =
        [
          "{\"type\":\"message_start\",\"message\":{\"id\":\"msg_stream\",\"type\":\"message\",\"role\":\"assistant\",\"model\":\"claude-sonnet-4-6\",\"content\":[],\"usage\":{\"input_tokens\":4,\"output_tokens\":0}}}";
        ];
    }
  in
  let block_sse =
    {
      Chatoyant.Runtime.Sse.event = Some "content_block_start";
      data = [ "{\"type\":\"content_block_start\",\"index\":0,\"content_block\":{\"type\":\"text\",\"text\":\"\"}}" ];
    }
  in
  let delta_sse =
    {
      Chatoyant.Runtime.Sse.event = Some "content_block_delta";
      data = [ "{\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"Hi\"}}" ];
    }
  in
  let stop_sse =
    {
      Chatoyant.Runtime.Sse.event = Some "message_delta";
      data =
        [
          "{\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"end_turn\",\"stop_sequence\":null},\"usage\":{\"output_tokens\":2}}";
        ];
    }
  in
  let stream_state =
    List.fold_left
      (fun state sse ->
        match Chatoyant.Provider.Anthropic.stream_event_of_sse sse with
        | Error message -> failwith message
        | Ok event -> Chatoyant.Provider.Anthropic.apply_stream_event state event)
      Chatoyant.Provider.Anthropic.empty_stream_state
      [ start_sse; block_sse; delta_sse; stop_sse ]
  in
  let stream_response = Chatoyant.Provider.Anthropic.stream_state_to_response stream_state in
  (match stream_response.response_content with
  | Chatoyant.Provider.Anthropic.Text text :: _ -> assert_equal_string "Hi" text
  | _ -> failwith "expected streamed text block");
  assert_equal_int 2 stream_response.response_usage.output_tokens;
  let raw_stream_response =
    Chatoyant.Provider.Anthropic.response_of_stream_chunks
      [
        "event: message_start\ndata: {\"type\":\"message_start\",\"message\":{\"id\":\"msg_stream\",\"type\":\"message\",\"role\":\"assistant\",\"model\":\"claude-sonnet-4-6\",\"content\":[],\"usage\":{\"input_tokens\":4,\"output_tokens\":0}}}\n\n";
        "event: content_block_start\ndata: {\"type\":\"content_block_start\",\"index\":0,\"content_block\":{\"type\":\"text\",\"text\":\"\"}}\n\n";
        "event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"Hel";
        "lo\"}}\n\n";
        "event: message_delta\ndata: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"end_turn\"},\"usage\":{\"output_tokens\":2}}\n\n";
      ]
  in
  (match raw_stream_response with
  | Error message -> failwith message
  | Ok response -> (
      match response.response_content with
      | Chatoyant.Provider.Anthropic.Text text :: _ -> assert_equal_string "Hello" text
      | _ -> failwith "expected raw streamed text"));
  let client_request =
    {
      Chatoyant.Provider.Anthropic.model = "claude-sonnet-4-6";
      system = None;
      system_blocks = [];
      messages =
        [
          {
            message_role = Chatoyant.Provider.Anthropic.User;
            message_content = [ Chatoyant.Provider.Anthropic.Text "Hello" ];
          };
        ];
      max_tokens = 128;
      stream = false;
      temperature = None;
      top_p = None;
      top_k = None;
      stop_sequences = [];
      metadata_user_id = None;
      tools = [];
      tool_choice = None;
      thinking = None;
      cache_control = None;
      extra = [];
    }
  in
  let client_config =
    {
      Anthropic_client.api_key = "test-key";
      base_url = Anthropic_client.default_base_url;
      timeout_ms = Some 1_000;
      beta_headers = [ "fine-grained-tool-streaming-2025-05-14" ];
    }
  in
  (match Anthropic_client.create_message client_config client_request with
  | Error error -> failwith error.error_message
  | Ok response -> (
      match response.response_content with
      | Chatoyant.Provider.Anthropic.Text text :: _ ->
          assert_equal_string "Hello from Claude" text
      | _ -> failwith "expected client text response"));
  (match !(Fake_anthropic_http.last_request) with
  | None -> failwith "Anthropic client did not send request"
  | Some request ->
      assert_equal_string "POST" request.method_;
      assert_contains "/messages" request.url;
      if not (List.mem ("anthropic-beta", "fine-grained-tool-streaming-2025-05-14") request.headers)
      then failwith "missing anthropic beta header");
  let module Anthropic_provider = Chatoyant.Provider.Anthropic.Make_provider (Fake_anthropic_http) (struct
    let api_key = "test-key"
    let base_url = Anthropic_client.default_base_url
    let timeout_ms = Some 1_000
    let beta_headers = []
  end) in
  (match
     Anthropic_provider.generate
       [
         {
           Chatoyant.Provider.Provider.role = User;
           content = Some "Hello";
           name = None;
           tool_call_id = None;
           tool_calls = [];
           tool_result_error = None;
         };
       ]
       {
         Chatoyant.Provider.Provider.model = "claude-sonnet-4-6";
         temperature = None;
         max_tokens = Some 128;
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
  | Error _ -> failwith "Anthropic provider adapter failed"
  | Ok generation -> assert_equal_string "Hello from Claude" generation.content);

  let xai_body =
    Chatoyant.Provider.Xai.chat_request_json
      {
        chat_model = "grok-4-1-fast-non-reasoning";
        chat_messages =
          [
            {
              message_role = Chatoyant.Provider.Xai.User;
              message_content = Some "Search please";
              message_name = None;
              message_tool_call_id = None;
              message_tool_calls = [];
            };
          ];
        chat_stream = false;
        chat_temperature = None;
        chat_max_tokens = None;
        chat_top_p = None;
        chat_stop = [];
        chat_user = None;
        chat_seed = None;
        chat_logprobs = None;
        chat_top_logprobs = None;
        chat_n = None;
        chat_response_format = None;
        chat_tools = [ Chatoyant.Provider.Xai.Web_search ];
        chat_tool_choice = None;
        chat_parallel_tool_calls = None;
        chat_extra = [];
      }
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"web_search\"" xai_body;

  let openrouter_headers =
    Chatoyant.Provider.Openrouter.authorization_headers
      ~api_key:"key"
      ~http_referer:"https://example.com"
      ~title:"Chatoyant"
      ()
  in
  if not (List.mem ("X-Title", "Chatoyant") openrouter_headers) then
    failwith "missing OpenRouter title header";
  let local_headers = Chatoyant.Provider.Local.authorization_headers () in
  if not (List.mem ("Authorization", "Bearer local") local_headers) then
    failwith "missing local auth header"
