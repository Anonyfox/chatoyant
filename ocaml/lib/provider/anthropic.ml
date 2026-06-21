type role =
  | User
  | Assistant

type content_block =
  | Text of string
  | Thinking of string
  | Redacted_thinking of string
  | Tool_use of {
      id : string;
      name : string;
      input : Chatoyant_runtime.Json.t;
    }
  | Tool_result of {
      tool_use_id : string;
      content : string;
      is_error : bool option;
    }
  | Raw_block of Chatoyant_runtime.Json.t

type message = {
  message_role : role;
  message_content : content_block list;
}

type tool = {
  tool_name : string;
  tool_description : string option;
  input_schema : Chatoyant_runtime.Json.t;
}

type tool_choice =
  | Auto
  | Any
  | Tool of string
  | No_tool

type thinking =
  | Disabled
  | Enabled of { budget_tokens : int }

type request = {
  model : string;
  messages : message list;
  system : string option;
  max_tokens : int;
  stream : bool;
  temperature : float option;
  top_p : float option;
  top_k : int option;
  stop_sequences : string list;
  metadata_user_id : string option;
  tools : tool list;
  tool_choice : tool_choice option;
  thinking : thinking option;
  extra : (string * Chatoyant_runtime.Json.t) list;
}

type stop_reason =
  | End_turn
  | Max_tokens
  | Stop_sequence
  | Tool_use_stop
  | Pause_turn
  | Refusal
  | Unknown_stop of string

type usage = Chatoyant_tokens.Cost.usage

type response = {
  response_id : string option;
  response_model : string option;
  response_role : role option;
  response_content : content_block list;
  response_stop_reason : stop_reason option;
  response_stop_sequence : string option;
  response_usage : usage;
  response_raw : Chatoyant_runtime.Json.t;
}

type api_error = {
  error_type : string option;
  error_message : string;
  error_raw : Chatoyant_runtime.Json.t option;
}

type model = {
  model_id : string;
  model_display_name : string option;
  model_created_at : string option;
  model_type : string option;
  model_raw : Chatoyant_runtime.Json.t;
}

type model_list = {
  models : model list;
  first_id : string option;
  last_id : string option;
  has_more : bool;
  raw : Chatoyant_runtime.Json.t;
}

type batch_request = {
  custom_id : string;
  params : request;
}

type batch_counts = {
  processing : int;
  succeeded : int;
  errored : int;
  canceled : int;
  expired : int;
}

type batch_status =
  | In_progress
  | Canceling
  | Ended
  | Unknown_batch_status of string

type message_batch = {
  batch_id : string;
  batch_type : string option;
  processing_status : batch_status;
  request_counts : batch_counts;
  ended_at : string option;
  created_at : string option;
  expires_at : string option;
  archived_at : string option;
  cancel_initiated_at : string option;
  results_url : string option;
  raw : Chatoyant_runtime.Json.t;
}

type batch_list = {
  batches : message_batch list;
  first_id : string option;
  last_id : string option;
  has_more : bool;
  raw : Chatoyant_runtime.Json.t;
}

type batch_result =
  | Batch_succeeded of response
  | Batch_errored of api_error
  | Batch_canceled
  | Batch_expired
  | Batch_unknown of Chatoyant_runtime.Json.t

type batch_result_line = {
  result_custom_id : string;
  result : batch_result;
  result_raw : Chatoyant_runtime.Json.t;
}

type file_upload = {
  upload_filename : string;
  upload_content_type : string option;
  upload_body : string;
}

type file_metadata = {
  file_id : string;
  file_type : string option;
  filename : string option;
  mime_type : string option;
  size_bytes : int option;
  created_at : string option;
  downloadable : bool option;
  file_raw : Chatoyant_runtime.Json.t;
}

type file_list = {
  files : file_metadata list;
  first_id : string option;
  last_id : string option;
  has_more : bool;
  raw : Chatoyant_runtime.Json.t;
}

type file_delete = {
  deleted_file_id : string option;
  deleted : bool;
  raw : Chatoyant_runtime.Json.t;
}

type stream_delta =
  | Text_delta of string
  | Thinking_delta of string
  | Signature_delta of string
  | Input_json_delta of string
  | Unknown_delta of Chatoyant_runtime.Json.t

type stream_event =
  | Message_start of response
  | Content_block_start of {
      index : int;
      block : content_block;
    }
  | Content_block_delta of {
      index : int;
      delta : stream_delta;
    }
  | Content_block_stop of int
  | Message_delta of {
      stop_reason : stop_reason option;
      stop_sequence : string option;
      usage : usage;
    }
  | Message_stop
  | Ping
  | Error of api_error
  | Unknown_event of {
      event_type : string option;
      raw : Chatoyant_runtime.Json.t;
    }

type stream_state = {
  stream_id : string option;
  stream_model : string option;
  stream_role : role option;
  stream_content : content_block list;
  stream_stop_reason : stop_reason option;
  stream_stop_sequence : string option;
  stream_usage : usage;
}

let string value = Chatoyant_runtime.Json.String value
let bool value = Chatoyant_runtime.Json.Bool value
let int value = Chatoyant_runtime.Json.Float (Float.of_int value)
let float value = Chatoyant_runtime.Json.Float value

let add_opt name encode value fields =
  match value with
  | None -> fields
  | Some value -> (name, encode value) :: fields

let add_non_empty name encode values fields =
  match values with
  | [] -> fields
  | _ -> (name, Chatoyant_runtime.Json.Array (List.map encode values)) :: fields

let role_to_string = function
  | User -> "user"
  | Assistant -> "assistant"

let role_of_string = function
  | "user" -> Some User
  | "assistant" -> Some Assistant
  | _ -> None

let stop_reason_of_string = function
  | "end_turn" -> End_turn
  | "max_tokens" -> Max_tokens
  | "stop_sequence" -> Stop_sequence
  | "tool_use" -> Tool_use_stop
  | "pause_turn" -> Pause_turn
  | "refusal" -> Refusal
  | value -> Unknown_stop value

let stop_reason_to_string = function
  | End_turn -> "end_turn"
  | Max_tokens -> "max_tokens"
  | Stop_sequence -> "stop_sequence"
  | Tool_use_stop -> "tool_use"
  | Pause_turn -> "pause_turn"
  | Refusal -> "refusal"
  | Unknown_stop value -> value

let content_block_json = function
  | Text text -> Chatoyant_runtime.Json.Object [ ("type", string "text"); ("text", string text) ]
  | Thinking thinking ->
      Chatoyant_runtime.Json.Object [ ("type", string "thinking"); ("thinking", string thinking) ]
  | Redacted_thinking data ->
      Chatoyant_runtime.Json.Object
        [ ("type", string "redacted_thinking"); ("data", string data) ]
  | Tool_use { id; name; input } ->
      Chatoyant_runtime.Json.Object
        [
          ("type", string "tool_use");
          ("id", string id);
          ("name", string name);
          ("input", input);
        ]
  | Tool_result { tool_use_id; content; is_error } ->
      [
        ("type", string "tool_result");
        ("tool_use_id", string tool_use_id);
        ("content", string content);
      ]
      |> add_opt "is_error" bool is_error
      |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields
  | Raw_block json -> json

let message_json message =
  Chatoyant_runtime.Json.Object
    [
      ("role", string (role_to_string message.message_role));
      ("content", Chatoyant_runtime.Json.Array (List.map content_block_json message.message_content));
    ]

let tool_json tool =
  [
    ("name", string tool.tool_name);
    ("input_schema", tool.input_schema);
  ]
  |> add_opt "description" string tool.tool_description
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let thinking_json thinking =
  match thinking with
  | Disabled -> Chatoyant_runtime.Json.Object [ ("type", string "disabled") ]
  | Enabled { budget_tokens } ->
      Chatoyant_runtime.Json.Object
        [ ("type", string "enabled"); ("budget_tokens", int budget_tokens) ]

let tool_choice_json = function
  | Auto -> Chatoyant_runtime.Json.Object [ ("type", string "auto") ]
  | Any -> Chatoyant_runtime.Json.Object [ ("type", string "any") ]
  | Tool name -> Chatoyant_runtime.Json.Object [ ("type", string "tool"); ("name", string name) ]
  | No_tool -> Chatoyant_runtime.Json.Object [ ("type", string "none") ]

let metadata_json user_id =
  Chatoyant_runtime.Json.Object [ ("user_id", string user_id) ]

let request_json request =
  [
    ("model", string request.model);
    ("messages", Chatoyant_runtime.Json.Array (List.map message_json request.messages));
    ("max_tokens", int request.max_tokens);
    ("stream", bool request.stream);
  ]
  |> add_opt "system" string request.system
  |> add_opt "temperature" float request.temperature
  |> add_opt "top_p" float request.top_p
  |> add_opt "top_k" int request.top_k
  |> add_non_empty "stop_sequences" string request.stop_sequences
  |> add_opt "metadata" metadata_json request.metadata_user_id
  |> add_non_empty "tools" tool_json request.tools
  |> add_opt "tool_choice" tool_choice_json request.tool_choice
  |> add_opt "thinking" thinking_json request.thinking
  |> List.rev_append request.extra
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let authorization_headers ~api_key =
  [
    ("x-api-key", api_key);
    ("anthropic-version", "2023-06-01");
    ("Content-Type", "application/json");
  ]

let field = Chatoyant_runtime.Json.field

let string_field name json = Option.bind (field name json) Chatoyant_runtime.Json.as_string
let int_field name json = Option.bind (field name json) Chatoyant_runtime.Json.as_int
let bool_field name json = Option.bind (field name json) Chatoyant_runtime.Json.as_bool

let usage_of_json = Usage.anthropic

let content_block_of_json json =
  match string_field "type" json with
  | Some "text" -> Text (Option.value (string_field "text" json) ~default:"")
  | Some "thinking" -> Thinking (Option.value (string_field "thinking" json) ~default:"")
  | Some "redacted_thinking" ->
      Redacted_thinking (Option.value (string_field "data" json) ~default:"")
  | Some "tool_use" ->
      Tool_use
        {
          id = Option.value (string_field "id" json) ~default:"";
          name = Option.value (string_field "name" json) ~default:"";
          input = Option.value (field "input" json) ~default:Chatoyant_runtime.Json.Null;
        }
  | Some "tool_result" ->
      Tool_result
        {
          tool_use_id = Option.value (string_field "tool_use_id" json) ~default:"";
          content = Option.value (string_field "content" json) ~default:"";
          is_error = bool_field "is_error" json;
        }
  | _ -> Raw_block json

let response_of_json json =
  let content =
    match field "content" json with
    | Some (Chatoyant_runtime.Json.Array blocks) -> List.map content_block_of_json blocks
    | _ -> []
  in
  let usage =
    match field "usage" json with
    | Some usage -> usage_of_json usage
    | None -> Chatoyant_tokens.Cost.empty_usage
  in
  {
    response_id = string_field "id" json;
    response_model = string_field "model" json;
    response_role = Option.bind (string_field "role" json) role_of_string;
    response_content = content;
    response_stop_reason = Option.map stop_reason_of_string (Option.join (Some (string_field "stop_reason" json)));
    response_stop_sequence = string_field "stop_sequence" json;
    response_usage = usage;
    response_raw = json;
  }

let api_error_of_json json =
  match field "error" json with
  | Some error_json ->
      {
        error_type = string_field "type" error_json;
        error_message = Option.value (string_field "message" error_json) ~default:"Anthropic API error";
        error_raw = Some json;
      }
  | None ->
      {
        error_type = string_field "type" json;
        error_message = Option.value (string_field "message" json) ~default:"Anthropic API error";
        error_raw = Some json;
      }

let model_of_json json =
  {
    model_id = Option.value (string_field "id" json) ~default:"";
    model_display_name = string_field "display_name" json;
    model_created_at = string_field "created_at" json;
    model_type = string_field "type" json;
    model_raw = json;
  }

let model_list_of_json json =
  {
    models =
      (match field "data" json with
      | Some (Chatoyant_runtime.Json.Array values) -> List.map model_of_json values
      | _ -> []);
    first_id = string_field "first_id" json;
    last_id = string_field "last_id" json;
    has_more = Option.value (bool_field "has_more" json) ~default:false;
    raw = json;
  }

let batch_request_json request =
  Chatoyant_runtime.Json.Object
    [ ("custom_id", string request.custom_id); ("params", request_json request.params) ]

let batch_create_json requests =
  Chatoyant_runtime.Json.Object
    [ ("requests", Chatoyant_runtime.Json.Array (List.map batch_request_json requests)) ]

let batch_counts_of_json json =
  {
    processing = Option.value (int_field "processing" json) ~default:0;
    succeeded = Option.value (int_field "succeeded" json) ~default:0;
    errored = Option.value (int_field "errored" json) ~default:0;
    canceled = Option.value (int_field "canceled" json) ~default:0;
    expired = Option.value (int_field "expired" json) ~default:0;
  }

let batch_status_of_string = function
  | "in_progress" -> In_progress
  | "canceling" -> Canceling
  | "ended" -> Ended
  | value -> Unknown_batch_status value

let message_batch_of_json json =
  {
    batch_id = Option.value (string_field "id" json) ~default:"";
    batch_type = string_field "type" json;
    processing_status =
      json |> string_field "processing_status" |> Option.map batch_status_of_string
      |> Option.value ~default:(Unknown_batch_status "");
    request_counts =
      (match field "request_counts" json with
      | Some counts -> batch_counts_of_json counts
      | None -> batch_counts_of_json Chatoyant_runtime.Json.Null);
    ended_at = string_field "ended_at" json;
    created_at = string_field "created_at" json;
    expires_at = string_field "expires_at" json;
    archived_at = string_field "archived_at" json;
    cancel_initiated_at = string_field "cancel_initiated_at" json;
    results_url = string_field "results_url" json;
    raw = json;
  }

let batch_list_of_json json =
  {
    batches =
      (match field "data" json with
      | Some (Chatoyant_runtime.Json.Array values) -> List.map message_batch_of_json values
      | _ -> []);
    first_id = string_field "first_id" json;
    last_id = string_field "last_id" json;
    has_more = Option.value (bool_field "has_more" json) ~default:false;
    raw = json;
  }

let batch_result_of_json json =
  match string_field "type" json with
  | Some "succeeded" -> (
      match field "message" json with
      | Some message -> Batch_succeeded (response_of_json message)
      | None -> Batch_unknown json)
  | Some "errored" -> (
      match field "error" json with
      | Some error -> Batch_errored (api_error_of_json error)
      | None -> Batch_errored (api_error_of_json json))
  | Some "canceled" -> Batch_canceled
  | Some "expired" -> Batch_expired
  | _ -> Batch_unknown json

let batch_result_line_of_json json =
  let result_json = Option.value (field "result" json) ~default:Chatoyant_runtime.Json.Null in
  {
    result_custom_id = Option.value (string_field "custom_id" json) ~default:"";
    result = batch_result_of_json result_json;
    result_raw = json;
  }

let batch_result_lines_of_jsonl text =
  let lines =
    text
    |> String.split_on_char '\n'
    |> List.map String.trim
    |> List.filter (fun line -> line <> "")
  in
  let rec loop acc = function
    | [] -> Ok (List.rev acc)
    | line :: rest -> (
        match Chatoyant_runtime.Json.parse line with
        | Error message -> Error message
        | Ok json -> loop (batch_result_line_of_json json :: acc) rest)
  in
  loop [] lines

let file_metadata_of_json json =
  {
    file_id = Option.value (string_field "id" json) ~default:"";
    file_type = string_field "type" json;
    filename = string_field "filename" json;
    mime_type = string_field "mime_type" json;
    size_bytes = int_field "size_bytes" json;
    created_at = string_field "created_at" json;
    downloadable = bool_field "downloadable" json;
    file_raw = json;
  }

let file_list_of_json json =
  {
    files =
      (match field "data" json with
      | Some (Chatoyant_runtime.Json.Array values) -> List.map file_metadata_of_json values
      | _ -> []);
    first_id = string_field "first_id" json;
    last_id = string_field "last_id" json;
    has_more = Option.value (bool_field "has_more" json) ~default:false;
    raw = json;
  }

let file_delete_of_json json =
  {
    deleted_file_id = string_field "id" json;
    deleted = Option.value (bool_field "deleted" json) ~default:false;
    raw = json;
  }

let stream_delta_of_json json =
  match string_field "type" json with
  | Some "text_delta" -> Text_delta (Option.value (string_field "text" json) ~default:"")
  | Some "thinking_delta" ->
      Thinking_delta (Option.value (string_field "thinking" json) ~default:"")
  | Some "signature_delta" ->
      Signature_delta (Option.value (string_field "signature" json) ~default:"")
  | Some "input_json_delta" ->
      Input_json_delta (Option.value (string_field "partial_json" json) ~default:"")
  | _ -> Unknown_delta json

let stream_event_of_json event_type json =
  match event_type with
  | Some "message_start" -> (
      match field "message" json with
      | Some message -> Message_start (response_of_json message)
      | None -> Unknown_event { event_type; raw = json })
  | Some "content_block_start" -> (
      match field "content_block" json with
      | Some block ->
          Content_block_start
            {
              index = Option.value (int_field "index" json) ~default:0;
              block = content_block_of_json block;
            }
      | None -> Unknown_event { event_type; raw = json })
  | Some "content_block_delta" -> (
      match field "delta" json with
      | Some delta ->
          Content_block_delta
            {
              index = Option.value (int_field "index" json) ~default:0;
              delta = stream_delta_of_json delta;
            }
      | None -> Unknown_event { event_type; raw = json })
  | Some "content_block_stop" ->
      Content_block_stop (Option.value (int_field "index" json) ~default:0)
  | Some "message_delta" ->
      let delta = Option.value (field "delta" json) ~default:Chatoyant_runtime.Json.Null in
      let usage =
        match field "usage" json with
        | Some usage -> usage_of_json usage
        | None -> Chatoyant_tokens.Cost.empty_usage
      in
      Message_delta
        {
          stop_reason = Option.map stop_reason_of_string (string_field "stop_reason" delta);
          stop_sequence = string_field "stop_sequence" delta;
          usage;
        }
  | Some "message_stop" -> Message_stop
  | Some "ping" -> Ping
  | Some "error" -> Error (api_error_of_json json)
  | _ -> Unknown_event { event_type; raw = json }

let stream_event_of_sse sse =
  let data = Chatoyant_runtime.Sse.data_string sse in
  match Chatoyant_runtime.Json.parse data with
  | Error message -> Stdlib.Error message
  | Ok json -> Ok (stream_event_of_json sse.event json)

let stream_events_of_chunks chunks =
  let rec feed_chunks state acc = function
    | [] ->
        let final_events = Chatoyant_runtime.Sse.finish state in
        decode_events (List.rev (List.rev_append final_events acc))
    | chunk :: rest ->
        let state, events = Chatoyant_runtime.Sse.feed state chunk in
        feed_chunks state (List.rev_append events acc) rest
  and decode_events events =
    let rec loop acc = function
      | [] -> Ok (List.rev acc)
      | event :: rest -> (
          if Chatoyant_runtime.Sse.is_done event then loop acc rest
          else
            match stream_event_of_sse event with
            | Error message -> Stdlib.Error message
            | Ok decoded -> loop (decoded :: acc) rest)
    in
    loop [] events
  in
  feed_chunks Chatoyant_runtime.Sse.empty [] chunks

let empty_stream_state =
  {
    stream_id = None;
    stream_model = None;
    stream_role = None;
    stream_content = [];
    stream_stop_reason = None;
    stream_stop_sequence = None;
    stream_usage = Chatoyant_tokens.Cost.empty_usage;
  }

let replace_nth index replacement values =
  let rec loop current = function
    | [] when current = index -> [ replacement ]
    | [] -> []
    | _ :: rest when current = index -> replacement :: rest
    | value :: rest -> value :: loop (current + 1) rest
  in
  loop 0 values

let append_text_to_block text = function
  | Text existing -> Text (existing ^ text)
  | Thinking existing -> Thinking (existing ^ text)
  | block -> block

let append_delta index delta blocks =
  let current =
    match List.nth_opt blocks index with
    | Some block -> block
    | None -> Text ""
  in
  let replacement =
    match delta with
    | Text_delta text -> append_text_to_block text current
    | Thinking_delta text -> (
        match current with
        | Thinking existing -> Thinking (existing ^ text)
        | _ -> Thinking text)
    | Input_json_delta part -> (
        match current with
        | Tool_use { id; name; input = Chatoyant_runtime.Json.String existing } ->
            Tool_use { id; name; input = Chatoyant_runtime.Json.String (existing ^ part) }
        | Tool_use { id; name; input = _ } ->
            Tool_use { id; name; input = Chatoyant_runtime.Json.String part }
        | _ -> current)
    | Signature_delta _ | Unknown_delta _ -> current
  in
  replace_nth index replacement blocks

let apply_stream_event state = function
  | Message_start response ->
      {
        state with
        stream_id = response.response_id;
        stream_model = response.response_model;
        stream_role = response.response_role;
        stream_usage = response.response_usage;
      }
  | Content_block_start { index; block } ->
      { state with stream_content = replace_nth index block state.stream_content }
  | Content_block_delta { index; delta } ->
      { state with stream_content = append_delta index delta state.stream_content }
  | Content_block_stop _ | Ping | Error _ | Unknown_event _ -> state
  | Message_delta { stop_reason; stop_sequence; usage } ->
      {
        state with
        stream_stop_reason =
          (match stop_reason with Some _ -> stop_reason | None -> state.stream_stop_reason);
        stream_stop_sequence =
          (match stop_sequence with Some _ -> stop_sequence | None -> state.stream_stop_sequence);
        stream_usage =
          {
            state.stream_usage with
            output_tokens =
              if usage.output_tokens > 0 then usage.output_tokens else state.stream_usage.output_tokens;
            total_tokens =
              if usage.total_tokens > 0 then usage.total_tokens else state.stream_usage.total_tokens;
          };
      }
  | Message_stop -> state

let stream_state_to_response state =
  {
    response_id = state.stream_id;
    response_model = state.stream_model;
    response_role = state.stream_role;
    response_content = state.stream_content;
    response_stop_reason = state.stream_stop_reason;
    response_stop_sequence = state.stream_stop_sequence;
    response_usage = state.stream_usage;
    response_raw = Chatoyant_runtime.Json.Null;
  }

let response_of_stream_chunks chunks =
  match stream_events_of_chunks chunks with
  | Error _ as err -> err
  | Ok events ->
      let state = List.fold_left apply_stream_event empty_stream_state events in
      Ok (stream_state_to_response state)

let text_of_response response =
  response.response_content
  |> List.filter_map (function Text text -> Some text | _ -> None)
  |> String.concat ""

let provider_tool_call_of_block = function
  | Tool_use { id; name; input } ->
      Some
        {
          Provider.id;
          name;
          arguments = input;
          arguments_json = Chatoyant_runtime.Json.to_string input;
          raw = Some (content_block_json (Tool_use { id; name; input }));
        }
  | _ -> None

let generation_of_response response =
  {
    Provider.content = text_of_response response;
    reasoning_content =
      response.response_content
      |> List.filter_map (function Thinking text -> Some text | _ -> None)
      |> String.concat "";
    usage = response.response_usage;
    usage_source = Chatoyant_tokens.Cost.Provider_reported;
    tool_calls = List.filter_map provider_tool_call_of_block response.response_content;
    finish_reason = Option.map stop_reason_to_string response.response_stop_reason;
    raw = Some response.response_raw;
  }

module Make_client (Http : Chatoyant_runtime.Effect.HTTP) = struct
  type config = {
    api_key : string;
    base_url : string;
    timeout_ms : int option;
    beta_headers : string list;
  }

  let default_base_url = "https://api.anthropic.com/v1"

  let build_url config endpoint =
    let base =
      if String.ends_with ~suffix:"/" config.base_url then
        String.sub config.base_url 0 (String.length config.base_url - 1)
      else config.base_url
    in
    base ^ endpoint

  let files_beta = "files-api-2025-04-14"

  let add_missing value values =
    if List.mem value values then values else value :: values

  let headers ?(extra_betas = []) config =
    let base = authorization_headers ~api_key:config.api_key in
    let betas = List.fold_right add_missing extra_betas config.beta_headers in
    match betas with
    | [] -> base
    | betas -> ("anthropic-beta", String.concat "," betas) :: base

  let api_error_of_http status body =
    match Chatoyant_runtime.Json.parse body with
    | Ok json ->
        let err = api_error_of_json json in
        { err with error_message = err.error_message ^ " (HTTP " ^ string_of_int status ^ ")" }
    | Error _ ->
        {
          error_type = Some "http_error";
          error_message = "Anthropic HTTP " ^ string_of_int status ^ ": " ^ body;
          error_raw = None;
        }

  let map_http_error = function
    | Http.Timeout ms ->
        Stdlib.Error
          {
            error_type = Some "timeout_error";
            error_message = "Request timed out after " ^ string_of_int ms ^ "ms";
            error_raw = None;
          }
    | Network message ->
        Stdlib.Error
          { error_type = Some "network_error"; error_message = message; error_raw = None }
    | Invalid_response message ->
        Stdlib.Error
          { error_type = Some "invalid_response"; error_message = message; error_raw = None }

  let send decode request =
    match Http.send request with
    | Error error -> map_http_error error
    | Ok response when response.status < 200 || response.status >= 300 ->
        Stdlib.Error (api_error_of_http response.status response.body)
    | Ok response -> (
        match Chatoyant_runtime.Json.parse response.body with
        | Error message ->
            Stdlib.Error
              { error_type = Some "decode_error"; error_message = message; error_raw = None }
        | Ok json -> Ok (decode json))

  let send_text decode request =
    match Http.send request with
    | Error error -> map_http_error error
    | Ok response when response.status < 200 || response.status >= 300 ->
        Stdlib.Error (api_error_of_http response.status response.body)
    | Ok response -> (
        match decode response.body with
        | Ok value -> Ok value
        | Error message ->
            Stdlib.Error
              { error_type = Some "decode_error"; error_message = message; error_raw = None })

  let request ?(method_ = "POST") ?(extra_betas = []) config endpoint body =
    {
      Http.method_;
      url = build_url config endpoint;
      headers = headers ~extra_betas config;
      body;
      timeout_ms = config.timeout_ms;
    }

  let create_message config request_body =
    let request =
      request config "/messages" (Json (request_json request_body))
    in
    send response_of_json request

  let list_models config =
    send model_list_of_json (request ~method_:"GET" config "/models" Empty)

  let retrieve_model config ~model_id =
    send model_of_json (request ~method_:"GET" config ("/models/" ^ model_id) Empty)

  let create_message_batch config requests =
    send message_batch_of_json
      (request config "/messages/batches" (Json (batch_create_json requests)))

  let list_message_batches config =
    send batch_list_of_json (request ~method_:"GET" config "/messages/batches" Empty)

  let retrieve_message_batch config ~batch_id =
    send message_batch_of_json
      (request ~method_:"GET" config ("/messages/batches/" ^ batch_id) Empty)

  let cancel_message_batch config ~batch_id =
    send message_batch_of_json
      (request config ("/messages/batches/" ^ batch_id ^ "/cancel") Empty)

  let message_batch_results config ~batch_id =
    send_text batch_result_lines_of_jsonl
      (request ~method_:"GET" config ("/messages/batches/" ^ batch_id ^ "/results") Empty)

  let upload_file config upload =
    send file_metadata_of_json
      (request ~extra_betas:[ files_beta ] config "/files"
         (Multipart
            [
              {
                Http.name = "file";
                filename = Some upload.upload_filename;
                content_type = upload.upload_content_type;
                body = upload.upload_body;
              };
            ]))

  let list_files config =
    send file_list_of_json
      (request ~method_:"GET" ~extra_betas:[ files_beta ] config "/files" Empty)

  let retrieve_file config ~file_id =
    send file_metadata_of_json
      (request ~method_:"GET" ~extra_betas:[ files_beta ] config ("/files/" ^ file_id) Empty)

  let delete_file config ~file_id =
    send file_delete_of_json
      (request ~method_:"DELETE" ~extra_betas:[ files_beta ] config ("/files/" ^ file_id) Empty)

  let download_file config ~file_id =
    send_text (fun body -> Ok body)
      (request ~method_:"GET" ~extra_betas:[ files_beta ] config
         ("/files/" ^ file_id ^ "/content") Empty)
end

let anthropic_message_of_provider_message (message : Provider.message) =
  let content = Option.value message.content ~default:"" in
  match message.role with
  | Assistant ->
      let text_blocks = if content = "" then [] else [ Text content ] in
      let tool_blocks =
        List.map
          (fun (call : Provider.tool_call) ->
            Tool_use { id = call.id; name = call.name; input = call.arguments })
          message.tool_calls
      in
      { message_role = Assistant; message_content = text_blocks @ tool_blocks }
  | Tool ->
      {
        message_role = User;
        message_content =
          [
            Tool_result
              {
                tool_use_id = Option.value message.tool_call_id ~default:"";
                content;
                is_error = message.tool_result_error;
              };
          ];
      }
  | User | System -> { message_role = User; message_content = [ Text content ] }

let anthropic_tool_of_provider_tool (tool : Provider.tool_definition) =
  {
    tool_name = tool.tool_name;
    tool_description = tool.tool_description;
    input_schema = tool.tool_parameters;
  }

module Make_provider
    (Http : Chatoyant_runtime.Effect.HTTP)
    (Config : sig
      val api_key : string
      val base_url : string
      val timeout_ms : int option
      val beta_headers : string list
    end) =
struct
  module Client = Make_client (Http)

  let id = Provider.Anthropic

  let generate (messages : Provider.message list) (options : Provider.options) =
    let system_parts, non_system =
      List.partition (fun (message : Provider.message) -> message.role = Provider.System) messages
    in
    let system =
      system_parts
      |> List.filter_map (fun (message : Provider.message) -> message.content)
      |> String.concat "\n\n"
      |> fun value -> if value = "" then None else Some value
    in
    let request =
      {
        model = options.model;
        messages = List.map anthropic_message_of_provider_message non_system;
        system;
        max_tokens = Option.value options.max_tokens ~default:4096;
        stream = false;
        temperature = options.temperature;
        top_p = None;
        top_k = None;
        stop_sequences = [];
        metadata_user_id = None;
        tools = List.map anthropic_tool_of_provider_tool options.tools;
        tool_choice = Option.map (fun name -> Tool name) options.tool_choice;
        thinking = None;
        extra =
          (match options.extra with
          | Some (Chatoyant_runtime.Json.Object fields) -> fields
          | _ -> []);
      }
    in
    let config =
      {
        Client.api_key = Config.api_key;
        base_url = Config.base_url;
        timeout_ms = Config.timeout_ms;
        beta_headers = Config.beta_headers;
      }
    in
    match Client.create_message config request with
    | Ok response -> Ok (generation_of_response response)
    | Error error -> Error (Provider.Runtime_error error.error_message)
end
