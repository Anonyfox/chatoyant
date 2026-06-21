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

  type error =
    | Timeout of int
    | Network of string
    | Invalid_response of string

  let last_request : request option ref = ref None
  let next_response_status = ref 200

  let next_response_body =
    ref
      "{\"id\":\"msg_1\",\"type\":\"message\",\"role\":\"assistant\",\"model\":\"claude-sonnet-4-6\",\"content\":[{\"type\":\"text\",\"text\":\"Hello from Claude\"}],\"stop_reason\":\"end_turn\",\"usage\":{\"input_tokens\":7,\"output_tokens\":3}}"

  let send request =
    last_request := Some request;
    Ok
      {
        status = !next_response_status;
        headers = [ ("content-type", "application/json") ];
        body = !next_response_body;
      }
end

module Client = Chatoyant.Provider.Anthropic.Make_client (Fake_http)
module Provider = Chatoyant.Provider.Anthropic.Make_provider (Fake_http) (struct
  let api_key = "test-key"
  let base_url = Client.default_base_url
  let timeout_ms = Some 1_000
  let beta_headers = []
end)

let tool_schema =
  Chatoyant.Runtime.Json.Object
    [
      ("type", Chatoyant.Runtime.Json.String "object");
      ( "properties",
        Chatoyant.Runtime.Json.Object
          [ ("query", Chatoyant.Runtime.Json.Object [ ("type", Chatoyant.Runtime.Json.String "string") ]) ] );
    ]

let request_fixture () =
  Chatoyant.Provider.Anthropic.
    {
      model = "claude-sonnet-4-6";
      system = Some "You are helpful";
      messages = [ { message_role = User; message_content = [ Text "Hello" ] } ];
      max_tokens = 4096;
      stream = true;
      temperature = Some 0.2;
      top_p = Some 0.9;
      top_k = Some 50;
      stop_sequences = [ "END" ];
      metadata_user_id = Some "user_123";
      tools =
        [
          {
            tool_name = "lookup";
            tool_description = Some "Lookup data";
            input_schema = tool_schema;
          };
        ];
      tool_choice = Some (Tool "lookup");
      thinking = Some (Enabled { budget_tokens = 2048 });
      extra = [];
    }

let test_request_json () =
  let body =
    request_fixture ()
    |> Chatoyant.Provider.Anthropic.request_json
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"model\":\"claude-sonnet-4-6\"" body;
  assert_contains "\"system\":\"You are helpful\"" body;
  assert_contains "\"tool_choice\"" body;
  assert_contains "\"thinking\"" body;
  assert_contains "\"metadata\"" body;
  assert_contains "\"stop_sequences\"" body

let test_response_decode () =
  let json =
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
                  ("type", Chatoyant.Runtime.Json.String "thinking");
                  ("thinking", Chatoyant.Runtime.Json.String "Reasoning");
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
  let response = Chatoyant.Provider.Anthropic.response_of_json json in
  assert_equal_string "Hello" (Chatoyant.Provider.Anthropic.text_of_response response);
  assert_equal_int 11 response.response_usage.input_tokens;
  assert_equal_int 3 (List.length response.response_content)

let test_models_and_batches_decode () =
  let models =
    Chatoyant.Provider.Anthropic.model_list_of_json
      (Chatoyant.Runtime.Json.Object
         [
           ( "data",
             Chatoyant.Runtime.Json.Array
               [
                 Chatoyant.Runtime.Json.Object
                   [
                     ("id", Chatoyant.Runtime.Json.String "claude-haiku-4-5-20251001");
                     ("type", Chatoyant.Runtime.Json.String "model");
                     ("display_name", Chatoyant.Runtime.Json.String "Claude Haiku 4.5");
                     ("created_at", Chatoyant.Runtime.Json.String "2025-10-01T00:00:00Z");
                   ];
               ] );
           ("has_more", Chatoyant.Runtime.Json.Bool false);
           ("first_id", Chatoyant.Runtime.Json.String "claude-haiku-4-5-20251001");
           ("last_id", Chatoyant.Runtime.Json.String "claude-haiku-4-5-20251001");
         ])
  in
  assert_equal_int 1 (List.length models.models);
  assert_equal_string "claude-haiku-4-5-20251001" (List.hd models.models).model_id;
  let batch =
    Chatoyant.Provider.Anthropic.message_batch_of_json
      (Chatoyant.Runtime.Json.Object
         [
           ("id", Chatoyant.Runtime.Json.String "msgbatch_123");
           ("type", Chatoyant.Runtime.Json.String "message_batch");
           ("processing_status", Chatoyant.Runtime.Json.String "ended");
           ( "request_counts",
             Chatoyant.Runtime.Json.Object
               [
                 ("processing", Chatoyant.Runtime.Json.Float 0.0);
                 ("succeeded", Chatoyant.Runtime.Json.Float 1.0);
                 ("errored", Chatoyant.Runtime.Json.Float 0.0);
                 ("canceled", Chatoyant.Runtime.Json.Float 0.0);
                 ("expired", Chatoyant.Runtime.Json.Float 0.0);
               ] );
           ("results_url", Chatoyant.Runtime.Json.String "https://api.anthropic.com/v1/messages/batches/msgbatch_123/results");
         ])
  in
  assert_equal_string "msgbatch_123" batch.batch_id;
  assert_equal_int 1 batch.request_counts.succeeded;
  let create_body =
    Chatoyant.Provider.Anthropic.batch_create_json
      [ { custom_id = "case_1"; params = request_fixture () } ]
    |> Chatoyant.Runtime.Json.to_string
  in
  assert_contains "\"custom_id\":\"case_1\"" create_body;
  assert_contains "\"params\"" create_body;
  let result_lines =
    Chatoyant.Provider.Anthropic.batch_result_lines_of_jsonl
      "{\"custom_id\":\"case_1\",\"result\":{\"type\":\"succeeded\",\"message\":{\"id\":\"msg_1\",\"type\":\"message\",\"role\":\"assistant\",\"model\":\"claude-sonnet-4-6\",\"content\":[{\"type\":\"text\",\"text\":\"ok\"}],\"stop_reason\":\"end_turn\",\"usage\":{\"input_tokens\":1,\"output_tokens\":1}}}}\n\
       {\"custom_id\":\"case_2\",\"result\":{\"type\":\"errored\",\"error\":{\"type\":\"invalid_request_error\",\"message\":\"bad\"}}}"
  in
  match result_lines with
  | Error message -> failwith message
  | Ok lines ->
      assert_equal_int 2 (List.length lines);
      assert_equal_string "case_1" (List.hd lines).result_custom_id;
      (match (List.hd lines).result with
      | Chatoyant.Provider.Anthropic.Batch_succeeded response ->
          assert_equal_string "ok" (Chatoyant.Provider.Anthropic.text_of_response response)
      | _ -> failwith "expected succeeded batch result")

let test_files_decode () =
  let file =
    Chatoyant.Provider.Anthropic.file_metadata_of_json
      (Chatoyant.Runtime.Json.Object
         [
           ("id", Chatoyant.Runtime.Json.String "file_123");
           ("type", Chatoyant.Runtime.Json.String "file");
           ("filename", Chatoyant.Runtime.Json.String "notes.txt");
           ("mime_type", Chatoyant.Runtime.Json.String "text/plain");
           ("size_bytes", Chatoyant.Runtime.Json.Float 12.0);
           ("created_at", Chatoyant.Runtime.Json.String "2026-01-01T00:00:00Z");
           ("downloadable", Chatoyant.Runtime.Json.Bool true);
         ])
  in
  assert_equal_string "file_123" file.file_id;
  assert_equal_string "notes.txt" (Option.get file.filename);
  assert_equal_int 12 (Option.get file.size_bytes);
  let files =
    Chatoyant.Provider.Anthropic.file_list_of_json
      (Chatoyant.Runtime.Json.Object
         [
           ( "data",
             Chatoyant.Runtime.Json.Array
               [
                 Chatoyant.Runtime.Json.Object
                   [
                     ("id", Chatoyant.Runtime.Json.String "file_123");
                     ("type", Chatoyant.Runtime.Json.String "file");
                   ];
               ] );
           ("has_more", Chatoyant.Runtime.Json.Bool false);
         ])
  in
  assert_equal_int 1 (List.length files.files);
  let deleted =
    Chatoyant.Provider.Anthropic.file_delete_of_json
      (Chatoyant.Runtime.Json.Object
         [
           ("id", Chatoyant.Runtime.Json.String "file_123");
           ("deleted", Chatoyant.Runtime.Json.Bool true);
         ])
  in
  if not deleted.deleted then failwith "expected deleted file"

let test_stream_chunks () =
  let response =
    Chatoyant.Provider.Anthropic.response_of_stream_chunks
      [
        "event: message_start\ndata: {\"type\":\"message_start\",\"message\":{\"id\":\"msg_stream\",\"type\":\"message\",\"role\":\"assistant\",\"model\":\"claude-sonnet-4-6\",\"content\":[],\"usage\":{\"input_tokens\":4,\"output_tokens\":0}}}\n\n";
        "event: content_block_start\ndata: {\"type\":\"content_block_start\",\"index\":0,\"content_block\":{\"type\":\"text\",\"text\":\"\"}}\n\n";
        "event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"Hel";
        "lo\"}}\n\n";
        "event: message_delta\ndata: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"end_turn\"},\"usage\":{\"output_tokens\":2}}\n\n";
      ]
  in
  match response with
  | Error message -> failwith message
  | Ok response ->
      assert_equal_string "Hello" (Chatoyant.Provider.Anthropic.text_of_response response);
      assert_equal_int 2 response.response_usage.output_tokens

let test_client_success () =
  let config =
    Client.
      {
        api_key = "test-key";
        base_url = default_base_url;
        timeout_ms = Some 1_000;
        beta_headers = [ "fine-grained-tool-streaming-2025-05-14" ];
      }
  in
  match Client.create_message config (request_fixture ()) with
  | Error error -> failwith error.error_message
  | Ok response ->
      assert_equal_string "Hello from Claude" (Chatoyant.Provider.Anthropic.text_of_response response);
      (match !(Fake_http.last_request) with
      | None -> failwith "expected captured request"
      | Some request ->
          assert_equal_string "POST" request.method_;
          assert_contains "/messages" request.url;
          if
            not
              (List.mem
                 ("anthropic-beta", "fine-grained-tool-streaming-2025-05-14")
                 request.headers)
          then failwith "missing beta header")

let test_client_error () =
  Fake_http.next_response_status := 400;
  Fake_http.next_response_body :=
    "{\"type\":\"error\",\"error\":{\"type\":\"invalid_request_error\",\"message\":\"bad request\"}}";
  let config =
    Client.
      { api_key = "test-key"; base_url = default_base_url; timeout_ms = None; beta_headers = [] }
  in
  match Client.create_message config (request_fixture ()) with
  | Ok _ -> failwith "expected client error"
  | Error error ->
      assert_contains "bad request" error.error_message;
      Fake_http.next_response_status := 200;
      Fake_http.next_response_body :=
        "{\"id\":\"msg_1\",\"type\":\"message\",\"role\":\"assistant\",\"model\":\"claude-sonnet-4-6\",\"content\":[{\"type\":\"text\",\"text\":\"Hello from Claude\"}],\"stop_reason\":\"end_turn\",\"usage\":{\"input_tokens\":7,\"output_tokens\":3}}"

let test_client_models_and_batches () =
  let config =
    Client.
      { api_key = "test-key"; base_url = default_base_url; timeout_ms = Some 1_000; beta_headers = [] }
  in
  Fake_http.next_response_body :=
    "{\"data\":[{\"id\":\"claude-haiku-4-5-20251001\",\"type\":\"model\",\"display_name\":\"Claude Haiku 4.5\",\"created_at\":\"2025-10-01T00:00:00Z\"}],\"has_more\":false}";
  (match Client.list_models config with
  | Error error -> failwith error.error_message
  | Ok models -> assert_equal_string "claude-haiku-4-5-20251001" (List.hd models.models).model_id);
  (match !(Fake_http.last_request) with
  | Some request ->
      assert_equal_string "GET" request.method_;
      assert_contains "/models" request.url
  | None -> failwith "expected models request");
  Fake_http.next_response_body :=
    "{\"id\":\"msgbatch_123\",\"type\":\"message_batch\",\"processing_status\":\"in_progress\",\"request_counts\":{\"processing\":1,\"succeeded\":0,\"errored\":0,\"canceled\":0,\"expired\":0},\"created_at\":\"2026-01-01T00:00:00Z\"}";
  (match Client.create_message_batch config [ { custom_id = "case_1"; params = request_fixture () } ] with
  | Error error -> failwith error.error_message
  | Ok batch -> assert_equal_string "msgbatch_123" batch.batch_id);
  (match !(Fake_http.last_request) with
  | Some request ->
      assert_equal_string "POST" request.method_;
      assert_contains "/messages/batches" request.url
  | None -> failwith "expected batch request");
  Fake_http.next_response_body :=
    "{\"custom_id\":\"case_1\",\"result\":{\"type\":\"succeeded\",\"message\":{\"id\":\"msg_1\",\"type\":\"message\",\"role\":\"assistant\",\"model\":\"claude-sonnet-4-6\",\"content\":[{\"type\":\"text\",\"text\":\"ok\"}],\"stop_reason\":\"end_turn\",\"usage\":{\"input_tokens\":1,\"output_tokens\":1}}}}\n";
  match Client.message_batch_results config ~batch_id:"msgbatch_123" with
  | Error error -> failwith error.error_message
  | Ok lines -> assert_equal_int 1 (List.length lines)

let test_client_files () =
  let config =
    Client.
      { api_key = "test-key"; base_url = default_base_url; timeout_ms = Some 1_000; beta_headers = [] }
  in
  Fake_http.next_response_body :=
    "{\"id\":\"file_123\",\"type\":\"file\",\"filename\":\"notes.txt\",\"mime_type\":\"text/plain\",\"size_bytes\":12,\"created_at\":\"2026-01-01T00:00:00Z\",\"downloadable\":true}";
  (match
     Client.upload_file config
       {
         upload_filename = "notes.txt";
         upload_content_type = Some "text/plain";
         upload_body = "hello world";
       }
   with
  | Error error -> failwith error.error_message
  | Ok file -> assert_equal_string "file_123" file.file_id);
  (match !(Fake_http.last_request) with
  | Some request ->
      assert_equal_string "POST" request.method_;
      assert_contains "/files" request.url;
      if not (List.mem ("anthropic-beta", "files-api-2025-04-14") request.headers) then
        failwith "missing files beta header";
      (match request.body with
      | Multipart [ part ] ->
          assert_equal_string "file" part.name;
          assert_equal_string "notes.txt" (Option.get part.filename)
      | _ -> failwith "expected multipart file upload")
  | None -> failwith "expected file upload request");
  Fake_http.next_response_body :=
    "{\"data\":[{\"id\":\"file_123\",\"type\":\"file\",\"filename\":\"notes.txt\"}],\"has_more\":false}";
  (match Client.list_files config with
  | Error error -> failwith error.error_message
  | Ok files -> assert_equal_int 1 (List.length files.files));
  Fake_http.next_response_body := "downloaded text";
  match Client.download_file config ~file_id:"file_123" with
  | Error error -> failwith error.error_message
  | Ok body -> assert_equal_string "downloaded text" body

let test_provider_adapter () =
  Fake_http.next_response_status := 200;
  Fake_http.next_response_body :=
    "{\"id\":\"msg_1\",\"type\":\"message\",\"role\":\"assistant\",\"model\":\"claude-sonnet-4-6\",\"content\":[{\"type\":\"text\",\"text\":\"Hello from Claude\"}],\"stop_reason\":\"end_turn\",\"usage\":{\"input_tokens\":7,\"output_tokens\":3}}";
  match
    Provider.generate
      [
        {
          Chatoyant.Provider.Provider.role = Chatoyant.Provider.Provider.System;
          content = Some "You are helpful";
          name = None;
          tool_call_id = None;
          tool_calls = [];
          tool_result_error = None;
        };
        {
          role = Chatoyant.Provider.Provider.User;
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
        timeout_ms = Some 1_000;
        tools = [];
        tool_choice = None;
        extra = None;
      }
  with
  | Error _ -> failwith "provider adapter failed"
  | Ok generation -> assert_equal_string "Hello from Claude" generation.content

let () =
  test_request_json ();
  test_response_decode ();
  test_models_and_batches_decode ();
  test_files_decode ();
  test_stream_chunks ();
  test_client_success ();
  test_client_error ();
  test_client_models_and_batches ();
  test_client_files ();
  test_provider_adapter ()
