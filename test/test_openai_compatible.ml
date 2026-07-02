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

let assert_not_contains needle text =
  if contains_substring needle text then
    failwith (Printf.sprintf "expected %S not to contain %S" text needle)

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
      "{\"id\":\"chatcmpl_compat\",\"model\":\"local-model\",\"choices\":[{\"message\":{\"role\":\"assistant\",\"content\":\"Hello \
       compatible\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":3,\"completion_tokens\":2,\"total_tokens\":5}}"

  let send request =
    last_request := Some request;
    Ok
      {
        status = !next_response_status;
        headers = [];
        body = !next_response_body;
      }
end

module Local_client = Chatoyant.Provider.Local.Make_client (Fake_http)
module Openrouter_client = Chatoyant.Provider.Openrouter.Make_client (Fake_http)

let schema =
  Chatoyant.Runtime.Json.Object
    [
      ("type", Chatoyant.Runtime.Json.String "object");
      ("properties", Chatoyant.Runtime.Json.Object []);
    ]

let request_fixture () =
  Chatoyant.Provider.Openai.
    {
      chat_model = "Qwen3-4B-MLX";
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
      chat_stream = true;
      chat_temperature = Some 0.2;
      chat_max_tokens = Some 64;
      chat_top_p = Some 0.9;
      chat_stop = [ "END" ];
      chat_user = Some "user_should_strip_for_local";
      chat_seed = Some 7;
      chat_logprobs = Some true;
      chat_top_logprobs = Some 2;
      chat_n = Some 1;
      chat_tools =
        [
          {
            tool_name = "lookup";
            tool_description = Some "Lookup data";
            tool_parameters = schema;
            tool_strict = Some true;
          };
        ];
      chat_tool_choice = Some Auto;
      chat_parallel_tool_calls = Some false;
      chat_response_format =
        Some
          (Json_schema
             {
               schema_name = "answer";
               schema_description = None;
               schema_value = schema;
               schema_strict = true;
             });
      chat_extra = [];
    }

let test_local_normalization () =
  let body =
    request_fixture () |> Chatoyant.Provider.Local.chat_request_json
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"model\":\"Qwen3-4B-MLX\"" body;
  assert_contains "\"tools\"" body;
  assert_contains "\"response_format\"" body;
  assert_contains "\"seed\":7" body;
  assert_not_contains "\"logprobs\"" body;
  assert_not_contains "\"top_logprobs\"" body;
  assert_not_contains "\"parallel_tool_calls\"" body;
  assert_not_contains "\"user\":\"" body;
  assert_not_contains "user_should_strip_for_local" body;
  let headers = Chatoyant.Provider.Local.authorization_headers () in
  if not (List.mem ("Authorization", "Bearer local") headers) then
    failwith "missing default local auth header"

let test_local_think_stream () =
  match
    Chatoyant.Provider.Local.chat_response_of_stream_chunks
      [
        "data: {\"choices\":[{\"delta\":{\"content\":\"Visible <thi\"}}]}\n\n";
        "data: {\"choices\":[{\"delta\":{\"content\":\"nk>secret</thi\"}}]}\n\n";
        "data: {\"choices\":[{\"delta\":{\"content\":\"nk> \
         text\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":2,\"completion_tokens\":3,\"total_tokens\":5}}\n\n";
        "data: [DONE]\n\n";
      ]
  with
  | Error message -> failwith message
  | Ok response ->
      assert_equal_string "Visible  text" response.chat_response_content;
      assert_equal_string "secret" response.chat_response_reasoning_content;
      assert_equal_int 5 response.chat_response_usage.total_tokens

let test_clients () =
  let local_config =
    Local_client.
      {
        base_url = "http://127.0.0.1:11434/v1";
        api_key = None;
        timeout_ms = Some 1_000;
        headers = [];
      }
  in
  (match Local_client.create_chat local_config (request_fixture ()) with
  | Error error -> failwith error.error_message
  | Ok response ->
      assert_equal_string "Hello compatible" response.chat_response_content);
  (match !Fake_http.last_request with
  | None -> failwith "expected local request"
  | Some request ->
      assert_contains "http://127.0.0.1:11434/v1/chat/completions" request.url;
      if not (List.mem ("Authorization", "Bearer local") request.headers) then
        failwith "missing local auth header");
  Fake_http.next_response_body :=
    "{\"id\":\"chatcmpl_or\",\"model\":\"anthropic/claude-sonnet-4.5\",\"choices\":[{\"message\":{\"role\":\"assistant\",\"content\":\"Hello \
     OpenRouter\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":1,\"completion_tokens\":1,\"total_tokens\":2,\"cost\":2.0}}";
  let openrouter_config =
    Openrouter_client.
      {
        api_key = "or-key";
        timeout_ms = Some 1_000;
        http_referer = Some "https://example.com";
        title = Some "Chatoyant";
        headers = [];
      }
  in
  (match
     Openrouter_client.create_chat openrouter_config (request_fixture ())
   with
  | Error error -> failwith error.error_message
  | Ok response ->
      assert_equal_string "Hello OpenRouter" response.chat_response_content;
      assert_equal_float 0.000002
        (Option.get response.chat_response_usage.actual_cost_usd));
  match !Fake_http.last_request with
  | None -> failwith "expected OpenRouter request"
  | Some request ->
      assert_contains "https://openrouter.ai/api/v1/chat/completions"
        request.url;
      if not (List.mem ("HTTP-Referer", "https://example.com") request.headers)
      then failwith "missing OpenRouter referer";
      if not (List.mem ("X-Title", "Chatoyant") request.headers) then
        failwith "missing OpenRouter title"

let test_local_profile_endpoints () =
  let local_config =
    Local_client.
      {
        base_url = "http://127.0.0.1:11434/v1";
        api_key = None;
        timeout_ms = Some 1_000;
        headers = [ ("X-Local-Profile", "test") ];
      }
  in
  let response_request =
    Chatoyant.Provider.Openai.
      {
        responses_model = "local-responses-model";
        responses_input = Input_text "Hello";
        responses_instructions = Some "Be brief";
        responses_previous_response_id = None;
        responses_store = None;
        responses_stream = false;
        responses_temperature = Some 0.0;
        responses_top_p = None;
        responses_max_output_tokens = Some 32;
        responses_reasoning = None;
        responses_tools = [];
        responses_tool_choice = None;
        responses_text_format = None;
        responses_parallel_tool_calls = None;
        responses_truncation = None;
        responses_metadata = [];
        responses_extra = [];
      }
  in
  let response_body =
    Chatoyant.Provider.Local.responses_request_json response_request
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"model\":\"local-responses-model\"" response_body;
  Fake_http.next_response_body :=
    "{\"id\":\"resp_local\",\"model\":\"local-responses-model\",\"status\":\"completed\",\"output_text\":\"Local \
     Responses \
     ok\",\"usage\":{\"input_tokens\":1,\"output_tokens\":2,\"total_tokens\":3}}";
  (match Local_client.create_response local_config response_request with
  | Error error -> failwith error.error_message
  | Ok response ->
      assert_equal_string "Local Responses ok" response.responses_output_text);
  (match !Fake_http.last_request with
  | Some request ->
      assert_contains "http://127.0.0.1:11434/v1/responses" request.url;
      if not (List.mem ("X-Local-Profile", "test") request.headers) then
        failwith "missing local profile header"
  | None -> failwith "expected local responses request");
  (match
     Chatoyant.Provider.Local.response_of_stream_chunks
       [
         "data: {\"type\":\"response.output_text.delta\",\"delta\":\"Lo\"}\n\n";
         "data: {\"type\":\"response.output_text.delta\",\"delta\":\"cal\"}\n\n";
         "data: \
          {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\",\"usage\":{\"input_tokens\":1,\"output_tokens\":1,\"total_tokens\":2}}}\n\n";
       ]
   with
  | Error message -> failwith message
  | Ok response ->
      assert_equal_string "Local" response.responses_output_text;
      assert_equal_int 2 response.responses_usage.total_tokens);
  let embedding_request =
    Chatoyant.Provider.Openai.
      {
        embedding_model = "local-embedding-model";
        embedding_input = Embedding_text "hello";
        embedding_encoding_format = Some Float;
        embedding_dimensions = Some 3;
        embedding_user = None;
        embedding_extra = [];
      }
  in
  let embedding_body =
    Chatoyant.Provider.Local.embedding_request_json embedding_request
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"dimensions\":3" embedding_body;
  Fake_http.next_response_body :=
    "{\"object\":\"list\",\"data\":[{\"object\":\"embedding\",\"index\":0,\"embedding\":[0.1,0.2,0.3]}],\"model\":\"local-embedding-model\",\"usage\":{\"prompt_tokens\":1,\"total_tokens\":1}}";
  (match Local_client.create_embedding local_config embedding_request with
  | Error error -> failwith error.error_message
  | Ok response -> assert_equal_int 1 (List.length response.embedding_data));
  (match !Fake_http.last_request with
  | Some request -> assert_contains "/embeddings" request.url
  | None -> failwith "expected local embeddings request");
  let image_request =
    Chatoyant.Provider.Openai.
      {
        image_model = "local-image-model";
        image_prompt = "A local image";
        image_background = None;
        image_moderation = None;
        image_n = Some 1;
        image_output_compression = None;
        image_output_format = Some "png";
        image_quality = None;
        image_response_format = Some Url;
        image_size = Some "512x512";
        image_style = None;
        image_user = None;
        image_extra = [];
      }
  in
  Fake_http.next_response_body :=
    "{\"created\":1700000000,\"data\":[{\"url\":\"http://127.0.0.1/image.png\"}]}";
  match Local_client.generate_image local_config image_request with
  | Error error -> failwith error.error_message
  | Ok response -> (
      assert_equal_int 1 (List.length response.image_data);
      match !Fake_http.last_request with
      | Some request -> assert_contains "/images/generations" request.url
      | None -> failwith "expected local image request")

let test_openrouter_extra_endpoints () =
  let config =
    Openrouter_client.
      {
        api_key = "or-key";
        timeout_ms = Some 1_000;
        http_referer = None;
        title = Some "Chatoyant";
        headers = [];
      }
  in
  let credits =
    Chatoyant.Provider.Openrouter.credits_of_json
      (Chatoyant.Runtime.Json.Object
         [
           ( "data",
             Chatoyant.Runtime.Json.Object
               [
                 ("total_credits", Chatoyant.Runtime.Json.Float 100.5);
                 ("total_usage", Chatoyant.Runtime.Json.Float 25.75);
               ] );
         ])
  in
  assert_equal_float 100.5 credits.total_credits;
  assert_equal_float 25.75 credits.total_usage;
  let providers =
    Chatoyant.Provider.Openrouter.provider_list_of_json
      (Chatoyant.Runtime.Json.Object
         [
           ( "data",
             Chatoyant.Runtime.Json.Array
               [
                 Chatoyant.Runtime.Json.Object
                   [
                     ("id", Chatoyant.Runtime.Json.String "openai");
                     ("name", Chatoyant.Runtime.Json.String "OpenAI");
                   ];
               ] );
         ])
  in
  assert_equal_int 1 (List.length providers.providers);
  Fake_http.next_response_body :=
    "{\"id\":\"resp_123\",\"model\":\"openai/gpt-4o-mini\",\"status\":\"completed\",\"output_text\":\"OpenRouter \
     Responses \
     ok\",\"usage\":{\"input_tokens\":1,\"output_tokens\":2,\"total_tokens\":3}}";
  (match
     Openrouter_client.create_response config
       {
         Chatoyant.Provider.Openai.responses_model = "openai/gpt-4o-mini";
         responses_input = Input_text "Hello";
         responses_instructions = None;
         responses_previous_response_id = None;
         responses_store = Some false;
         responses_stream = false;
         responses_temperature = Some 0.0;
         responses_top_p = None;
         responses_max_output_tokens = Some 32;
         responses_reasoning = None;
         responses_tools = [];
         responses_tool_choice = None;
         responses_text_format = None;
         responses_parallel_tool_calls = None;
         responses_truncation = None;
         responses_metadata = [];
         responses_extra = [];
       }
   with
  | Error error -> failwith error.error_message
  | Ok response ->
      assert_equal_string "OpenRouter Responses ok"
        response.responses_output_text);
  (match !Fake_http.last_request with
  | Some request ->
      assert_equal_string "POST" request.method_;
      assert_contains "/responses" request.url
  | None -> failwith "expected OpenRouter responses request");
  Fake_http.next_response_body :=
    "{\"data\":{\"total_credits\":100.5,\"total_usage\":25.75}}";
  (match Openrouter_client.get_credits config with
  | Error error -> failwith error.error_message
  | Ok credits -> assert_equal_float 25.75 credits.total_usage);
  Fake_http.next_response_body :=
    "{\"data\":[{\"id\":\"openai\",\"name\":\"OpenAI\"}]}";
  (match Openrouter_client.list_providers config with
  | Error error -> failwith error.error_message
  | Ok providers -> assert_equal_int 1 (List.length providers.providers));
  Fake_http.next_response_body :=
    "{\"data\":{\"id\":\"gen_123\",\"model\":\"openai/gpt-4o-mini\",\"provider_name\":\"OpenAI\",\"total_cost\":0.0001,\"created_at\":\"2026-01-01T00:00:00Z\"}}";
  (match
     Openrouter_client.retrieve_generation config ~generation_id:"gen_123"
   with
  | Error error -> failwith error.error_message
  | Ok generation ->
      assert_equal_string "gen_123" (Option.get generation.generation_id));
  Fake_http.next_response_body := "{\"data\":{\"count\":150}}";
  (match
     Openrouter_client.count_models ~output_modalities:"text,image" config
   with
  | Error error -> failwith error.error_message
  | Ok count -> assert_equal_int 150 count.model_count);
  (match !Fake_http.last_request with
  | Some request ->
      assert_contains "/models/count?output_modalities=text,image" request.url
  | None -> failwith "expected OpenRouter model count request");
  Fake_http.next_response_body :=
    "{\"data\":[{\"id\":\"openai/gpt-4o-mini\",\"object\":\"model\",\"created\":1700000000,\"owned_by\":\"openai\"}]}";
  (match Openrouter_client.list_user_models config with
  | Error error -> failwith error.error_message
  | Ok models -> assert_equal_int 1 (List.length models.models));
  let endpoint_fixture =
    "{\"data\":{\"id\":\"openai/gpt-4o-mini\",\"name\":\"GPT-4o \
     mini\",\"description\":\"Fast small \
     model\",\"created\":1700000000,\"architecture\":{\"modality\":\"text->text\"},\"endpoints\":[{\"name\":\"openai/gpt-4o-mini\",\"provider_name\":\"OpenAI\",\"context_length\":128000,\"max_completion_tokens\":16384,\"supported_parameters\":[\"tools\",\"response_format\"],\"pricing\":{\"prompt\":\"0.00000015\"},\"status\":\"stable\"}]}}"
  in
  let endpoint_list =
    Chatoyant.Provider.Openrouter.model_endpoint_list_of_json
      (match Chatoyant.Runtime.Json.parse endpoint_fixture with
      | Ok json -> json
      | Error message -> failwith message)
  in
  assert_equal_string "openai/gpt-4o-mini"
    (Option.get endpoint_list.model_endpoint_model_id);
  assert_equal_int 1 (List.length endpoint_list.model_endpoints);
  assert_equal_int 128000
    (Option.get
       (List.hd endpoint_list.model_endpoints).model_endpoint_context_length);
  Fake_http.next_response_body := endpoint_fixture;
  (match
     Openrouter_client.list_model_endpoints config ~author:"openai"
       ~slug:"gpt-4o-mini"
   with
  | Error error -> failwith error.error_message
  | Ok endpoints ->
      assert_equal_string "GPT-4o mini"
        (Option.get endpoints.model_endpoint_model_name));
  (match !Fake_http.last_request with
  | Some request ->
      assert_equal_string "GET" request.method_;
      assert_contains "/models/openai/gpt-4o-mini/endpoints" request.url
  | None -> failwith "expected OpenRouter model endpoint metadata request");
  (match
     Openrouter_client.list_model_endpoints_by_id config
       ~model_id:"openai/gpt-4o-mini"
   with
  | Error error -> failwith error.error_message
  | Ok endpoints -> assert_equal_int 1 (List.length endpoints.model_endpoints));
  (match
     Openrouter_client.list_model_endpoints_by_id config
       ~model_id:"bad-model-id"
   with
  | Ok _ -> failwith "expected invalid OpenRouter model id"
  | Error error -> assert_contains "author/slug" error.error_message);
  let rerank_body =
    Chatoyant.Provider.Openrouter.
      {
        rerank_model = "cohere/rerank-v3.5";
        rerank_query = "best doc";
        rerank_documents =
          [
            Rerank_text "first";
            Rerank_object
              (Chatoyant.Runtime.Json.Object
                 [ ("text", Chatoyant.Runtime.Json.String "second") ]);
          ];
        rerank_top_n = Some 1;
        rerank_provider =
          Some
            (Chatoyant.Runtime.Json.Object
               [ ("order", Chatoyant.Runtime.Json.Array []) ]);
        rerank_extra = [];
      }
    |> Chatoyant.Provider.Openrouter.rerank_request_json
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"documents\":[\"first\",{\"text\":\"second\"}]" rerank_body;
  Fake_http.next_response_body :=
    "{\"id\":\"rr_123\",\"model\":\"cohere/rerank-v3.5\",\"provider\":\"Cohere\",\"results\":[{\"index\":1,\"relevance_score\":0.99,\"document\":{\"text\":\"second\"}}],\"usage\":{\"total_tokens\":10}}";
  (match
     Openrouter_client.rerank config
       {
         Chatoyant.Provider.Openrouter.rerank_model = "cohere/rerank-v3.5";
         rerank_query = "best doc";
         rerank_documents = [ Rerank_text "first"; Rerank_text "second" ];
         rerank_top_n = Some 1;
         rerank_provider = None;
         rerank_extra = [];
       }
   with
  | Error error -> failwith error.error_message
  | Ok response ->
      assert_equal_string "rr_123" (Option.get response.rerank_id);
      assert_equal_int 1 (List.length response.rerank_results));
  Fake_http.next_response_body :=
    "{\"id\":\"job_123\",\"polling_url\":\"/api/v1/videos/job_123\",\"status\":\"pending\",\"generation_id\":\"gen_123\"}";
  (match
     Openrouter_client.create_video config
       {
         Chatoyant.Provider.Openrouter.video_model = "google/veo-3.1";
         video_prompt = "mountains";
         video_aspect_ratio = Some "16:9";
         video_callback_url = None;
         video_duration = Some 8;
         video_frame_images = [];
         video_generate_audio = Some true;
         video_input_references = [];
         video_provider = None;
         video_resolution = Some "720p";
         video_seed = Some 7;
         video_size = None;
         video_extra = [];
       }
   with
  | Error error -> failwith error.error_message
  | Ok job -> assert_equal_string "job_123" (Option.get job.video_job_id));
  (match !Fake_http.last_request with
  | Some request -> assert_contains "/videos" request.url
  | None -> failwith "expected OpenRouter video request");
  Fake_http.next_response_body :=
    "{\"id\":\"job_123\",\"status\":\"completed\",\"unsigned_urls\":[\"https://example.com/video.mp4\"],\"usage\":{\"cost\":0.5}}";
  (match Openrouter_client.get_video config ~job_id:"job_123" with
  | Error error -> failwith error.error_message
  | Ok job -> (
      match job.video_status with
      | Chatoyant.Provider.Openrouter.Video_completed -> ()
      | _ -> failwith "expected completed OpenRouter video"));
  Fake_http.next_response_body := "VIDEO";
  (match Openrouter_client.download_video ~index:0 config ~job_id:"job_123" with
  | Error error -> failwith error.error_message
  | Ok body -> assert_equal_string "VIDEO" body);
  Fake_http.next_response_body :=
    "{\"data\":[{\"id\":\"google/veo-3.1\",\"name\":\"Veo \
     3.1\",\"canonical_slug\":\"google/veo-3.1\",\"created\":1700000000}]}";
  match Openrouter_client.list_video_models config with
  | Error error -> failwith error.error_message
  | Ok models -> assert_equal_int 1 (List.length models.video_models)

let test_openrouter_management_endpoints () =
  let management =
    Openrouter_client.
      {
        management_api_key = "management-key";
        management_base_url = default_management_base_url;
        management_timeout_ms = Some 1_000;
      }
  in
  Fake_http.next_response_status := 200;
  Fake_http.next_response_body :=
    "{\"data\":[{\"hash\":\"key_hash_123\",\"name\":\"prod key\"}]}";
  (match Openrouter_client.list_keys management with
  | Error error -> failwith error.error_message
  | Ok keys -> assert_equal_int 1 (List.length keys.management_data));
  (match !Fake_http.last_request with
  | Some request ->
      assert_equal_string "GET" request.method_;
      assert_contains "/keys" request.url;
      if
        not
          (List.mem ("Authorization", "Bearer management-key") request.headers)
      then failwith "missing OpenRouter management key"
  | None -> failwith "expected OpenRouter list keys request");
  Fake_http.next_response_body :=
    "{\"data\":{\"hash\":\"key_hash_123\",\"name\":\"prod key\"}}";
  (match
     Openrouter_client.update_key management ~key_hash:"key_hash_123"
       (Chatoyant.Runtime.Json.Object
          [ ("name", Chatoyant.Runtime.Json.String "prod key") ])
   with
  | Error error -> failwith error.error_message
  | Ok key -> assert_equal_string "key_hash_123" (Option.get key.management_id));
  (match !Fake_http.last_request with
  | Some request ->
      assert_equal_string "PATCH" request.method_;
      assert_contains "/keys/key_hash_123" request.url
  | None -> failwith "expected OpenRouter update key request");
  Fake_http.next_response_body :=
    "{\"data\":[{\"id\":\"guardrail_123\",\"name\":\"no pii\"}]}";
  (match Openrouter_client.list_guardrails management with
  | Error error -> failwith error.error_message
  | Ok guardrails -> assert_equal_int 1 (List.length guardrails.management_data));
  Fake_http.next_response_body := "{\"id\":\"guardrail_123\",\"deleted\":true}";
  match
    Openrouter_client.delete_guardrail management ~guardrail_id:"guardrail_123"
  with
  | Error error -> failwith error.error_message
  | Ok deleted ->
      assert_equal_string "guardrail_123"
        (Option.get deleted.management_delete_id);
      if not deleted.management_deleted then
        failwith "expected guardrail delete flag"

let test_provider_adapter () =
  let module Local_provider =
    Chatoyant.Provider.Local.Make_provider
      (Fake_http)
      (struct
        let base_url = "http://127.0.0.1:11434/v1"
        let api_key = None
        let timeout_ms = Some 1_000
        let headers = []
      end) in
  Fake_http.next_response_body :=
    "{\"id\":\"chatcmpl_local\",\"model\":\"local-model\",\"choices\":[{\"message\":{\"role\":\"assistant\",\"content\":\"Adapter \
     ok\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":1,\"completion_tokens\":1,\"total_tokens\":2}}";
  match
    Local_provider.generate
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
        Chatoyant.Provider.Provider.model = "local-model";
        temperature = None;
        max_tokens = Some 16;
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
  | Error _ -> failwith "local provider adapter failed"
  | Ok generation -> assert_equal_string "Adapter ok" generation.content

let () =
  test_local_normalization ();
  test_local_think_stream ();
  test_clients ();
  test_local_profile_endpoints ();
  test_openrouter_extra_endpoints ();
  test_openrouter_management_endpoints ();
  test_provider_adapter ()
