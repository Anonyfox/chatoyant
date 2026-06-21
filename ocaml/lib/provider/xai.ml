type role =
  | System
  | User
  | Assistant
  | Tool

type message = {
  message_role : role;
  message_content : string option;
  message_name : string option;
  message_tool_call_id : string option;
  message_tool_calls : Provider.tool_call list;
}

type tool =
  | Function of Openai.function_tool
  | Web_search
  | Raw_tool of Chatoyant_runtime.Json.t

type tool_choice =
  | Auto
  | None_
  | Required
  | Tool of string
  | Raw_tool_choice of Chatoyant_runtime.Json.t

type response_format =
  | Text
  | Json_object
  | Json_schema of {
      schema_name : string;
      schema_description : string option;
      schema_value : Chatoyant_runtime.Json.t;
      schema_strict : bool;
    }

type chat_request = {
  chat_model : string;
  chat_messages : message list;
  chat_stream : bool;
  chat_temperature : float option;
  chat_max_tokens : int option;
  chat_top_p : float option;
  chat_stop : string list;
  chat_user : string option;
  chat_seed : int option;
  chat_logprobs : bool option;
  chat_top_logprobs : int option;
  chat_n : int option;
  chat_response_format : response_format option;
  chat_tools : tool list;
  chat_tool_choice : tool_choice option;
  chat_parallel_tool_calls : bool option;
  chat_extra : (string * Chatoyant_runtime.Json.t) list;
}

type chat_response = {
  response_id : string option;
  response_model : string option;
  response_content : string;
  response_reasoning_content : string;
  response_usage : Chatoyant_tokens.Cost.usage;
  response_raw : Chatoyant_runtime.Json.t;
}

type responses_input =
  | Responses_text of string
  | Responses_items of Chatoyant_runtime.Json.t list

type responses_request = {
  responses_model : string;
  responses_input : responses_input;
  responses_instructions : string option;
  responses_previous_response_id : string option;
  responses_store : bool option;
  responses_stream : bool;
  responses_temperature : float option;
  responses_top_p : float option;
  responses_max_output_tokens : int option;
  responses_tools : tool list;
  responses_tool_choice : tool_choice option;
  responses_text_format : response_format option;
  responses_parallel_tool_calls : bool option;
  responses_top_logprobs : int option;
  responses_truncation : string option;
  responses_extra : (string * Chatoyant_runtime.Json.t) list;
}

type response_status =
  | Completed
  | In_progress
  | Incomplete
  | Failed_response
  | Unknown_response_status of string

type responses_response = {
  responses_id : string option;
  responses_model : string option;
  responses_status : response_status;
  responses_output_text : string;
  responses_reasoning_text : string;
  responses_usage : Chatoyant_tokens.Cost.usage;
  responses_raw : Chatoyant_runtime.Json.t;
}

type delete_response = {
  deleted_id : string option;
  deleted : bool;
  deleted_raw : Chatoyant_runtime.Json.t;
}

type model = {
  model_id : string option;
  model_object : string option;
  model_owned_by : string option;
  model_created : int option;
  model_raw : Chatoyant_runtime.Json.t;
}

type model_list = {
  models : model list;
  models_raw : Chatoyant_runtime.Json.t;
}

type upload_part = {
  upload_filename : string;
  upload_content_type : string option;
  upload_body : string;
}

type file_upload = {
  file_filename : string;
  file_content_type : string option;
  file_body : string;
  file_purpose : string;
  file_expires_after : int option;
}

type file_object = {
  file_id : string option;
  file_object : string option;
  file_bytes : int option;
  file_filename : string option;
  file_purpose : string option;
  file_created_at : int option;
  file_expires_at : string option;
  file_raw : Chatoyant_runtime.Json.t;
}

type file_list = {
  files : file_object list;
  pagination_token : string option;
  raw : Chatoyant_runtime.Json.t;
}

type file_delete = {
  deleted_file_id : string option;
  deleted : bool;
  raw : Chatoyant_runtime.Json.t;
}

type batch_create_request = {
  batch_name : string;
}

type batch = {
  batch_id : string option;
  batch_create_api_key_id : string option;
  batch_create_time : string option;
  batch_name : string option;
  batch_state : Chatoyant_runtime.Json.t option;
  batch_raw : Chatoyant_runtime.Json.t;
}

type batch_list = {
  batches : batch list;
  pagination_token : string option;
  raw : Chatoyant_runtime.Json.t;
}

type batch_requests_add = {
  batch_requests : Chatoyant_runtime.Json.t list;
}

type batch_request_metadata_list = {
  batch_request_metadata : Chatoyant_runtime.Json.t list;
  pagination_token : string option;
  raw : Chatoyant_runtime.Json.t;
}

type api_error = {
  error_type : string option;
  error_message : string;
  error_raw : Chatoyant_runtime.Json.t option;
}

type image_response_format =
  | Url
  | Base64_json

type image_request = {
  image_model : string option;
  image_prompt : string;
  image_n : int option;
  image_response_format : image_response_format option;
  image_aspect_ratio : string option;
  image_resolution : string option;
  image_user : string option;
  image_extra : (string * Chatoyant_runtime.Json.t) list;
}

type image_edit_source = {
  source_url : string;
  source_type : string;
}

type image_edit_request = {
  edit_model : string option;
  edit_prompt : string;
  edit_images : image_edit_source list;
  edit_n : int option;
  edit_response_format : image_response_format option;
  edit_aspect_ratio : string option;
  edit_resolution : string option;
  edit_extra : (string * Chatoyant_runtime.Json.t) list;
}

type image_data = {
  image_url : string option;
  image_b64_json : string option;
  image_revised_prompt : string option;
}

type image_response = {
  image_created : int option;
  image_model : string option;
  image_data : image_data list;
  image_raw : Chatoyant_runtime.Json.t;
}

type video_request = {
  video_model : string option;
  video_prompt : string;
  video_duration : int option;
  video_aspect_ratio : string option;
  video_resolution : string option;
  video_image_url : string option;
  video_url : string option;
  video_extra : (string * Chatoyant_runtime.Json.t) list;
}

type video_start_response = {
  request_id : string;
  raw : Chatoyant_runtime.Json.t;
}

type video_status =
  | Queued
  | Processing
  | Done
  | Failed
  | Expired
  | Unknown_status of string

type video_status_response = {
  status : video_status;
  video_url : string option;
  video_duration : int option;
  video_model : string option;
  raw : Chatoyant_runtime.Json.t;
}

type collection_request = {
  collection_name : string;
  collection_description : string option;
  collection_index_configuration : Chatoyant_runtime.Json.t option;
  collection_field_definitions : Chatoyant_runtime.Json.t list;
  collection_extra : (string * Chatoyant_runtime.Json.t) list;
}

type collection_update = {
  collection_update_name : string option;
  collection_update_description : string option;
  collection_update_index_configuration : Chatoyant_runtime.Json.t option;
  collection_update_field_definitions : Chatoyant_runtime.Json.t list;
  collection_update_extra : (string * Chatoyant_runtime.Json.t) list;
}

type collection = {
  collection_id : string option;
  collection_name : string option;
  collection_description : string option;
  collection_created_at : string option;
  collection_documents_count : int option;
  collection_index_configuration : Chatoyant_runtime.Json.t option;
  collection_field_definitions : Chatoyant_runtime.Json.t option;
  collection_raw : Chatoyant_runtime.Json.t;
}

type collection_list = {
  collections : collection list;
  collections_pagination_token : string option;
  collections_raw : Chatoyant_runtime.Json.t;
}

type collection_document = {
  document_file_metadata : Chatoyant_runtime.Json.t option;
  document_status : string option;
  document_error_message : string option;
  document_last_indexed_at : string option;
  document_fields : Chatoyant_runtime.Json.t option;
  document_raw : Chatoyant_runtime.Json.t;
}

type collection_document_list = {
  collection_documents : collection_document list;
  collection_documents_pagination_token : string option;
  collection_documents_raw : Chatoyant_runtime.Json.t;
}

type collection_delete = {
  collection_delete_id : string option;
  collection_deleted : bool;
  collection_delete_raw : Chatoyant_runtime.Json.t;
}

type collection_search_request = {
  collection_search_query : string;
  collection_search_limit : int option;
  collection_search_filter : string option;
  collection_search_extra : (string * Chatoyant_runtime.Json.t) list;
}

type collection_search_response = {
  collection_search_results : Chatoyant_runtime.Json.t list;
  collection_search_raw : Chatoyant_runtime.Json.t;
}

let string value = Chatoyant_runtime.Json.String value
let bool value = Chatoyant_runtime.Json.Bool value
let int value = Chatoyant_runtime.Json.Float (Float.of_int value)
let float value = Chatoyant_runtime.Json.Float value
let field = Chatoyant_runtime.Json.field

let add_opt name encode value fields =
  match value with
  | None -> fields
  | Some value -> (name, encode value) :: fields

let add_non_empty name encode values fields =
  match values with
  | [] -> fields
  | _ -> (name, Chatoyant_runtime.Json.Array (List.map encode values)) :: fields

let role_to_string = function
  | System -> "system"
  | User -> "user"
  | Assistant -> "assistant"
  | Tool -> "tool"

let message_json message =
  let tool_call_json (call : Provider.tool_call) =
    Chatoyant_runtime.Json.Object
      [
        ("id", string call.id);
        ("type", string "function");
        ( "function",
          Chatoyant_runtime.Json.Object
            [ ("name", string call.name); ("arguments", string call.arguments_json) ] );
      ]
  in
  [ ("role", string (role_to_string message.message_role)) ]
  |> add_opt "content" string message.message_content
  |> add_opt "name" string message.message_name
  |> add_opt "tool_call_id" string message.message_tool_call_id
  |> add_non_empty "tool_calls" tool_call_json message.message_tool_calls
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let tool_json = function
  | Function tool -> Openai.function_tool_json tool
  | Web_search -> Chatoyant_runtime.Json.Object [ ("type", string "web_search") ]
  | Raw_tool json -> json

let tool_choice_json = function
  | Auto -> string "auto"
  | None_ -> string "none"
  | Required -> string "required"
  | Tool name ->
      Chatoyant_runtime.Json.Object
        [ ("type", string "function"); ("function", Chatoyant_runtime.Json.Object [ ("name", string name) ]) ]
  | Raw_tool_choice json -> json

let response_format_json = function
  | Text -> Chatoyant_runtime.Json.Object [ ("type", string "text") ]
  | Json_object -> Chatoyant_runtime.Json.Object [ ("type", string "json_object") ]
  | Json_schema { schema_name; schema_description; schema_value; schema_strict } ->
      let json_schema =
        [
          ("name", string schema_name);
          ("schema", schema_value);
          ("strict", bool schema_strict);
        ]
        |> add_opt "description" string schema_description
        |> List.rev
      in
      Chatoyant_runtime.Json.Object
        [ ("type", string "json_schema"); ("json_schema", Chatoyant_runtime.Json.Object json_schema) ]

let chat_request_json request =
  [
    ("model", string request.chat_model);
    ("messages", Chatoyant_runtime.Json.Array (List.map message_json request.chat_messages));
    ("stream", bool request.chat_stream);
  ]
  |> add_opt "temperature" float request.chat_temperature
  |> add_opt "max_tokens" int request.chat_max_tokens
  |> add_opt "top_p" float request.chat_top_p
  |> add_non_empty "stop" string request.chat_stop
  |> add_opt "user" string request.chat_user
  |> add_opt "seed" int request.chat_seed
  |> add_opt "logprobs" bool request.chat_logprobs
  |> add_opt "top_logprobs" int request.chat_top_logprobs
  |> add_opt "n" int request.chat_n
  |> add_opt "response_format" response_format_json request.chat_response_format
  |> add_non_empty "tools" tool_json request.chat_tools
  |> add_opt "tool_choice" tool_choice_json request.chat_tool_choice
  |> add_opt "parallel_tool_calls" bool request.chat_parallel_tool_calls
  |> List.rev_append request.chat_extra
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let responses_input_json = function
  | Responses_text text -> string text
  | Responses_items items -> Chatoyant_runtime.Json.Array items

let responses_text_json format =
  Chatoyant_runtime.Json.Object [ ("format", response_format_json format) ]

let responses_request_json request =
  [
    ("model", string request.responses_model);
    ("input", responses_input_json request.responses_input);
    ("stream", bool request.responses_stream);
  ]
  |> add_opt "instructions" string request.responses_instructions
  |> add_opt "previous_response_id" string request.responses_previous_response_id
  |> add_opt "store" bool request.responses_store
  |> add_opt "temperature" float request.responses_temperature
  |> add_opt "top_p" float request.responses_top_p
  |> add_opt "max_output_tokens" int request.responses_max_output_tokens
  |> add_non_empty "tools" tool_json request.responses_tools
  |> add_opt "tool_choice" tool_choice_json request.responses_tool_choice
  |> add_opt "text" responses_text_json request.responses_text_format
  |> add_opt "parallel_tool_calls" bool request.responses_parallel_tool_calls
  |> add_opt "top_logprobs" int request.responses_top_logprobs
  |> add_opt "truncation" string request.responses_truncation
  |> List.rev_append request.responses_extra
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let batch_create_request_json (request : batch_create_request) =
  Chatoyant_runtime.Json.Object [ ("name", string request.batch_name) ]

let batch_requests_add_json (request : batch_requests_add) =
  Chatoyant_runtime.Json.Object
    [ ("batch_requests", Chatoyant_runtime.Json.Array request.batch_requests) ]

let collection_request_json request =
  [
    ("collection_name", string request.collection_name);
  ]
  |> add_opt "collection_description" string request.collection_description
  |> add_opt "index_configuration" (fun value -> value) request.collection_index_configuration
  |> add_non_empty "field_definitions" (fun value -> value) request.collection_field_definitions
  |> List.rev_append request.collection_extra
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let collection_update_json request =
  []
  |> add_opt "collection_name" string request.collection_update_name
  |> add_opt "collection_description" string request.collection_update_description
  |> add_opt "index_configuration" (fun value -> value) request.collection_update_index_configuration
  |> add_non_empty "field_definitions" (fun value -> value) request.collection_update_field_definitions
  |> List.rev_append request.collection_update_extra
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let collection_search_request_json request =
  [
    ("query", string request.collection_search_query);
  ]
  |> add_opt "limit" int request.collection_search_limit
  |> add_opt "filter" string request.collection_search_filter
  |> List.rev_append request.collection_search_extra
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let image_response_format_json = function
  | Url -> string "url"
  | Base64_json -> string "b64_json"

let image_request_json request =
  [
    ("prompt", string request.image_prompt);
  ]
  |> add_opt "model" string request.image_model
  |> add_opt "n" int request.image_n
  |> add_opt "response_format" image_response_format_json request.image_response_format
  |> add_opt "aspect_ratio" string request.image_aspect_ratio
  |> add_opt "resolution" string request.image_resolution
  |> add_opt "user" string request.image_user
  |> List.rev_append request.image_extra
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let image_source_json source =
  Chatoyant_runtime.Json.Object
    [ ("url", string source.source_url); ("type", string source.source_type) ]

let image_edit_request_json request =
  let image_field =
    match request.edit_images with
    | [ source ] -> [ ("image", image_source_json source) ]
    | sources -> [ ("image", Chatoyant_runtime.Json.Array (List.map image_source_json sources)) ]
  in
  [
    ("prompt", string request.edit_prompt);
  ]
  |> List.rev_append image_field
  |> add_opt "model" string request.edit_model
  |> add_opt "n" int request.edit_n
  |> add_opt "response_format" image_response_format_json request.edit_response_format
  |> add_opt "aspect_ratio" string request.edit_aspect_ratio
  |> add_opt "resolution" string request.edit_resolution
  |> List.rev_append request.edit_extra
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let video_request_json request =
  [
    ("prompt", string request.video_prompt);
  ]
  |> add_opt "model" string request.video_model
  |> add_opt "duration" int request.video_duration
  |> add_opt "aspect_ratio" string request.video_aspect_ratio
  |> add_opt "resolution" string request.video_resolution
  |> add_opt "image_url" string request.video_image_url
  |> add_opt "video_url" string request.video_url
  |> List.rev_append request.video_extra
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let authorization_headers ~api_key =
  [ ("Authorization", "Bearer " ^ api_key); ("Content-Type", "application/json") ]

let string_field name json = Option.bind (field name json) Chatoyant_runtime.Json.as_string
let int_field name json = Option.bind (field name json) Chatoyant_runtime.Json.as_int
let bool_field name json = Option.bind (field name json) Chatoyant_runtime.Json.as_bool

let api_error_of_json json =
  match field "error" json with
  | Some error ->
      {
        error_type = string_field "type" error;
        error_message = Option.value (string_field "message" error) ~default:"xAI API error";
        error_raw = Some json;
      }
  | None ->
      {
        error_type = string_field "type" json;
        error_message = Option.value (string_field "message" json) ~default:"xAI API error";
        error_raw = Some json;
      }

let chat_response_of_json json =
  let response_content =
    match Openai_decode.chat_content json with
    | Some text -> text
    | None -> ""
  in
  let response_reasoning_content =
    match field "choices" json with
    | Some (Chatoyant_runtime.Json.Array (choice :: _)) -> (
        match field "message" choice with
        | Some message ->
            Option.value (string_field "reasoning_content" message) ~default:""
        | None -> "")
    | _ -> ""
  in
  {
    response_id = string_field "id" json;
    response_model = string_field "model" json;
    response_content;
    response_reasoning_content;
    response_usage =
      (match field "usage" json with
      | Some usage -> Usage.xai usage
      | None -> Chatoyant_tokens.Cost.empty_usage);
    response_raw = json;
  }

let provider_tool_call_of_json json =
  match field "function" json with
  | None -> None
  | Some fn ->
      let name = Option.value (string_field "name" fn) ~default:"" in
      let arguments_json = Option.value (string_field "arguments" fn) ~default:"" in
      let arguments =
        match Chatoyant_runtime.Json.parse arguments_json with
        | Ok json -> json
        | Error _ -> Chatoyant_runtime.Json.Null
      in
      Some
        {
          Provider.id = Option.value (string_field "id" json) ~default:"";
          name;
          arguments;
          arguments_json;
          raw = Some json;
        }

let provider_tool_calls_of_chat_json json =
  match field "choices" json with
  | Some (Chatoyant_runtime.Json.Array (choice :: _)) -> (
      match field "message" choice with
      | Some message -> (
          match field "tool_calls" message with
          | Some (Chatoyant_runtime.Json.Array values) ->
              List.filter_map provider_tool_call_of_json values
          | _ -> [])
      | None -> [])
  | _ -> []

let generation_of_chat_response response =
  {
    Provider.content = response.response_content;
    reasoning_content = response.response_reasoning_content;
    usage = response.response_usage;
    usage_source = Chatoyant_tokens.Cost.Provider_reported;
    tool_calls = provider_tool_calls_of_chat_json response.response_raw;
    finish_reason =
      (match field "choices" response.response_raw with
      | Some (Chatoyant_runtime.Json.Array (choice :: _)) -> string_field "finish_reason" choice
      | _ -> None);
    raw = Some response.response_raw;
  }

let response_status_of_string = function
  | "completed" -> Completed
  | "in_progress" -> In_progress
  | "incomplete" -> Incomplete
  | "failed" -> Failed_response
  | value -> Unknown_response_status value

let content_text block =
  match field "type" block with
  | Some (Chatoyant_runtime.Json.String "output_text") ->
      Option.value (string_field "text" block) ~default:""
  | Some (Chatoyant_runtime.Json.String "text") ->
      Option.value (string_field "text" block) ~default:""
  | _ -> ""

let output_item_text item =
  match field "content" item with
  | Some (Chatoyant_runtime.Json.Array blocks) ->
      blocks |> List.map content_text |> String.concat ""
  | _ -> ""

let summary_text summary =
  match field "text" summary with
  | Some value -> Option.value (Chatoyant_runtime.Json.as_string value) ~default:""
  | None -> ""

let reasoning_item_text item =
  match field "summary" item with
  | Some (Chatoyant_runtime.Json.Array summaries) ->
      summaries |> List.map summary_text |> String.concat ""
  | _ -> ""

let responses_usage json =
  match field "usage" json with
  | None -> Chatoyant_tokens.Cost.empty_usage
  | Some usage ->
      let input_tokens = Option.value (int_field "input_tokens" usage) ~default:0 in
      let output_tokens = Option.value (int_field "output_tokens" usage) ~default:0 in
      let reasoning_tokens =
        match field "output_tokens_details" usage with
        | Some details -> Option.value (int_field "reasoning_tokens" details) ~default:0
        | None -> 0
      in
      let cached_tokens =
        match field "input_tokens_details" usage with
        | Some details -> Option.value (int_field "cached_tokens" details) ~default:0
        | None -> 0
      in
      let ticks =
        match field "cost_in_usd_ticks" usage with
        | Some value -> Option.value (Chatoyant_runtime.Json.as_float value) ~default:0.0
        | None -> 0.0
      in
      {
        Chatoyant_tokens.Cost.input_tokens;
        output_tokens;
        reasoning_tokens;
        cached_tokens;
        cache_write_tokens = 0;
        total_tokens = Option.value (int_field "total_tokens" usage) ~default:(input_tokens + output_tokens);
        actual_cost_usd = if ticks > 0.0 then Some (ticks /. 10_000_000_000.0) else None;
      }

let responses_response_of_json json =
  let output_items =
    match field "output" json with
    | Some (Chatoyant_runtime.Json.Array items) -> items
    | _ -> []
  in
  {
    responses_id = string_field "id" json;
    responses_model = string_field "model" json;
    responses_status =
      json |> string_field "status" |> Option.map response_status_of_string
      |> Option.value ~default:(Unknown_response_status "");
    responses_output_text = output_items |> List.map output_item_text |> String.concat "";
    responses_reasoning_text = output_items |> List.map reasoning_item_text |> String.concat "";
    responses_usage = responses_usage json;
    responses_raw = json;
  }

let generation_of_responses_response response =
  {
    Provider.content = response.responses_output_text;
    reasoning_content = response.responses_reasoning_text;
    usage = response.responses_usage;
    usage_source = Chatoyant_tokens.Cost.Provider_reported;
    tool_calls = [];
    finish_reason =
      (match response.responses_status with
      | Completed -> Some "completed"
      | In_progress -> Some "in_progress"
      | Incomplete -> Some "incomplete"
      | Failed_response -> Some "failed"
      | Unknown_response_status "" -> None
      | Unknown_response_status value -> Some value);
    raw = Some response.responses_raw;
  }

let delete_response_of_json json =
  {
    deleted_id = string_field "id" json;
    deleted =
      (match field "deleted" json with
      | Some value -> Option.value (Chatoyant_runtime.Json.as_bool value) ~default:false
      | None -> false);
    deleted_raw = json;
  }

let model_of_json json =
  {
    model_id = string_field "id" json;
    model_object = string_field "object" json;
    model_owned_by = string_field "owned_by" json;
    model_created = int_field "created" json;
    model_raw = json;
  }

let model_list_of_json json =
  let values =
    match field "data" json with
    | Some (Chatoyant_runtime.Json.Array items) -> items
    | _ -> (
        match field "models" json with
        | Some (Chatoyant_runtime.Json.Array items) -> items
        | _ -> [])
  in
  { models = List.map model_of_json values; models_raw = json }

let file_object_of_json json =
  {
    file_id = string_field "id" json;
    file_object = string_field "object" json;
    file_bytes =
      (match int_field "bytes" json with
      | Some _ as value -> value
      | None -> int_field "size" json);
    file_filename = string_field "filename" json;
    file_purpose = string_field "purpose" json;
    file_created_at = int_field "created_at" json;
    file_expires_at = string_field "expires_at" json;
    file_raw = json;
  }

let file_list_of_json json =
  {
    files =
      (match field "data" json with
      | Some (Chatoyant_runtime.Json.Array values) -> List.map file_object_of_json values
      | _ -> []);
    pagination_token = string_field "pagination_token" json;
    raw = json;
  }

let file_delete_of_json json =
  {
    deleted_file_id = string_field "id" json;
    deleted = Option.value (bool_field "deleted" json) ~default:false;
    raw = json;
  }

let batch_of_json json =
  {
    batch_id = string_field "batch_id" json;
    batch_create_api_key_id = string_field "create_api_key_id" json;
    batch_create_time = string_field "create_time" json;
    batch_name = string_field "name" json;
    batch_state = field "state" json;
    batch_raw = json;
  }

let batch_list_of_json json =
  {
    batches =
      (match field "batches" json with
      | Some (Chatoyant_runtime.Json.Array values) -> List.map batch_of_json values
      | _ -> []);
    pagination_token = string_field "pagination_token" json;
    raw = json;
  }

let batch_request_metadata_list_of_json json =
  {
    batch_request_metadata =
      (match field "batch_request_metadata" json with
      | Some (Chatoyant_runtime.Json.Array values) -> values
      | _ -> []);
    pagination_token = string_field "pagination_token" json;
    raw = json;
  }

let stream_response_of_chunks chunks =
  let rec feed state acc = function
    | [] ->
        let events = List.rev (List.rev_append (Chatoyant_runtime.Sse.finish state) acc) in
        decode events Openai_stream.empty
    | chunk :: rest ->
        let state, events = Chatoyant_runtime.Sse.feed state chunk in
        feed state (List.rev_append events acc) rest
  and decode events accumulated =
    match events with
    | [] ->
        Ok
          {
            response_id = None;
            response_model = None;
            response_content = accumulated.Openai_stream.accumulated_content;
            response_reasoning_content = accumulated.accumulated_reasoning_content;
            response_usage =
              (match accumulated.accumulated_usage with
              | Some usage -> Usage.xai usage
              | None -> Chatoyant_tokens.Cost.empty_usage);
            response_raw = Chatoyant_runtime.Json.Null;
          }
    | event :: rest ->
        if Chatoyant_runtime.Sse.is_done event then decode rest accumulated
        else
          match Chatoyant_runtime.Json.parse (Chatoyant_runtime.Sse.data_string event) with
          | Error message -> Error message
          | Ok json -> decode rest (Openai_stream.apply_chunk_json accumulated json)
  in
  feed Chatoyant_runtime.Sse.empty [] chunks

let image_data_of_json json =
  {
    image_url = string_field "url" json;
    image_b64_json = string_field "b64_json" json;
    image_revised_prompt = string_field "revised_prompt" json;
  }

let image_response_of_json json =
  {
    image_created = int_field "created" json;
    image_model = string_field "model" json;
    image_data =
      (match field "data" json with
      | Some (Chatoyant_runtime.Json.Array values) -> List.map image_data_of_json values
      | _ -> []);
    image_raw = json;
  }

let video_start_response_of_json json =
  {
    request_id = Option.value (string_field "request_id" json) ~default:"";
    raw = json;
  }

let video_status_of_string = function
  | "queued" -> Queued
  | "processing" -> Processing
  | "done" | "completed" -> Done
  | "failed" -> Failed
  | "expired" -> Expired
  | value -> Unknown_status value

let video_status_response_of_json json =
  let video = Option.value (field "video" json) ~default:Chatoyant_runtime.Json.Null in
  {
    status =
      json |> string_field "status" |> Option.map video_status_of_string
      |> Option.value ~default:(Unknown_status "");
    video_url =
      (match string_field "url" video with
      | Some _ as value -> value
      | None -> string_field "video_url" json);
    video_duration =
      (match int_field "duration" video with
      | Some _ as value -> value
      | None -> int_field "duration" json);
    video_model =
      (match string_field "model" video with
      | Some _ as value -> value
      | None -> string_field "model" json);
    raw = json;
  }

let collection_of_json json =
  {
    collection_id = string_field "collection_id" json;
    collection_name = string_field "collection_name" json;
    collection_description = string_field "collection_description" json;
    collection_created_at = string_field "created_at" json;
    collection_documents_count = int_field "documents_count" json;
    collection_index_configuration = field "index_configuration" json;
    collection_field_definitions = field "field_definitions" json;
    collection_raw = json;
  }

let collection_list_of_json json =
  {
    collections =
      (match field "collections" json with
      | Some (Chatoyant_runtime.Json.Array values) -> List.map collection_of_json values
      | _ -> []);
    collections_pagination_token = string_field "pagination_token" json;
    collections_raw = json;
  }

let collection_document_of_json json =
  {
    document_file_metadata = field "file_metadata" json;
    document_status = string_field "status" json;
    document_error_message = string_field "error_message" json;
    document_last_indexed_at = string_field "last_indexed_at" json;
    document_fields = field "fields" json;
    document_raw = json;
  }

let collection_document_list_of_json json =
  {
    collection_documents =
      (match field "documents" json with
      | Some (Chatoyant_runtime.Json.Array values) -> List.map collection_document_of_json values
      | _ -> []);
    collection_documents_pagination_token = string_field "pagination_token" json;
    collection_documents_raw = json;
  }

let collection_delete_of_json json =
  {
    collection_delete_id =
      (match string_field "collection_id" json with
      | Some _ as value -> value
      | None -> string_field "id" json);
    collection_deleted = Option.value (bool_field "deleted" json) ~default:true;
    collection_delete_raw = json;
  }

let collection_search_response_of_json json =
  let results =
    match field "results" json with
    | Some (Chatoyant_runtime.Json.Array values) -> values
    | _ -> (
        match field "documents" json with
        | Some (Chatoyant_runtime.Json.Array values) -> values
        | _ -> [])
  in
  { collection_search_results = results; collection_search_raw = json }

module Make_client (Http : Chatoyant_runtime.Effect.HTTP) = struct
  type config = {
    api_key : string;
    base_url : string;
    timeout_ms : int option;
  }

  type management_config = {
    management_api_key : string;
    management_base_url : string;
    management_timeout_ms : int option;
  }

  let default_base_url = "https://api.x.ai/v1"
  let default_management_base_url = "https://management-api.x.ai/v1"

  let trim_base base_url =
    if String.ends_with ~suffix:"/" base_url then
      String.sub base_url 0 (String.length base_url - 1)
    else base_url

  let endpoint config path = trim_base config.base_url ^ path
  let management_endpoint config path = trim_base config.management_base_url ^ path

  let query params =
    let values =
      List.filter_map
        (fun (name, value) -> Option.map (fun value -> name ^ "=" ^ value) value)
        params
    in
    match values with
    | [] -> ""
    | _ -> "?" ^ String.concat "&" values

  let query_int value = Option.map string_of_int value

  let headers_for_body ~api_key body =
    let headers = authorization_headers ~api_key in
    match body with
    | Http.Multipart _ ->
        headers |> List.filter (fun (name, _) -> String.lowercase_ascii name <> "content-type")
    | _ -> headers

  let request ?(method_ = "POST") config path body =
    {
      Http.method_;
      url = endpoint config path;
      headers = headers_for_body ~api_key:config.api_key body;
      body;
      timeout_ms = config.timeout_ms;
    }

  let management_request ?(method_ = "POST") config path body =
    {
      Http.method_;
      url = management_endpoint config path;
      headers = headers_for_body ~api_key:config.management_api_key body;
      body;
      timeout_ms = config.management_timeout_ms;
    }

  let parse_response decode response =
    if response.Http.status < 200 || response.status >= 300 then
      match Chatoyant_runtime.Json.parse response.body with
      | Ok json -> Error (api_error_of_json json)
      | Error _ ->
          Error
            {
              error_type = Some "http_error";
              error_message = "xAI HTTP " ^ string_of_int response.status ^ ": " ^ response.body;
              error_raw = None;
            }
    else
      match Chatoyant_runtime.Json.parse response.body with
      | Error message ->
          Error { error_type = Some "decode_error"; error_message = message; error_raw = None }
      | Ok json -> Ok (decode json)

  let map_http_error = function
    | Http.Timeout ms ->
        { error_type = Some "timeout_error"; error_message = "Request timed out after " ^ string_of_int ms ^ "ms"; error_raw = None }
    | Network message -> { error_type = Some "network_error"; error_message = message; error_raw = None }
    | Invalid_response message ->
        { error_type = Some "invalid_response"; error_message = message; error_raw = None }

  let send decode request =
    match Http.send request with
    | Error error -> Error (map_http_error error)
    | Ok response -> parse_response decode response

  let raw_response request =
    match Http.send request with
    | Error error -> Error (map_http_error error)
    | Ok response when response.status < 200 || response.status >= 300 ->
        (match Chatoyant_runtime.Json.parse response.body with
        | Ok json -> Error (api_error_of_json json)
        | Error _ ->
            Error
              {
                error_type = Some "http_error";
                error_message = "xAI HTTP " ^ string_of_int response.status ^ ": " ^ response.body;
                error_raw = None;
              })
    | Ok response -> Ok response.body

  let multipart_part name ?filename ?content_type body =
    { Http.name; filename; content_type; body }

  let file_upload_parts (upload : file_upload) =
    let fields =
      [
        multipart_part "purpose" upload.file_purpose;
      ]
    in
    let fields =
      match upload.file_expires_after with
      | None -> fields
      | Some seconds -> fields @ [ multipart_part "expires_after" (string_of_int seconds) ]
    in
    fields
    @ [
        multipart_part "file" ~filename:upload.file_filename ?content_type:upload.file_content_type
          upload.file_body;
      ]

  let create_chat config request_body =
    send chat_response_of_json (request config "/chat/completions" (Json (chat_request_json request_body)))

  let create_response config request_body =
    send responses_response_of_json (request config "/responses" (Json (responses_request_json request_body)))

  let compact_response config request_body =
    send responses_response_of_json
      (request config "/responses/compact" (Json (responses_request_json request_body)))

  let retrieve_response config ~response_id =
    send responses_response_of_json (request ~method_:"GET" config ("/responses/" ^ response_id) Empty)

  let delete_response config ~response_id =
    send delete_response_of_json (request ~method_:"DELETE" config ("/responses/" ^ response_id) Empty)

  let list_models config =
    send model_list_of_json (request ~method_:"GET" config "/models" Empty)

  let upload_file config upload =
    send file_object_of_json (request config "/files" (Multipart (file_upload_parts upload)))

  let list_files ?limit ?order ?sort_by ?pagination_token config =
    let path =
      "/files"
      ^ query
          [
            ("limit", query_int limit);
            ("order", order);
            ("sort_by", sort_by);
            ("pagination_token", pagination_token);
          ]
    in
    send file_list_of_json (request ~method_:"GET" config path Empty)

  let retrieve_file config ~file_id =
    send file_object_of_json (request ~method_:"GET" config ("/files/" ^ file_id) Empty)

  let delete_file config ~file_id =
    send file_delete_of_json (request ~method_:"DELETE" config ("/files/" ^ file_id) Empty)

  let download_file config ~file_id =
    raw_response (request ~method_:"GET" config ("/files/" ^ file_id ^ "/content") Empty)

  let create_batch config request_body =
    send batch_of_json (request config "/batches" (Json (batch_create_request_json request_body)))

  let list_batches config =
    send batch_list_of_json (request ~method_:"GET" config "/batches" Empty)

  let retrieve_batch config ~batch_id =
    send batch_of_json (request ~method_:"GET" config ("/batches/" ^ batch_id) Empty)

  let list_batch_requests config ~batch_id =
    send batch_request_metadata_list_of_json
      (request ~method_:"GET" config ("/batches/" ^ batch_id ^ "/requests") Empty)

  let add_batch_requests config ~batch_id request_body =
    send batch_request_metadata_list_of_json
      (request config ("/batches/" ^ batch_id ^ "/requests")
         (Json (batch_requests_add_json request_body)))

  let batch_results config ~batch_id =
    send batch_of_json
      (request ~method_:"GET" config ("/batches/" ^ batch_id ^ "/results") Empty)

  let cancel_batch config ~batch_id =
    send batch_of_json
      (request config ("/batches/" ^ batch_id ^ "/cancel") Empty)

  let generate_image config request_body =
    send image_response_of_json (request config "/images/generations" (Json (image_request_json request_body)))

  let edit_image config request_body =
    send image_response_of_json (request config "/images/edits" (Json (image_edit_request_json request_body)))

  let start_video config request_body =
    send video_start_response_of_json (request config "/videos/generations" (Json (video_request_json request_body)))

  let get_video_status config ~request_id =
    send video_status_response_of_json (request ~method_:"GET" config ("/videos/" ^ request_id) Empty)

  let download_video config ~request_id =
    raw_response (request ~method_:"GET" config ("/videos/" ^ request_id ^ "/content") Empty)

  let create_collection config request_body =
    send collection_of_json
      (management_request config "/collections" (Json (collection_request_json request_body)))

  let list_collections ?limit ?order ?sort_by ?pagination_token ?filter config =
    let path =
      "/collections"
      ^ query
          [
            ("limit", query_int limit);
            ("order", order);
            ("sort_by", sort_by);
            ("pagination_token", pagination_token);
            ("filter", filter);
          ]
    in
    send collection_list_of_json (management_request ~method_:"GET" config path Empty)

  let retrieve_collection config ~collection_id =
    send collection_of_json
      (management_request ~method_:"GET" config ("/collections/" ^ collection_id) Empty)

  let update_collection config ~collection_id request_body =
    send collection_of_json
      (management_request ~method_:"PUT" config
         ("/collections/" ^ collection_id)
         (Json (collection_update_json request_body)))

  let delete_collection config ~collection_id =
    send collection_delete_of_json
      (management_request ~method_:"DELETE" config ("/collections/" ^ collection_id) Empty)

  let add_collection_document config ~collection_id ~file_id ~fields =
    let body =
      match fields with
      | None -> Http.Json (Chatoyant_runtime.Json.Object [])
      | Some fields -> Http.Json (Chatoyant_runtime.Json.Object [ ("fields", fields) ])
    in
    send collection_document_of_json
      (management_request config ("/collections/" ^ collection_id ^ "/documents/" ^ file_id) body)

  let list_collection_documents ?limit ?order ?sort_by ?pagination_token ?filter config ~collection_id =
    let path =
      "/collections/" ^ collection_id ^ "/documents"
      ^ query
          [
            ("limit", query_int limit);
            ("order", order);
            ("sort_by", sort_by);
            ("pagination_token", pagination_token);
            ("filter", filter);
          ]
    in
    send collection_document_list_of_json (management_request ~method_:"GET" config path Empty)

  let retrieve_collection_document config ~collection_id ~file_id =
    send collection_document_of_json
      (management_request ~method_:"GET" config
         ("/collections/" ^ collection_id ^ "/documents/" ^ file_id)
         Empty)

  let regenerate_collection_document config ~collection_id ~file_id =
    send collection_document_of_json
      (management_request ~method_:"POST" config
         ("/collections/" ^ collection_id ^ "/documents/" ^ file_id ^ "/regenerate")
         Empty)

  let remove_collection_document config ~collection_id ~file_id =
    send collection_delete_of_json
      (management_request ~method_:"DELETE" config
         ("/collections/" ^ collection_id ^ "/documents/" ^ file_id)
         Empty)

  let search_collection config ~collection_id request_body =
    send collection_search_response_of_json
      (management_request config
         ("/collections/" ^ collection_id ^ "/search")
         (Json (collection_search_request_json request_body)))
end

let xai_message_of_provider_message (message : Provider.message) =
  let role =
    match message.role with
    | Provider.System -> System
    | User -> User
    | Assistant -> Assistant
    | Tool -> Tool
  in
  {
    message_role = role;
    message_content = message.content;
    message_name = message.name;
    message_tool_call_id = message.tool_call_id;
    message_tool_calls = message.tool_calls;
  }

let openai_function_tool_of_provider_tool (tool : Provider.tool_definition) =
  {
    Openai.tool_name = tool.tool_name;
    tool_description = tool.tool_description;
    tool_parameters = tool.tool_parameters;
    tool_strict = tool.tool_strict;
  }

module Make_provider
    (Http : Chatoyant_runtime.Effect.HTTP)
    (Config : sig
      val api_key : string
      val base_url : string
      val timeout_ms : int option
    end) =
struct
  module Client = Make_client (Http)

  let id = Provider.Xai

  let generate messages options =
    let request =
      {
        chat_model = options.Provider.model;
        chat_messages = List.map xai_message_of_provider_message messages;
        chat_stream = false;
        chat_temperature = options.temperature;
        chat_max_tokens = options.max_tokens;
        chat_top_p = None;
        chat_stop = [];
        chat_user = None;
        chat_seed = None;
        chat_logprobs = None;
        chat_top_logprobs = None;
        chat_n = None;
        chat_response_format = None;
        chat_tools = List.map (fun tool -> Function (openai_function_tool_of_provider_tool tool)) options.tools;
        chat_tool_choice = Option.map (fun name -> Tool name) options.tool_choice;
        chat_parallel_tool_calls = None;
        chat_extra =
          (match options.extra with
          | Some (Chatoyant_runtime.Json.Object fields) -> fields
          | _ -> []);
      }
    in
    let config =
      { Client.api_key = Config.api_key; base_url = Config.base_url; timeout_ms = Config.timeout_ms }
    in
    match Client.create_chat config request with
    | Ok response -> Ok (generation_of_chat_response response)
    | Error error -> Error (Provider.Runtime_error error.error_message)
end
