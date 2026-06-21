type role =
  | Developer
  | System
  | User
  | Assistant
  | Tool

type chat_message = {
  message_role : role;
  message_content : string option;
  message_name : string option;
  message_tool_call_id : string option;
  message_tool_calls : Provider.tool_call list;
}

type function_tool = {
  tool_name : string;
  tool_description : string option;
  tool_parameters : Chatoyant_runtime.Json.t;
  tool_strict : bool option;
}

type tool_choice =
  | Auto
  | None_
  | Required
  | Function_tool of string
  | Raw_tool_choice of Chatoyant_runtime.Json.t

type chat_response_format =
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
  chat_messages : chat_message list;
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
  chat_tools : function_tool list;
  chat_tool_choice : tool_choice option;
  chat_parallel_tool_calls : bool option;
  chat_response_format : chat_response_format option;
  chat_extra : (string * Chatoyant_runtime.Json.t) list;
}

type chat_response = {
  chat_response_id : string option;
  chat_response_model : string option;
  chat_response_content : string;
  chat_response_refusal : string option;
  chat_response_reasoning_content : string;
  chat_response_usage : Chatoyant_tokens.Cost.usage;
  chat_response_raw : Chatoyant_runtime.Json.t;
}

type responses_input =
  | Input_text of string
  | Input_items of Chatoyant_runtime.Json.t list

type responses_text_format =
  | Responses_text
  | Responses_json_object
  | Responses_json_schema of {
      response_schema_name : string;
      response_schema_description : string option;
      response_schema_value : Chatoyant_runtime.Json.t;
      response_schema_strict : bool;
    }

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
  responses_reasoning : Chatoyant_runtime.Json.t option;
  responses_tools : Chatoyant_runtime.Json.t list;
  responses_tool_choice : tool_choice option;
  responses_text_format : responses_text_format option;
  responses_parallel_tool_calls : bool option;
  responses_truncation : string option;
  responses_metadata : (string * string) list;
  responses_extra : (string * Chatoyant_runtime.Json.t) list;
}

type response_status =
  | Completed
  | In_progress
  | Incomplete
  | Failed_response
  | Cancelled
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

type api_error = {
  error_type : string option;
  error_message : string;
  error_code : string option;
  error_param : string option;
  error_raw : Chatoyant_runtime.Json.t option;
}

type image_response_format =
  | Url
  | Base64_json

type image_request = {
  image_model : string;
  image_prompt : string;
  image_background : string option;
  image_moderation : string option;
  image_n : int option;
  image_output_compression : int option;
  image_output_format : string option;
  image_quality : string option;
  image_response_format : image_response_format option;
  image_size : string option;
  image_style : string option;
  image_user : string option;
  image_extra : (string * Chatoyant_runtime.Json.t) list;
}

type upload_part = {
  upload_filename : string;
  upload_content_type : string option;
  upload_body : string;
}

type image_edit_request = {
  edit_model : string;
  edit_prompt : string;
  edit_images : upload_part list;
  edit_mask : upload_part option;
  edit_background : string option;
  edit_n : int option;
  edit_output_compression : int option;
  edit_output_format : string option;
  edit_quality : string option;
  edit_response_format : image_response_format option;
  edit_size : string option;
  edit_user : string option;
  edit_extra : (string * Chatoyant_runtime.Json.t) list;
}

type image_variation_request = {
  variation_model : string option;
  variation_image : upload_part;
  variation_n : int option;
  variation_response_format : image_response_format option;
  variation_size : string option;
  variation_user : string option;
  variation_extra : (string * Chatoyant_runtime.Json.t) list;
}

type image_data = {
  image_url : string option;
  image_b64_json : string option;
  image_revised_prompt : string option;
}

type image_response = {
  image_created : int option;
  image_data : image_data list;
  image_raw : Chatoyant_runtime.Json.t;
}

type embedding_encoding_format =
  | Float
  | Base64

type embedding_input =
  | Embedding_text of string
  | Embedding_texts of string list
  | Embedding_tokens of int list

type embedding_request = {
  embedding_model : string;
  embedding_input : embedding_input;
  embedding_encoding_format : embedding_encoding_format option;
  embedding_dimensions : int option;
  embedding_user : string option;
  embedding_extra : (string * Chatoyant_runtime.Json.t) list;
}

type embedding = {
  embedding_index : int option;
  embedding_vector : float list;
  embedding_raw : Chatoyant_runtime.Json.t;
}

type embedding_response = {
  embedding_model : string option;
  embedding_data : embedding list;
  embedding_usage : Chatoyant_tokens.Cost.usage;
  embedding_raw : Chatoyant_runtime.Json.t;
}

type model = {
  model_id : string option;
  model_object : string option;
  model_created : int option;
  model_owned_by : string option;
  model_raw : Chatoyant_runtime.Json.t;
}

type model_list = {
  models : model list;
  models_raw : Chatoyant_runtime.Json.t;
}

type file_upload = {
  file_filename : string;
  file_content_type : string option;
  file_body : string;
  file_purpose : string;
}

type file_object = {
  file_id : string option;
  file_object : string option;
  file_bytes : int option;
  file_created_at : int option;
  file_filename : string option;
  file_purpose : string option;
  file_status : string option;
  file_raw : Chatoyant_runtime.Json.t;
}

type file_list = {
  files : file_object list;
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

type moderation_input =
  | Moderation_text of string
  | Moderation_texts of string list

type moderation_request = {
  moderation_model : string option;
  moderation_input : moderation_input;
  moderation_extra : (string * Chatoyant_runtime.Json.t) list;
}

type moderation_result = {
  moderation_flagged : bool;
  moderation_categories : Chatoyant_runtime.Json.t option;
  moderation_category_scores : Chatoyant_runtime.Json.t option;
  moderation_raw : Chatoyant_runtime.Json.t;
}

type moderation_response = {
  moderation_id : string option;
  moderation_model : string option;
  moderation_results : moderation_result list;
  moderation_raw : Chatoyant_runtime.Json.t;
}

type batch_status =
  | Validating
  | Failed
  | In_progress
  | Finalizing
  | Completed
  | Expired
  | Canceling
  | Canceled
  | Unknown_batch_status of string

type batch_request_counts = {
  total : int;
  completed : int;
  failed : int;
}

type batch_create_request = {
  batch_input_file_id : string;
  batch_endpoint : string;
  batch_completion_window : string;
  batch_metadata : (string * string) list;
  batch_extra : (string * Chatoyant_runtime.Json.t) list;
}

type batch = {
  batch_id : string option;
  batch_object : string option;
  batch_endpoint : string option;
  batch_errors : Chatoyant_runtime.Json.t option;
  batch_input_file_id : string option;
  batch_completion_window : string option;
  batch_status : batch_status;
  batch_output_file_id : string option;
  batch_error_file_id : string option;
  batch_created_at : int option;
  batch_in_progress_at : int option;
  batch_expires_at : int option;
  batch_finalizing_at : int option;
  batch_completed_at : int option;
  batch_failed_at : int option;
  batch_expired_at : int option;
  batch_canceling_at : int option;
  batch_canceled_at : int option;
  batch_request_counts : batch_request_counts option;
  batch_raw : Chatoyant_runtime.Json.t;
}

type batch_list = {
  batches : batch list;
  first_id : string option;
  last_id : string option;
  has_more : bool;
  raw : Chatoyant_runtime.Json.t;
}

type audio_response_format =
  | Audio_json
  | Audio_text
  | Audio_srt
  | Audio_verbose_json
  | Audio_vtt
  | Audio_diarized_json
  | Audio_format of string

type transcription_request = {
  transcription_file : upload_part;
  transcription_model : string;
  transcription_language : string option;
  transcription_prompt : string option;
  transcription_response_format : audio_response_format option;
  transcription_temperature : float option;
  transcription_timestamp_granularities : string list;
  transcription_include : string list;
  transcription_stream : bool option;
  transcription_extra : (string * Chatoyant_runtime.Json.t) list;
}

type translation_request = {
  translation_file : upload_part;
  translation_model : string;
  translation_prompt : string option;
  translation_response_format : audio_response_format option;
  translation_temperature : float option;
  translation_extra : (string * Chatoyant_runtime.Json.t) list;
}

type transcription = {
  transcription_text : string;
  transcription_language : string option;
  transcription_duration : float option;
  transcription_segments : Chatoyant_runtime.Json.t option;
  transcription_words : Chatoyant_runtime.Json.t option;
  transcription_raw : Chatoyant_runtime.Json.t;
}

type speech_request = {
  speech_model : string;
  speech_input : string;
  speech_voice : string;
  speech_response_format : string option;
  speech_speed : float option;
  speech_instructions : string option;
  speech_extra : (string * Chatoyant_runtime.Json.t) list;
}

type vector_store_request = {
  vector_store_name : string option;
  vector_store_file_ids : string list;
  vector_store_expires_after : Chatoyant_runtime.Json.t option;
  vector_store_metadata : (string * string) list;
  vector_store_extra : (string * Chatoyant_runtime.Json.t) list;
}

type vector_store_update = {
  vector_store_update_name : string option;
  vector_store_update_expires_after : Chatoyant_runtime.Json.t option;
  vector_store_update_metadata : (string * string) list;
  vector_store_update_extra : (string * Chatoyant_runtime.Json.t) list;
}

type vector_store_status =
  | Vector_expired
  | Vector_in_progress
  | Vector_completed
  | Vector_unknown_status of string

type vector_store = {
  vector_store_id : string option;
  vector_store_name : string option;
  vector_store_status : vector_store_status;
  vector_store_file_counts : Chatoyant_runtime.Json.t option;
  vector_store_usage_bytes : int option;
  vector_store_created_at : int option;
  vector_store_raw : Chatoyant_runtime.Json.t;
}

type vector_store_list = {
  vector_stores : vector_store list;
  vector_store_first_id : string option;
  vector_store_last_id : string option;
  vector_store_has_more : bool;
  vector_store_raw : Chatoyant_runtime.Json.t;
}

type vector_store_delete = {
  deleted_vector_store_id : string option;
  deleted_vector_store : bool;
  deleted_vector_store_raw : Chatoyant_runtime.Json.t;
}

type vector_store_file_request = {
  vector_store_file_id : string;
  vector_store_file_attributes : Chatoyant_runtime.Json.t option;
  vector_store_file_extra : (string * Chatoyant_runtime.Json.t) list;
}

type vector_store_file = {
  vector_store_file_object_id : string option;
  vector_store_file_status : string option;
  vector_store_file_usage_bytes : int option;
  vector_store_file_created_at : int option;
  vector_store_file_raw : Chatoyant_runtime.Json.t;
}

type vector_store_file_list = {
  vector_store_files : vector_store_file list;
  vector_store_files_first_id : string option;
  vector_store_files_last_id : string option;
  vector_store_files_has_more : bool;
  vector_store_files_raw : Chatoyant_runtime.Json.t;
}

type vector_store_file_batch_request = {
  vector_store_file_batch_file_ids : string list;
  vector_store_file_batch_attributes : Chatoyant_runtime.Json.t option;
  vector_store_file_batch_chunking_strategy : Chatoyant_runtime.Json.t option;
  vector_store_file_batch_extra : (string * Chatoyant_runtime.Json.t) list;
}

type vector_store_file_batch = {
  vector_store_file_batch_id : string option;
  vector_store_file_batch_status : string option;
  vector_store_file_batch_file_counts : Chatoyant_runtime.Json.t option;
  vector_store_file_batch_created_at : int option;
  vector_store_file_batch_raw : Chatoyant_runtime.Json.t;
}

type vector_store_search_request = {
  vector_store_search_query : string;
  vector_store_search_max_num_results : int option;
  vector_store_search_rewrite_query : bool option;
  vector_store_search_filters : Chatoyant_runtime.Json.t option;
  vector_store_search_ranking_options : Chatoyant_runtime.Json.t option;
  vector_store_search_extra : (string * Chatoyant_runtime.Json.t) list;
}

type vector_store_search_result = {
  vector_store_search_file_id : string option;
  vector_store_search_filename : string option;
  vector_store_search_score : float option;
  vector_store_search_content : Chatoyant_runtime.Json.t option;
  vector_store_search_raw : Chatoyant_runtime.Json.t;
}

type vector_store_search_response = {
  vector_store_search_results : vector_store_search_result list;
  vector_store_search_raw : Chatoyant_runtime.Json.t;
}

type fine_tuning_job_request = {
  fine_tuning_model : string;
  fine_tuning_training_file : string;
  fine_tuning_validation_file : string option;
  fine_tuning_suffix : string option;
  fine_tuning_hyperparameters : Chatoyant_runtime.Json.t option;
  fine_tuning_integrations : Chatoyant_runtime.Json.t list;
  fine_tuning_seed : int option;
  fine_tuning_extra : (string * Chatoyant_runtime.Json.t) list;
}

type fine_tuning_job = {
  fine_tuning_id : string option;
  fine_tuning_model_name : string option;
  fine_tuning_status : string option;
  fine_tuning_fine_tuned_model : string option;
  fine_tuning_created_at : int option;
  fine_tuning_finished_at : int option;
  fine_tuning_raw : Chatoyant_runtime.Json.t;
}

type fine_tuning_job_list = {
  fine_tuning_jobs : fine_tuning_job list;
  fine_tuning_first_id : string option;
  fine_tuning_last_id : string option;
  fine_tuning_has_more : bool;
  fine_tuning_raw : Chatoyant_runtime.Json.t;
}

type fine_tuning_event = {
  fine_tuning_event_id : string option;
  fine_tuning_event_message : string option;
  fine_tuning_event_level : string option;
  fine_tuning_event_created_at : int option;
  fine_tuning_event_raw : Chatoyant_runtime.Json.t;
}

type fine_tuning_event_list = {
  fine_tuning_events : fine_tuning_event list;
  fine_tuning_events_raw : Chatoyant_runtime.Json.t;
}

type fine_tuning_checkpoint = {
  fine_tuning_checkpoint_id : string option;
  fine_tuning_checkpoint_model : string option;
  fine_tuning_checkpoint_step_number : int option;
  fine_tuning_checkpoint_metrics : Chatoyant_runtime.Json.t option;
  fine_tuning_checkpoint_created_at : int option;
  fine_tuning_checkpoint_job_id : string option;
  fine_tuning_checkpoint_raw : Chatoyant_runtime.Json.t;
}

type fine_tuning_checkpoint_list = {
  fine_tuning_checkpoints : fine_tuning_checkpoint list;
  fine_tuning_checkpoints_first_id : string option;
  fine_tuning_checkpoints_last_id : string option;
  fine_tuning_checkpoints_has_more : bool;
  fine_tuning_checkpoints_raw : Chatoyant_runtime.Json.t;
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

let openai_strict_schema schema =
  match Chatoyant_schema.Json_schema.of_json schema with
  | Error _ -> schema
  | Ok ast ->
      let projected = Chatoyant_schema.Json_schema.Project.openai_strict ast in
      Chatoyant_schema.Json_schema.to_json projected.schema

let strict_schema_if_needed strict schema =
  match strict with
  | Some true -> openai_strict_schema schema
  | _ -> schema

let role_to_string = function
  | Developer -> "developer"
  | System -> "system"
  | User -> "user"
  | Assistant -> "assistant"
  | Tool -> "tool"

let chat_message_json message =
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

let function_tool_json tool =
  let function_fields =
    [
      ("name", string tool.tool_name);
      ("parameters", strict_schema_if_needed tool.tool_strict tool.tool_parameters);
    ]
    |> add_opt "description" string tool.tool_description
    |> add_opt "strict" bool tool.tool_strict
    |> List.rev
  in
  Chatoyant_runtime.Json.Object
    [ ("type", string "function"); ("function", Chatoyant_runtime.Json.Object function_fields) ]

let tool_choice_json = function
  | Auto -> string "auto"
  | None_ -> string "none"
  | Required -> string "required"
  | Function_tool name ->
      Chatoyant_runtime.Json.Object
        [ ("type", string "function"); ("function", Chatoyant_runtime.Json.Object [ ("name", string name) ]) ]
  | Raw_tool_choice json -> json

let chat_response_format_json = function
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
    ("messages", Chatoyant_runtime.Json.Array (List.map chat_message_json request.chat_messages));
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
  |> add_non_empty "tools" function_tool_json request.chat_tools
  |> add_opt "tool_choice" tool_choice_json request.chat_tool_choice
  |> add_opt "parallel_tool_calls" bool request.chat_parallel_tool_calls
  |> add_opt "response_format" chat_response_format_json request.chat_response_format
  |> List.rev_append request.chat_extra
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let responses_input_json = function
  | Input_text text -> string text
  | Input_items items -> Chatoyant_runtime.Json.Array items

let responses_text_format_json = function
  | Responses_text -> Chatoyant_runtime.Json.Object [ ("type", string "text") ]
  | Responses_json_object -> Chatoyant_runtime.Json.Object [ ("type", string "json_object") ]
  | Responses_json_schema
      {
        response_schema_name;
        response_schema_description;
        response_schema_value;
        response_schema_strict;
      } ->
      [
        ("type", string "json_schema");
        ("name", string response_schema_name);
        ("schema", response_schema_value);
        ("strict", bool response_schema_strict);
      ]
      |> add_opt "description" string response_schema_description
      |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let responses_text_json format =
  Chatoyant_runtime.Json.Object [ ("format", responses_text_format_json format) ]

let metadata_json values =
  Chatoyant_runtime.Json.Object (List.map (fun (name, value) -> (name, string value)) values)

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
  |> add_opt "reasoning" (fun value -> value) request.responses_reasoning
  |> add_non_empty "tools" (fun value -> value) request.responses_tools
  |> add_opt "tool_choice" tool_choice_json request.responses_tool_choice
  |> add_opt "text" responses_text_json request.responses_text_format
  |> add_opt "parallel_tool_calls" bool request.responses_parallel_tool_calls
  |> add_opt "truncation" string request.responses_truncation
  |> add_non_empty "metadata" (fun (_, value) -> string value) request.responses_metadata
  |> List.rev_append request.responses_extra
  |> List.rev
  |> List.map (function
       | ("metadata", Chatoyant_runtime.Json.Array _) -> ("metadata", metadata_json request.responses_metadata)
       | field -> field)
  |> fun fields -> Chatoyant_runtime.Json.Object fields

let image_response_format_json = function
  | Url -> string "url"
  | Base64_json -> string "b64_json"

let image_request_json request =
  [
    ("model", string request.image_model);
    ("prompt", string request.image_prompt);
  ]
  |> add_opt "background" string request.image_background
  |> add_opt "moderation" string request.image_moderation
  |> add_opt "n" int request.image_n
  |> add_opt "output_compression" int request.image_output_compression
  |> add_opt "output_format" string request.image_output_format
  |> add_opt "quality" string request.image_quality
  |> add_opt "response_format" image_response_format_json request.image_response_format
  |> add_opt "size" string request.image_size
  |> add_opt "style" string request.image_style
  |> add_opt "user" string request.image_user
  |> List.rev_append request.image_extra
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let audio_response_format_to_string = function
  | Audio_json -> "json"
  | Audio_text -> "text"
  | Audio_srt -> "srt"
  | Audio_verbose_json -> "verbose_json"
  | Audio_vtt -> "vtt"
  | Audio_diarized_json -> "diarized_json"
  | Audio_format value -> value

let transcription_request_json request =
  [
    ("model", string request.transcription_model);
  ]
  |> add_opt "language" string request.transcription_language
  |> add_opt "prompt" string request.transcription_prompt
  |> add_opt
       "response_format"
       (fun value -> string (audio_response_format_to_string value))
       request.transcription_response_format
  |> add_opt "temperature" float request.transcription_temperature
  |> add_non_empty "timestamp_granularities" string request.transcription_timestamp_granularities
  |> add_non_empty "include" string request.transcription_include
  |> add_opt "stream" bool request.transcription_stream
  |> List.rev_append request.transcription_extra
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let translation_request_json request =
  [
    ("model", string request.translation_model);
  ]
  |> add_opt "prompt" string request.translation_prompt
  |> add_opt
       "response_format"
       (fun value -> string (audio_response_format_to_string value))
       request.translation_response_format
  |> add_opt "temperature" float request.translation_temperature
  |> List.rev_append request.translation_extra
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let speech_request_json request =
  [
    ("model", string request.speech_model);
    ("input", string request.speech_input);
    ("voice", string request.speech_voice);
  ]
  |> add_opt "response_format" string request.speech_response_format
  |> add_opt "speed" float request.speech_speed
  |> add_opt "instructions" string request.speech_instructions
  |> List.rev_append request.speech_extra
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let embedding_input_json = function
  | Embedding_text text -> string text
  | Embedding_texts texts -> Chatoyant_runtime.Json.Array (List.map string texts)
  | Embedding_tokens tokens -> Chatoyant_runtime.Json.Array (List.map int tokens)

let embedding_encoding_format_json = function
  | Float -> string "float"
  | Base64 -> string "base64"

let embedding_request_json request =
  [
    ("model", string request.embedding_model);
    ("input", embedding_input_json request.embedding_input);
  ]
  |> add_opt "encoding_format" embedding_encoding_format_json request.embedding_encoding_format
  |> add_opt "dimensions" int request.embedding_dimensions
  |> add_opt "user" string request.embedding_user
  |> List.rev_append request.embedding_extra
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let moderation_input_json = function
  | Moderation_text text -> string text
  | Moderation_texts texts -> Chatoyant_runtime.Json.Array (List.map string texts)

let moderation_request_json request =
  [
    ("input", moderation_input_json request.moderation_input);
  ]
  |> add_opt "model" string request.moderation_model
  |> List.rev_append request.moderation_extra
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let batch_metadata_json values =
  Chatoyant_runtime.Json.Object (List.map (fun (name, value) -> (name, string value)) values)

let batch_create_request_json request =
  [
    ("input_file_id", string request.batch_input_file_id);
    ("endpoint", string request.batch_endpoint);
    ("completion_window", string request.batch_completion_window);
  ]
  |> add_non_empty "metadata" (fun (_, value) -> string value) request.batch_metadata
  |> List.rev_append request.batch_extra
  |> List.rev
  |> List.map (function
       | ("metadata", Chatoyant_runtime.Json.Array _) ->
           ("metadata", batch_metadata_json request.batch_metadata)
       | field -> field)
  |> fun fields -> Chatoyant_runtime.Json.Object fields

let vector_metadata_json = metadata_json

let vector_store_request_json request =
  []
  |> add_opt "name" string request.vector_store_name
  |> add_non_empty "file_ids" string request.vector_store_file_ids
  |> add_opt "expires_after" (fun value -> value) request.vector_store_expires_after
  |> add_non_empty "metadata" (fun (_, value) -> string value) request.vector_store_metadata
  |> List.rev_append request.vector_store_extra
  |> List.rev
  |> List.map (function
       | ("metadata", Chatoyant_runtime.Json.Array _) ->
           ("metadata", vector_metadata_json request.vector_store_metadata)
       | field -> field)
  |> fun fields -> Chatoyant_runtime.Json.Object fields

let vector_store_update_json request =
  []
  |> add_opt "name" string request.vector_store_update_name
  |> add_opt "expires_after" (fun value -> value) request.vector_store_update_expires_after
  |> add_non_empty "metadata" (fun (_, value) -> string value) request.vector_store_update_metadata
  |> List.rev_append request.vector_store_update_extra
  |> List.rev
  |> List.map (function
       | ("metadata", Chatoyant_runtime.Json.Array _) ->
           ("metadata", vector_metadata_json request.vector_store_update_metadata)
       | field -> field)
  |> fun fields -> Chatoyant_runtime.Json.Object fields

let vector_store_file_request_json request =
  [
    ("file_id", string request.vector_store_file_id);
  ]
  |> add_opt "attributes" (fun value -> value) request.vector_store_file_attributes
  |> List.rev_append request.vector_store_file_extra
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let vector_store_file_batch_request_json request =
  [
    ( "file_ids",
      Chatoyant_runtime.Json.Array (List.map string request.vector_store_file_batch_file_ids) );
  ]
  |> add_opt "attributes" (fun value -> value) request.vector_store_file_batch_attributes
  |> add_opt "chunking_strategy" (fun value -> value) request.vector_store_file_batch_chunking_strategy
  |> List.rev_append request.vector_store_file_batch_extra
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let vector_store_search_request_json request =
  [
    ("query", string request.vector_store_search_query);
  ]
  |> add_opt "max_num_results" int request.vector_store_search_max_num_results
  |> add_opt "rewrite_query" bool request.vector_store_search_rewrite_query
  |> add_opt "filters" (fun value -> value) request.vector_store_search_filters
  |> add_opt "ranking_options" (fun value -> value) request.vector_store_search_ranking_options
  |> List.rev_append request.vector_store_search_extra
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let fine_tuning_job_request_json request =
  [
    ("model", string request.fine_tuning_model);
    ("training_file", string request.fine_tuning_training_file);
  ]
  |> add_opt "validation_file" string request.fine_tuning_validation_file
  |> add_opt "suffix" string request.fine_tuning_suffix
  |> add_opt "hyperparameters" (fun value -> value) request.fine_tuning_hyperparameters
  |> add_non_empty "integrations" (fun value -> value) request.fine_tuning_integrations
  |> add_opt "seed" int request.fine_tuning_seed
  |> List.rev_append request.fine_tuning_extra
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let authorization_headers ~api_key =
  [ ("Authorization", "Bearer " ^ api_key); ("Content-Type", "application/json") ]

let string_field name json = Option.bind (field name json) Chatoyant_runtime.Json.as_string
let bool_field name json = Option.bind (field name json) Chatoyant_runtime.Json.as_bool
let int_field name json = Option.bind (field name json) Chatoyant_runtime.Json.as_int

let api_error_of_json json =
  let error = Option.value (field "error" json) ~default:json in
  {
    error_type = string_field "type" error;
    error_message = Option.value (string_field "message" error) ~default:"OpenAI API error";
    error_code = string_field "code" error;
    error_param = string_field "param" error;
    error_raw = Some json;
  }

let chat_message_of_response json =
  match field "choices" json with
  | Some (Chatoyant_runtime.Json.Array (choice :: _)) -> field "message" choice
  | _ -> None

let chat_response_of_json json =
  let message = Option.value (chat_message_of_response json) ~default:Chatoyant_runtime.Json.Null in
  {
    chat_response_id = string_field "id" json;
    chat_response_model = string_field "model" json;
    chat_response_content =
      (match field "content" message with
      | Some value -> Option.value (Chatoyant_runtime.Json.as_string value) ~default:""
      | None -> "");
    chat_response_refusal = string_field "refusal" message;
    chat_response_reasoning_content = Option.value (string_field "reasoning_content" message) ~default:"";
    chat_response_usage =
      (match field "usage" json with
      | Some usage -> Usage.openai_compatible usage
      | None -> Chatoyant_tokens.Cost.empty_usage);
    chat_response_raw = json;
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
  match chat_message_of_response json with
  | None -> []
  | Some message -> (
      match field "tool_calls" message with
      | Some (Chatoyant_runtime.Json.Array values) ->
          List.filter_map provider_tool_call_of_json values
      | _ -> [])

let finish_reason_of_chat_json json =
  match field "choices" json with
  | Some (Chatoyant_runtime.Json.Array (choice :: _)) -> string_field "finish_reason" choice
  | _ -> None

let generation_of_chat_response response =
  {
    Provider.content = response.chat_response_content;
    reasoning_content = response.chat_response_reasoning_content;
    usage = response.chat_response_usage;
    usage_source = Chatoyant_tokens.Cost.Provider_reported;
    tool_calls = provider_tool_calls_of_chat_json response.chat_response_raw;
    finish_reason = finish_reason_of_chat_json response.chat_response_raw;
    raw = Some response.chat_response_raw;
  }

let response_status_of_string : string -> response_status = function
  | "completed" -> Completed
  | "in_progress" -> In_progress
  | "incomplete" -> Incomplete
  | "failed" -> Failed_response
  | "cancelled" -> Cancelled
  | value -> Unknown_response_status value

let content_text block =
  match field "type" block with
  | Some (Chatoyant_runtime.Json.String "output_text")
  | Some (Chatoyant_runtime.Json.String "text") ->
      Option.value (string_field "text" block) ~default:""
  | _ -> ""

let output_item_text item =
  match field "content" item with
  | Some (Chatoyant_runtime.Json.Array blocks) -> blocks |> List.map content_text |> String.concat ""
  | _ -> ""

let provider_tool_call_of_responses_item item =
  match string_field "type" item with
  | Some "function_call" ->
      let name = Option.value (string_field "name" item) ~default:"" in
      let arguments_json = Option.value (string_field "arguments" item) ~default:"" in
      let arguments =
        match Chatoyant_runtime.Json.parse arguments_json with
        | Ok json -> json
        | Error _ -> Chatoyant_runtime.Json.Null
      in
      Some
        {
          Provider.id = Option.value (string_field "call_id" item) ~default:"";
          name;
          arguments;
          arguments_json;
          raw = Some item;
        }
  | _ -> None

let summary_text summary = Option.value (string_field "text" summary) ~default:""

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
      {
        Chatoyant_tokens.Cost.empty_usage with
        input_tokens;
        output_tokens;
        reasoning_tokens;
        cached_tokens;
        total_tokens =
          Option.value (int_field "total_tokens" usage) ~default:(input_tokens + output_tokens);
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
    responses_output_text =
      (match string_field "output_text" json with
      | Some text -> text
      | None -> output_items |> List.map output_item_text |> String.concat "");
    responses_reasoning_text = output_items |> List.map reasoning_item_text |> String.concat "";
    responses_usage = responses_usage json;
    responses_raw = json;
  }

let generation_of_responses_response response =
  let output_items =
    match field "output" response.responses_raw with
    | Some (Chatoyant_runtime.Json.Array items) -> items
    | _ -> []
  in
  {
    Provider.content = response.responses_output_text;
    reasoning_content = response.responses_reasoning_text;
    usage = response.responses_usage;
    usage_source = Chatoyant_tokens.Cost.Provider_reported;
    tool_calls = List.filter_map provider_tool_call_of_responses_item output_items;
    finish_reason =
      (match response.responses_status with
      | Completed -> Some "completed"
      | In_progress -> Some "in_progress"
      | Incomplete -> Some "incomplete"
      | Failed_response -> Some "failed"
      | Cancelled -> Some "cancelled"
      | Unknown_response_status "" -> None
      | Unknown_response_status value -> Some value);
    raw = Some response.responses_raw;
  }

let response_of_stream_chunks chunks =
  let rec feed state text reasoning usage raw_events = function
    | [] ->
        let events = Chatoyant_runtime.Sse.finish state in
        decode (List.rev_append events []) text reasoning usage raw_events
    | chunk :: rest ->
        let state, events = Chatoyant_runtime.Sse.feed state chunk in
        let text, reasoning, usage, raw_events = decode events text reasoning usage raw_events in
        feed state text reasoning usage raw_events rest
  and decode events text reasoning usage raw_events =
    match events with
    | [] -> (text, reasoning, usage, raw_events)
    | event :: rest ->
        if Chatoyant_runtime.Sse.is_done event then decode rest text reasoning usage raw_events
        else
          match Chatoyant_runtime.Json.parse (Chatoyant_runtime.Sse.data_string event) with
          | Error _ -> decode rest text reasoning usage raw_events
          | Ok json ->
              let kind = string_field "type" json in
              let text =
                match kind with
                | Some "response.output_text.delta" ->
                    text ^ Option.value (string_field "delta" json) ~default:""
                | Some "response.completed" -> (
                    match field "response" json with
                    | Some response ->
                        let decoded = responses_response_of_json response in
                        if decoded.responses_output_text <> "" then decoded.responses_output_text else text
                    | None -> text)
                | _ -> text
              in
              let reasoning =
                match kind with
                | Some "response.reasoning_summary_text.delta" ->
                    reasoning ^ Option.value (string_field "delta" json) ~default:""
                | Some "response.completed" -> (
                    match field "response" json with
                    | Some response ->
                        let decoded = responses_response_of_json response in
                        if decoded.responses_reasoning_text <> "" then decoded.responses_reasoning_text else reasoning
                    | None -> reasoning)
                | _ -> reasoning
              in
              let usage =
                match kind with
                | Some "response.completed" -> (
                    match field "response" json with
                    | Some response -> (responses_response_of_json response).responses_usage
                    | None -> usage)
                | _ -> usage
              in
              decode rest text reasoning usage (json :: raw_events)
  in
  let text, reasoning, usage, raw_events =
    feed Chatoyant_runtime.Sse.empty "" "" Chatoyant_tokens.Cost.empty_usage [] chunks
  in
  Ok
    {
      responses_id = None;
      responses_model = None;
      responses_status = Completed;
      responses_output_text = text;
      responses_reasoning_text = reasoning;
      responses_usage = usage;
      responses_raw = Chatoyant_runtime.Json.Array (List.rev raw_events);
    }

let chat_response_of_stream_chunks chunks =
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
            chat_response_id = None;
            chat_response_model = None;
            chat_response_content = accumulated.Openai_stream.accumulated_content;
            chat_response_refusal = None;
            chat_response_reasoning_content = accumulated.accumulated_reasoning_content;
            chat_response_usage =
              (match accumulated.accumulated_usage with
              | Some usage -> Usage.openai_compatible usage
              | None -> Chatoyant_tokens.Cost.empty_usage);
            chat_response_raw = Chatoyant_runtime.Json.Null;
          }
    | event :: rest ->
        if Chatoyant_runtime.Sse.is_done event then decode rest accumulated
        else
          match Chatoyant_runtime.Json.parse (Chatoyant_runtime.Sse.data_string event) with
          | Error message -> Error message
          | Ok json -> decode rest (Openai_stream.apply_chunk_json accumulated json)
  in
  feed Chatoyant_runtime.Sse.empty [] chunks

let delete_response_of_json json =
  {
    deleted_id = string_field "id" json;
    deleted = Option.value (bool_field "deleted" json) ~default:false;
    deleted_raw = json;
  }

let image_data_of_json json =
  {
    image_url = string_field "url" json;
    image_b64_json = string_field "b64_json" json;
    image_revised_prompt = string_field "revised_prompt" json;
  }

let image_response_of_json json =
  {
    image_created = int_field "created" json;
    image_data =
      (match field "data" json with
      | Some (Chatoyant_runtime.Json.Array values) -> List.map image_data_of_json values
      | _ -> []);
    image_raw = json;
  }

let float_list_of_json json =
  match Chatoyant_runtime.Json.as_list json with
  | None -> []
  | Some values -> List.filter_map Chatoyant_runtime.Json.as_float values

let embedding_of_json json =
  {
    embedding_index = int_field "index" json;
    embedding_vector =
      (match field "embedding" json with
      | Some value -> float_list_of_json value
      | None -> []);
    embedding_raw = json;
  }

let embedding_response_of_json json =
  {
    embedding_model = string_field "model" json;
    embedding_data =
      (match field "data" json with
      | Some (Chatoyant_runtime.Json.Array values) -> List.map embedding_of_json values
      | _ -> []);
    embedding_usage =
      (match field "usage" json with
      | Some usage -> Usage.openai_compatible usage
      | None -> Chatoyant_tokens.Cost.empty_usage);
    embedding_raw = json;
  }

let model_of_json json =
  {
    model_id = string_field "id" json;
    model_object = string_field "object" json;
    model_created = int_field "created" json;
    model_owned_by = string_field "owned_by" json;
    model_raw = json;
  }

let model_list_of_json json =
  let values =
    match field "data" json with
    | Some (Chatoyant_runtime.Json.Array values) -> values
    | _ -> []
  in
  { models = List.map model_of_json values; models_raw = json }

let file_object_of_json json =
  {
    file_id = string_field "id" json;
    file_object = string_field "object" json;
    file_bytes = int_field "bytes" json;
    file_created_at = int_field "created_at" json;
    file_filename = string_field "filename" json;
    file_purpose = string_field "purpose" json;
    file_status = string_field "status" json;
    file_raw = json;
  }

let file_list_of_json json =
  {
    files =
      (match field "data" json with
      | Some (Chatoyant_runtime.Json.Array values) -> List.map file_object_of_json values
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

let moderation_result_of_json json =
  {
    moderation_flagged = Option.value (bool_field "flagged" json) ~default:false;
    moderation_categories = field "categories" json;
    moderation_category_scores = field "category_scores" json;
    moderation_raw = json;
  }

let moderation_response_of_json json =
  {
    moderation_id = string_field "id" json;
    moderation_model = string_field "model" json;
    moderation_results =
      (match field "results" json with
      | Some (Chatoyant_runtime.Json.Array values) -> List.map moderation_result_of_json values
      | _ -> []);
    moderation_raw = json;
  }

let batch_status_of_string : string -> batch_status = function
  | "validating" -> Validating
  | "failed" -> Failed
  | "in_progress" -> In_progress
  | "finalizing" -> Finalizing
  | "completed" -> Completed
  | "expired" -> Expired
  | "canceling" -> Canceling
  | "cancelled" | "canceled" -> Canceled
  | value -> Unknown_batch_status value

let batch_request_counts_of_json json =
  {
    total = Option.value (int_field "total" json) ~default:0;
    completed = Option.value (int_field "completed" json) ~default:0;
    failed = Option.value (int_field "failed" json) ~default:0;
  }

let batch_of_json json =
  {
    batch_id = string_field "id" json;
    batch_object = string_field "object" json;
    batch_endpoint = string_field "endpoint" json;
    batch_errors = field "errors" json;
    batch_input_file_id = string_field "input_file_id" json;
    batch_completion_window = string_field "completion_window" json;
    batch_status =
      json |> string_field "status" |> Option.map batch_status_of_string
      |> Option.value ~default:(Unknown_batch_status "");
    batch_output_file_id = string_field "output_file_id" json;
    batch_error_file_id = string_field "error_file_id" json;
    batch_created_at = int_field "created_at" json;
    batch_in_progress_at = int_field "in_progress_at" json;
    batch_expires_at = int_field "expires_at" json;
    batch_finalizing_at = int_field "finalizing_at" json;
    batch_completed_at = int_field "completed_at" json;
    batch_failed_at = int_field "failed_at" json;
    batch_expired_at = int_field "expired_at" json;
    batch_canceling_at = int_field "cancelling_at" json;
    batch_canceled_at = int_field "cancelled_at" json;
    batch_request_counts = Option.map batch_request_counts_of_json (field "request_counts" json);
    batch_raw = json;
  }

let batch_list_of_json json =
  {
    batches =
      (match field "data" json with
      | Some (Chatoyant_runtime.Json.Array values) -> List.map batch_of_json values
      | _ -> []);
    first_id = string_field "first_id" json;
    last_id = string_field "last_id" json;
    has_more = Option.value (bool_field "has_more" json) ~default:false;
    raw = json;
  }

let transcription_of_json json =
  {
    transcription_text = Option.value (string_field "text" json) ~default:"";
    transcription_language = string_field "language" json;
    transcription_duration = Option.bind (field "duration" json) Chatoyant_runtime.Json.as_float;
    transcription_segments = field "segments" json;
    transcription_words = field "words" json;
    transcription_raw = json;
  }

let vector_store_status_of_string = function
  | "expired" -> Vector_expired
  | "in_progress" -> Vector_in_progress
  | "completed" -> Vector_completed
  | value -> Vector_unknown_status value

let vector_store_of_json json =
  {
    vector_store_id = string_field "id" json;
    vector_store_name = string_field "name" json;
    vector_store_status =
      json |> string_field "status" |> Option.map vector_store_status_of_string
      |> Option.value ~default:(Vector_unknown_status "");
    vector_store_file_counts = field "file_counts" json;
    vector_store_usage_bytes = int_field "usage_bytes" json;
    vector_store_created_at = int_field "created_at" json;
    vector_store_raw = json;
  }

let vector_store_list_of_json json =
  {
    vector_stores =
      (match field "data" json with
      | Some (Chatoyant_runtime.Json.Array values) -> List.map vector_store_of_json values
      | _ -> []);
    vector_store_first_id = string_field "first_id" json;
    vector_store_last_id = string_field "last_id" json;
    vector_store_has_more = Option.value (bool_field "has_more" json) ~default:false;
    vector_store_raw = json;
  }

let vector_store_delete_of_json json =
  {
    deleted_vector_store_id = string_field "id" json;
    deleted_vector_store = Option.value (bool_field "deleted" json) ~default:false;
    deleted_vector_store_raw = json;
  }

let vector_store_file_of_json json =
  {
    vector_store_file_object_id = string_field "id" json;
    vector_store_file_status = string_field "status" json;
    vector_store_file_usage_bytes = int_field "usage_bytes" json;
    vector_store_file_created_at = int_field "created_at" json;
    vector_store_file_raw = json;
  }

let vector_store_file_list_of_json json =
  {
    vector_store_files =
      (match field "data" json with
      | Some (Chatoyant_runtime.Json.Array values) -> List.map vector_store_file_of_json values
      | _ -> []);
    vector_store_files_first_id = string_field "first_id" json;
    vector_store_files_last_id = string_field "last_id" json;
    vector_store_files_has_more = Option.value (bool_field "has_more" json) ~default:false;
    vector_store_files_raw = json;
  }

let vector_store_file_batch_of_json json =
  {
    vector_store_file_batch_id = string_field "id" json;
    vector_store_file_batch_status = string_field "status" json;
    vector_store_file_batch_file_counts = field "file_counts" json;
    vector_store_file_batch_created_at = int_field "created_at" json;
    vector_store_file_batch_raw = json;
  }

let vector_store_search_result_of_json json =
  {
    vector_store_search_file_id = string_field "file_id" json;
    vector_store_search_filename = string_field "filename" json;
    vector_store_search_score = Option.bind (field "score" json) Chatoyant_runtime.Json.as_float;
    vector_store_search_content = field "content" json;
    vector_store_search_raw = json;
  }

let vector_store_search_response_of_json json =
  {
    vector_store_search_results =
      (match field "data" json with
      | Some (Chatoyant_runtime.Json.Array values) -> List.map vector_store_search_result_of_json values
      | _ -> []);
    vector_store_search_raw = json;
  }

let fine_tuning_job_of_json json =
  {
    fine_tuning_id = string_field "id" json;
    fine_tuning_model_name = string_field "model" json;
    fine_tuning_status = string_field "status" json;
    fine_tuning_fine_tuned_model = string_field "fine_tuned_model" json;
    fine_tuning_created_at = int_field "created_at" json;
    fine_tuning_finished_at = int_field "finished_at" json;
    fine_tuning_raw = json;
  }

let fine_tuning_job_list_of_json json =
  {
    fine_tuning_jobs =
      (match field "data" json with
      | Some (Chatoyant_runtime.Json.Array values) -> List.map fine_tuning_job_of_json values
      | _ -> []);
    fine_tuning_first_id = string_field "first_id" json;
    fine_tuning_last_id = string_field "last_id" json;
    fine_tuning_has_more = Option.value (bool_field "has_more" json) ~default:false;
    fine_tuning_raw = json;
  }

let fine_tuning_event_of_json json =
  {
    fine_tuning_event_id = string_field "id" json;
    fine_tuning_event_message = string_field "message" json;
    fine_tuning_event_level = string_field "level" json;
    fine_tuning_event_created_at = int_field "created_at" json;
    fine_tuning_event_raw = json;
  }

let fine_tuning_event_list_of_json json =
  {
    fine_tuning_events =
      (match field "data" json with
      | Some (Chatoyant_runtime.Json.Array values) -> List.map fine_tuning_event_of_json values
      | _ -> []);
    fine_tuning_events_raw = json;
  }

let fine_tuning_checkpoint_of_json json =
  {
    fine_tuning_checkpoint_id = string_field "id" json;
    fine_tuning_checkpoint_model =
      (match string_field "fine_tuned_model_checkpoint" json with
      | Some _ as value -> value
      | None -> string_field "model" json);
    fine_tuning_checkpoint_step_number = int_field "step_number" json;
    fine_tuning_checkpoint_metrics = field "metrics" json;
    fine_tuning_checkpoint_created_at = int_field "created_at" json;
    fine_tuning_checkpoint_job_id = string_field "fine_tuning_job_id" json;
    fine_tuning_checkpoint_raw = json;
  }

let fine_tuning_checkpoint_list_of_json json =
  {
    fine_tuning_checkpoints =
      (match field "data" json with
      | Some (Chatoyant_runtime.Json.Array values) -> List.map fine_tuning_checkpoint_of_json values
      | _ -> []);
    fine_tuning_checkpoints_first_id = string_field "first_id" json;
    fine_tuning_checkpoints_last_id = string_field "last_id" json;
    fine_tuning_checkpoints_has_more = Option.value (bool_field "has_more" json) ~default:false;
    fine_tuning_checkpoints_raw = json;
  }

module Make_client (Http : Chatoyant_runtime.Effect.HTTP) = struct
  type config = {
    api_key : string;
    base_url : string;
    timeout_ms : int option;
  }

  let default_base_url = "https://api.openai.com/v1"

  let endpoint config path =
    let base =
      if String.ends_with ~suffix:"/" config.base_url then
        String.sub config.base_url 0 (String.length config.base_url - 1)
      else config.base_url
    in
    base ^ path

  let request ?(method_ = "POST") config path body =
    let headers =
      match body with
      | Http.Multipart _ ->
          authorization_headers ~api_key:config.api_key
          |> List.filter (fun (name, _) -> String.lowercase_ascii name <> "content-type")
      | _ -> authorization_headers ~api_key:config.api_key
    in
    {
      Http.method_;
      url = endpoint config path;
      headers;
      body;
      timeout_ms = config.timeout_ms;
    }

  let parse_response decode response =
    if response.Http.status < 200 || response.status >= 300 then
      match Chatoyant_runtime.Json.parse response.body with
      | Ok json -> Error (api_error_of_json json)
      | Error _ ->
          Error
            {
              error_type = Some "http_error";
              error_message = "OpenAI HTTP " ^ string_of_int response.status ^ ": " ^ response.body;
              error_code = None;
              error_param = None;
              error_raw = None;
            }
    else
      match Chatoyant_runtime.Json.parse response.body with
      | Error message ->
          Error
            {
              error_type = Some "decode_error";
              error_message = message;
              error_code = None;
              error_param = None;
              error_raw = None;
            }
      | Ok json -> Ok (decode json)

  let map_http_error = function
    | Http.Timeout ms ->
        {
          error_type = Some "timeout_error";
          error_message = "Request timed out after " ^ string_of_int ms ^ "ms";
          error_code = None;
          error_param = None;
          error_raw = None;
        }
    | Network message ->
        { error_type = Some "network_error"; error_message = message; error_code = None; error_param = None; error_raw = None }
    | Invalid_response message ->
        { error_type = Some "invalid_response"; error_message = message; error_code = None; error_param = None; error_raw = None }

  let send decode request =
    match Http.send request with
    | Error error -> Error (map_http_error error)
    | Ok response -> parse_response decode response

  let create_response config request_body =
    send responses_response_of_json (request config "/responses" (Json (responses_request_json request_body)))

  let retrieve_response config ~response_id =
    send responses_response_of_json (request ~method_:"GET" config ("/responses/" ^ response_id) Empty)

  let delete_response config ~response_id =
    send delete_response_of_json (request ~method_:"DELETE" config ("/responses/" ^ response_id) Empty)

  let cancel_response config ~response_id =
    send responses_response_of_json (request config ("/responses/" ^ response_id ^ "/cancel") Empty)

  let compact_response config request_body =
    send responses_response_of_json
      (request config "/responses/compact" (Json (responses_request_json request_body)))

  let create_chat config request_body =
    send chat_response_of_json (request config "/chat/completions" (Json (chat_request_json request_body)))

  let generate_image config request_body =
    send image_response_of_json (request config "/images/generations" (Json (image_request_json request_body)))

  let multipart_part name ?filename ?content_type body =
    { Http.name; filename; content_type; body }

  let multipart_scalar_parts fields =
    let scalar name value =
      multipart_part name
        (match value with
        | Chatoyant_runtime.Json.String text -> text
        | Chatoyant_runtime.Json.Bool true -> "true"
        | Chatoyant_runtime.Json.Bool false -> "false"
        | Chatoyant_runtime.Json.Float value ->
            if Float.is_integer value then Printf.sprintf "%.0f" value else string_of_float value
        | Chatoyant_runtime.Json.Null -> "null"
        | Chatoyant_runtime.Json.Array _ | Chatoyant_runtime.Json.Object _ ->
            Chatoyant_runtime.Json.to_string value)
    in
    let rec loop acc = function
      | [] -> List.rev acc
      | (name, Chatoyant_runtime.Json.Array values) :: rest ->
          let parts = List.map (fun value -> scalar (name ^ "[]") value) values in
          loop (List.rev_append parts acc) rest
      | (name, value) :: rest -> loop (scalar name value :: acc) rest
    in
    loop [] fields

  let multipart_parts_of_json json =
    match Chatoyant_runtime.Json.as_object json with
    | Some fields -> multipart_scalar_parts fields
    | None -> []

  let upload_part_field name part =
    multipart_part name ~filename:part.upload_filename ?content_type:part.upload_content_type
      part.upload_body

  let image_edit_parts request_body =
    let scalar =
      [
        ("model", string request_body.edit_model);
        ("prompt", string request_body.edit_prompt);
      ]
      |> add_opt "background" string request_body.edit_background
      |> add_opt "n" int request_body.edit_n
      |> add_opt "output_compression" int request_body.edit_output_compression
      |> add_opt "output_format" string request_body.edit_output_format
      |> add_opt "quality" string request_body.edit_quality
      |> add_opt "response_format" image_response_format_json request_body.edit_response_format
      |> add_opt "size" string request_body.edit_size
      |> add_opt "user" string request_body.edit_user
      |> List.rev_append request_body.edit_extra
      |> List.rev |> fun fields -> multipart_scalar_parts fields
    in
    let images = List.map (upload_part_field "image") request_body.edit_images in
    let mask =
      match request_body.edit_mask with
      | None -> []
      | Some part -> [ upload_part_field "mask" part ]
    in
    scalar @ images @ mask

  let image_variation_parts request_body =
    let scalar =
      []
      |> add_opt "model" string request_body.variation_model
      |> add_opt "n" int request_body.variation_n
      |> add_opt "response_format" image_response_format_json request_body.variation_response_format
      |> add_opt "size" string request_body.variation_size
      |> add_opt "user" string request_body.variation_user
      |> List.rev_append request_body.variation_extra
      |> List.rev |> fun fields -> multipart_scalar_parts fields
    in
    scalar @ [ upload_part_field "image" request_body.variation_image ]

  let edit_image config request_body =
    send image_response_of_json (request config "/images/edits" (Multipart (image_edit_parts request_body)))

  let create_image_variation config request_body =
    send image_response_of_json
      (request config "/images/variations" (Multipart (image_variation_parts request_body)))

  let create_embedding config request_body =
    send embedding_response_of_json (request config "/embeddings" (Json (embedding_request_json request_body)))

  let parse_raw_or_json decode fallback response =
    if response.Http.status < 200 || response.status >= 300 then
      match Chatoyant_runtime.Json.parse response.body with
      | Ok json -> Error (api_error_of_json json)
      | Error _ ->
          Error
            {
              error_type = Some "http_error";
              error_message = "OpenAI HTTP " ^ string_of_int response.status ^ ": " ^ response.body;
              error_code = None;
              error_param = None;
              error_raw = None;
            }
    else
      match Chatoyant_runtime.Json.parse response.body with
      | Ok json -> Ok (decode json)
      | Error _ -> Ok (fallback response.body)

  let send_raw_or_json decode fallback request =
    match Http.send request with
    | Error error -> Error (map_http_error error)
    | Ok response -> parse_raw_or_json decode fallback response

  let transcription_parts request_body =
    multipart_parts_of_json (transcription_request_json request_body)
    @ [ upload_part_field "file" request_body.transcription_file ]

  let translation_parts request_body =
    multipart_parts_of_json (translation_request_json request_body)
    @ [ upload_part_field "file" request_body.translation_file ]

  let text_transcription text =
    {
      transcription_text = text;
      transcription_language = None;
      transcription_duration = None;
      transcription_segments = None;
      transcription_words = None;
      transcription_raw = Chatoyant_runtime.Json.String text;
    }

  let create_transcription config request_body =
    send_raw_or_json transcription_of_json text_transcription
      (request config "/audio/transcriptions" (Multipart (transcription_parts request_body)))

  let create_translation config request_body =
    send_raw_or_json transcription_of_json text_transcription
      (request config "/audio/translations" (Multipart (translation_parts request_body)))

  let create_speech config request_body =
    let request = request config "/audio/speech" (Json (speech_request_json request_body)) in
    match Http.send request with
    | Error error -> Error (map_http_error error)
    | Ok response when response.status < 200 || response.status >= 300 ->
        (match Chatoyant_runtime.Json.parse response.body with
        | Ok json -> Error (api_error_of_json json)
        | Error _ ->
            Error
              {
                error_type = Some "http_error";
                error_message = "OpenAI HTTP " ^ string_of_int response.status ^ ": " ^ response.body;
                error_code = None;
                error_param = None;
                error_raw = None;
              })
    | Ok response -> Ok response.body

  let file_upload_parts (upload : file_upload) =
    [
      {
        Http.name = "purpose";
        filename = None;
        content_type = None;
        body = upload.file_purpose;
      };
      {
        Http.name = "file";
        filename = Some upload.file_filename;
        content_type = upload.file_content_type;
        body = upload.file_body;
      };
    ]

  let upload_file config upload =
    send file_object_of_json
      (request config "/files" (Multipart (file_upload_parts upload)))

  let list_files config =
    send file_list_of_json (request ~method_:"GET" config "/files" Empty)

  let retrieve_file config ~file_id =
    send file_object_of_json (request ~method_:"GET" config ("/files/" ^ file_id) Empty)

  let delete_file config ~file_id =
    send file_delete_of_json (request ~method_:"DELETE" config ("/files/" ^ file_id) Empty)

  let download_file config ~file_id =
    let request = request ~method_:"GET" config ("/files/" ^ file_id ^ "/content") Empty in
    match Http.send request with
    | Error error -> Error (map_http_error error)
    | Ok response when response.status < 200 || response.status >= 300 ->
        (match Chatoyant_runtime.Json.parse response.body with
        | Ok json -> Error (api_error_of_json json)
        | Error _ ->
            Error
              {
                error_type = Some "http_error";
                error_message = "OpenAI HTTP " ^ string_of_int response.status ^ ": " ^ response.body;
                error_code = None;
                error_param = None;
                error_raw = None;
              })
    | Ok response -> Ok response.body

  let create_moderation config request_body =
    send moderation_response_of_json
      (request config "/moderations" (Json (moderation_request_json request_body)))

  let create_batch config request_body =
    send batch_of_json (request config "/batches" (Json (batch_create_request_json request_body)))

  let retrieve_batch config ~batch_id =
    send batch_of_json (request ~method_:"GET" config ("/batches/" ^ batch_id) Empty)

  let cancel_batch config ~batch_id =
    send batch_of_json (request config ("/batches/" ^ batch_id ^ "/cancel") Empty)

  let list_batches config =
    send batch_list_of_json (request ~method_:"GET" config "/batches" Empty)

  let create_vector_store config request_body =
    send vector_store_of_json
      (request config "/vector_stores" (Json (vector_store_request_json request_body)))

  let list_vector_stores config =
    send vector_store_list_of_json (request ~method_:"GET" config "/vector_stores" Empty)

  let retrieve_vector_store config ~vector_store_id =
    send vector_store_of_json (request ~method_:"GET" config ("/vector_stores/" ^ vector_store_id) Empty)

  let update_vector_store config ~vector_store_id request_body =
    send vector_store_of_json
      (request ~method_:"POST" config
         ("/vector_stores/" ^ vector_store_id)
         (Json (vector_store_update_json request_body)))

  let delete_vector_store config ~vector_store_id =
    send vector_store_delete_of_json
      (request ~method_:"DELETE" config ("/vector_stores/" ^ vector_store_id) Empty)

  let search_vector_store config ~vector_store_id request_body =
    send vector_store_search_response_of_json
      (request config
         ("/vector_stores/" ^ vector_store_id ^ "/search")
         (Json (vector_store_search_request_json request_body)))

  let create_vector_store_file config ~vector_store_id request_body =
    send vector_store_file_of_json
      (request config
         ("/vector_stores/" ^ vector_store_id ^ "/files")
         (Json (vector_store_file_request_json request_body)))

  let list_vector_store_files config ~vector_store_id =
    send vector_store_file_list_of_json
      (request ~method_:"GET" config ("/vector_stores/" ^ vector_store_id ^ "/files") Empty)

  let retrieve_vector_store_file config ~vector_store_id ~file_id =
    send vector_store_file_of_json
      (request ~method_:"GET" config
         ("/vector_stores/" ^ vector_store_id ^ "/files/" ^ file_id)
         Empty)

  let delete_vector_store_file config ~vector_store_id ~file_id =
    send vector_store_delete_of_json
      (request ~method_:"DELETE" config
         ("/vector_stores/" ^ vector_store_id ^ "/files/" ^ file_id)
         Empty)

  let create_vector_store_file_batch config ~vector_store_id request_body =
    send vector_store_file_batch_of_json
      (request config
         ("/vector_stores/" ^ vector_store_id ^ "/file_batches")
         (Json (vector_store_file_batch_request_json request_body)))

  let retrieve_vector_store_file_batch config ~vector_store_id ~batch_id =
    send vector_store_file_batch_of_json
      (request ~method_:"GET" config
         ("/vector_stores/" ^ vector_store_id ^ "/file_batches/" ^ batch_id)
         Empty)

  let cancel_vector_store_file_batch config ~vector_store_id ~batch_id =
    send vector_store_file_batch_of_json
      (request config
         ("/vector_stores/" ^ vector_store_id ^ "/file_batches/" ^ batch_id ^ "/cancel")
         Empty)

  let list_vector_store_file_batch_files config ~vector_store_id ~batch_id =
    send vector_store_file_list_of_json
      (request ~method_:"GET" config
         ("/vector_stores/" ^ vector_store_id ^ "/file_batches/" ^ batch_id ^ "/files")
         Empty)

  let create_fine_tuning_job config request_body =
    send fine_tuning_job_of_json
      (request config "/fine_tuning/jobs" (Json (fine_tuning_job_request_json request_body)))

  let list_fine_tuning_jobs config =
    send fine_tuning_job_list_of_json (request ~method_:"GET" config "/fine_tuning/jobs" Empty)

  let retrieve_fine_tuning_job config ~job_id =
    send fine_tuning_job_of_json (request ~method_:"GET" config ("/fine_tuning/jobs/" ^ job_id) Empty)

  let cancel_fine_tuning_job config ~job_id =
    send fine_tuning_job_of_json (request config ("/fine_tuning/jobs/" ^ job_id ^ "/cancel") Empty)

  let list_fine_tuning_events config ~job_id =
    send fine_tuning_event_list_of_json
      (request ~method_:"GET" config ("/fine_tuning/jobs/" ^ job_id ^ "/events") Empty)

  let list_fine_tuning_checkpoints config ~job_id =
    send fine_tuning_checkpoint_list_of_json
      (request ~method_:"GET" config ("/fine_tuning/jobs/" ^ job_id ^ "/checkpoints") Empty)

  let list_models config =
    send model_list_of_json (request ~method_:"GET" config "/models" Empty)

  let retrieve_model config ~model_id =
    send model_of_json (request ~method_:"GET" config ("/models/" ^ model_id) Empty)
end

let openai_message_of_provider_message (message : Provider.message) =
  let role =
    match message.role with
    | Provider.System -> System
    | Provider.User -> User
    | Provider.Assistant -> Assistant
    | Provider.Tool -> Tool
  in
  {
    message_role = role;
    message_content = message.content;
    message_name = message.name;
    message_tool_call_id = message.tool_call_id;
    message_tool_calls = message.tool_calls;
  }

let responses_tool_of_provider_tool (tool : Provider.tool_definition) =
  [
    ("type", string "function");
    ("name", string tool.tool_name);
    ("parameters", strict_schema_if_needed tool.tool_strict tool.tool_parameters);
  ]
  |> add_opt "description" string tool.tool_description
  |> add_opt "strict" bool tool.tool_strict
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let responses_input_items_of_provider_message (message : Provider.message) =
  let message_item role content =
    Chatoyant_runtime.Json.Object [ ("role", string role); ("content", content) ]
  in
  let function_call_item (call : Provider.tool_call) =
    Chatoyant_runtime.Json.Object
      [
        ("type", string "function_call");
        ("call_id", string call.id);
        ("name", string call.name);
        ("arguments", string call.arguments_json);
      ]
  in
  match message.role with
  | Provider.Tool ->
      [
        Chatoyant_runtime.Json.Object
          [
            ("type", string "function_call_output");
            ("call_id", string (Option.value message.tool_call_id ~default:""));
            ("output", string (Option.value message.content ~default:""));
          ];
      ]
  | Provider.Assistant when message.tool_calls <> [] ->
      let text_items =
        match message.content with
        | Some "" | None -> []
        | Some text -> [ message_item "assistant" (string text) ]
      in
      text_items @ List.map function_call_item message.tool_calls
  | _ ->
      let role =
        match (openai_message_of_provider_message message).message_role with
        | Developer -> "developer"
        | System -> "system"
        | User -> "user"
        | Assistant -> "assistant"
        | Tool -> "tool"
      in
      [ message_item role (match message.content with Some text -> string text | None -> Chatoyant_runtime.Json.Null) ]

module Make_provider
    (Http : Chatoyant_runtime.Effect.HTTP)
    (Config : sig
      val api_key : string
      val base_url : string
      val timeout_ms : int option
    end) =
struct
  module Client = Make_client (Http)

  let id = Provider.Openai

  let generate messages (options : Provider.options) =
    let request =
      {
        responses_model = options.model;
        responses_input =
          Input_items
            (List.concat_map responses_input_items_of_provider_message messages);
        responses_instructions = None;
        responses_previous_response_id = None;
        responses_store = Some false;
        responses_stream = false;
        responses_temperature = options.temperature;
        responses_top_p = None;
        responses_max_output_tokens = options.max_tokens;
        responses_reasoning = None;
        responses_tools = List.map responses_tool_of_provider_tool options.tools;
        responses_tool_choice = Option.map (fun name -> Function_tool name) options.tool_choice;
        responses_text_format = None;
        responses_parallel_tool_calls = None;
        responses_truncation = None;
        responses_metadata = [];
        responses_extra =
          (match options.extra with
          | Some (Chatoyant_runtime.Json.Object fields) -> fields
          | _ -> []);
      }
    in
    let config =
      { Client.api_key = Config.api_key; base_url = Config.base_url; timeout_ms = Config.timeout_ms }
    in
    match Client.create_response config request with
    | Ok response -> Ok (generation_of_responses_response response)
    | Error error -> Error (Provider.Runtime_error error.error_message)
end
