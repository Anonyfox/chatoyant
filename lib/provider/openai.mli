(** Standalone OpenAI API mirror.

    The Responses API is the primary modern text surface. Chat Completions is
    retained as a compatibility surface for existing Chatoyant behavior and
    OpenAI-compatible providers. Transport is supplied through runtime effect
    functors so the same typed provider works from native OCaml, Melange/Node,
    browsers, and tests. *)

type role = Developer | System | User | Assistant | Tool

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
(** Chat Completions request body. [chat_extra] preserves forward compatibility
    for new request fields. *)

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
(** Primary Responses API request body. Tools are raw JSON because OpenAI has
    first-party hosted tools as well as function tools. *)

type api_object = {
  api_object_id : string option;
  api_object_type : string option;
  api_object_raw : Chatoyant_runtime.Json.t;
}
(** Generic typed envelope for fast-moving OpenAI resources such as Evals,
    Containers, and Administration objects. Common identity fields are decoded;
    provider-specific fields stay losslessly available in [api_object_raw]. *)

type api_list = {
  api_list_data : api_object list;
  api_list_first_id : string option;
  api_list_last_id : string option;
  api_list_has_more : bool;
  api_list_total_count : int option;
  api_list_raw : Chatoyant_runtime.Json.t;
}

type api_delete = {
  api_delete_id : string option;
  api_delete_deleted : bool;
  api_delete_raw : Chatoyant_runtime.Json.t;
}

type response_input_token_count = {
  response_input_tokens : int;
  response_input_token_count_raw : Chatoyant_runtime.Json.t;
}
(** Result from [/responses/input_tokens]. *)

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

type realtime_config = {
  realtime_api_key : string;
  realtime_model : string;
  realtime_base_url : string;
  realtime_timeout_ms : int option;
  realtime_headers : (string * string) list;
  realtime_safety_identifier : string option;
}
(** Server-to-server Realtime WebSocket config. [realtime_base_url] defaults to
    [wss://api.openai.com/v1/realtime]; the model is encoded as a query
    parameter. *)

type realtime_client_secret_request = {
  realtime_client_secret_session : Chatoyant_runtime.Json.t;
  realtime_client_secret_extra : (string * Chatoyant_runtime.Json.t) list;
}
(** Realtime ephemeral-token request body for [/realtime/client_secrets]. *)

type realtime_client_secret = {
  realtime_client_secret_value : string option;
  realtime_client_secret_expires_at : int option;
  realtime_client_secret_raw : Chatoyant_runtime.Json.t;
}
(** Ephemeral Realtime client secret returned by OpenAI. *)

type realtime_call_request = {
  realtime_call_sdp : string;
  realtime_call_session : Chatoyant_runtime.Json.t;
  realtime_call_extra : (string * string) list;
}
(** WebRTC unified-interface request for [/realtime/calls]. The response is an
    SDP answer string. *)

type responses_stream_event =
  | Response_created of responses_response
  | Response_in_progress of responses_response
  | Response_completed of responses_response
  | Response_failed of responses_response
  | Response_incomplete of responses_response
  | Response_output_text_delta of {
      item_id : string option;
      output_index : int option;
      content_index : int option;
      delta : string;
    }
  | Response_output_text_done of {
      item_id : string option;
      output_index : int option;
      content_index : int option;
      text : string;
    }
  | Response_reasoning_summary_text_delta of {
      item_id : string option;
      output_index : int option;
      summary_index : int option;
      delta : string;
    }
  | Response_function_call_arguments_delta of {
      item_id : string option;
      output_index : int option;
      delta : string;
    }
  | Response_function_call_arguments_done of {
      item_id : string option;
      output_index : int option;
      arguments : string;
    }
  | Response_refusal_delta of string
  | Response_error of api_error
  | Response_raw_event of {
      event_type : string option;
      raw : Chatoyant_runtime.Json.t;
    }
      (** Closed coverage for the stable Responses SSE events that carry data
          the SDK can safely normalize, plus [Response_raw_event] for newly
          shipped event names. *)

type transcription_stream_event =
  | Transcription_text_delta of {
      transcript_delta : string;
      transcript_logprobs : Chatoyant_runtime.Json.t option;
      transcript_raw : Chatoyant_runtime.Json.t;
    }
  | Transcription_text_done of {
      transcript_text : string;
      transcript_logprobs : Chatoyant_runtime.Json.t option;
      transcript_raw : Chatoyant_runtime.Json.t;
    }
  | Transcription_text_segment of {
      transcript_segment_id : string option;
      transcript_segment_start : float option;
      transcript_segment_end : float option;
      transcript_segment_text : string option;
      transcript_segment_speaker : string option;
      transcript_raw : Chatoyant_runtime.Json.t;
    }
  | Transcription_error of api_error
  | Transcription_raw_event of {
      transcription_event_type : string option;
      transcription_raw : Chatoyant_runtime.Json.t;
    }
      (** Streaming transcript events emitted by [/audio/transcriptions] when
          [stream=true], with raw fallback for newly added event variants. *)

type image_response_format = Url | Base64_json

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
(** In-memory upload part used by multipart endpoints. Native runtimes can map
    this to files or byte buffers at their HTTP effect boundary. *)

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
(** Multipart image edit request for [/images/edits]. [edit_extra] only accepts
    scalar JSON values when converted to multipart form fields. *)

type image_variation_request = {
  variation_model : string option;
  variation_image : upload_part;
  variation_n : int option;
  variation_response_format : image_response_format option;
  variation_size : string option;
  variation_user : string option;
  variation_extra : (string * Chatoyant_runtime.Json.t) list;
}
(** Multipart image variation request for models that expose
    [/images/variations]. *)

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

type embedding_encoding_format = Float | Base64

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

type model_list = { models : model list; models_raw : Chatoyant_runtime.Json.t }

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

type batch_request_counts = { total : int; completed : int; failed : int }

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

val role_to_string : role -> string
val function_tool_json : function_tool -> Chatoyant_runtime.Json.t
val chat_request_json : chat_request -> Chatoyant_runtime.Json.t
val responses_request_json : responses_request -> Chatoyant_runtime.Json.t
val image_request_json : image_request -> Chatoyant_runtime.Json.t

val transcription_request_json :
  transcription_request -> Chatoyant_runtime.Json.t

val translation_request_json : translation_request -> Chatoyant_runtime.Json.t
val speech_request_json : speech_request -> Chatoyant_runtime.Json.t
val embedding_request_json : embedding_request -> Chatoyant_runtime.Json.t
val moderation_request_json : moderation_request -> Chatoyant_runtime.Json.t
val batch_create_request_json : batch_create_request -> Chatoyant_runtime.Json.t
val vector_store_request_json : vector_store_request -> Chatoyant_runtime.Json.t
val vector_store_update_json : vector_store_update -> Chatoyant_runtime.Json.t

val vector_store_file_request_json :
  vector_store_file_request -> Chatoyant_runtime.Json.t

val vector_store_file_batch_request_json :
  vector_store_file_batch_request -> Chatoyant_runtime.Json.t

val vector_store_search_request_json :
  vector_store_search_request -> Chatoyant_runtime.Json.t

val fine_tuning_job_request_json :
  fine_tuning_job_request -> Chatoyant_runtime.Json.t

val realtime_client_secret_request_json :
  realtime_client_secret_request -> Chatoyant_runtime.Json.t

val authorization_headers : api_key:string -> (string * string) list
val realtime_url : ?base_url:string -> model:string -> unit -> string
val chat_response_of_json : Chatoyant_runtime.Json.t -> chat_response
val generation_of_chat_response : chat_response -> Provider.generation
val responses_response_of_json : Chatoyant_runtime.Json.t -> responses_response
val generation_of_responses_response : responses_response -> Provider.generation

val responses_stream_event_of_json :
  Chatoyant_runtime.Json.t -> responses_stream_event

val responses_stream_events_of_chunks :
  string list -> (responses_stream_event list, string) result

val response_of_stream_chunks :
  string list -> (responses_response, string) result

val chat_response_of_stream_chunks :
  string list -> (chat_response, string) result

val api_object_of_json : Chatoyant_runtime.Json.t -> api_object
val api_list_of_json : Chatoyant_runtime.Json.t -> api_list
val api_delete_of_json : Chatoyant_runtime.Json.t -> api_delete

val response_input_token_count_of_json :
  Chatoyant_runtime.Json.t -> response_input_token_count

val transcription_stream_event_of_json :
  Chatoyant_runtime.Json.t -> transcription_stream_event

val transcription_stream_events_of_chunks :
  string list -> (transcription_stream_event list, string) result

val delete_response_of_json : Chatoyant_runtime.Json.t -> delete_response
val api_error_of_json : Chatoyant_runtime.Json.t -> api_error
val image_response_of_json : Chatoyant_runtime.Json.t -> image_response
val embedding_response_of_json : Chatoyant_runtime.Json.t -> embedding_response
val model_list_of_json : Chatoyant_runtime.Json.t -> model_list
val model_of_json : Chatoyant_runtime.Json.t -> model
val file_object_of_json : Chatoyant_runtime.Json.t -> file_object
val file_list_of_json : Chatoyant_runtime.Json.t -> file_list
val file_delete_of_json : Chatoyant_runtime.Json.t -> file_delete

val moderation_response_of_json :
  Chatoyant_runtime.Json.t -> moderation_response

val batch_of_json : Chatoyant_runtime.Json.t -> batch
val batch_list_of_json : Chatoyant_runtime.Json.t -> batch_list

val realtime_client_secret_of_json :
  Chatoyant_runtime.Json.t -> realtime_client_secret

val transcription_of_json : Chatoyant_runtime.Json.t -> transcription
val vector_store_of_json : Chatoyant_runtime.Json.t -> vector_store
val vector_store_list_of_json : Chatoyant_runtime.Json.t -> vector_store_list

val vector_store_delete_of_json :
  Chatoyant_runtime.Json.t -> vector_store_delete

val vector_store_file_of_json : Chatoyant_runtime.Json.t -> vector_store_file

val vector_store_file_list_of_json :
  Chatoyant_runtime.Json.t -> vector_store_file_list

val vector_store_file_batch_of_json :
  Chatoyant_runtime.Json.t -> vector_store_file_batch

val vector_store_search_response_of_json :
  Chatoyant_runtime.Json.t -> vector_store_search_response

val fine_tuning_job_of_json : Chatoyant_runtime.Json.t -> fine_tuning_job

val fine_tuning_job_list_of_json :
  Chatoyant_runtime.Json.t -> fine_tuning_job_list

val fine_tuning_event_list_of_json :
  Chatoyant_runtime.Json.t -> fine_tuning_event_list

val fine_tuning_checkpoint_list_of_json :
  Chatoyant_runtime.Json.t -> fine_tuning_checkpoint_list

module Make_client (Http : Chatoyant_runtime.Effect.HTTP) : sig
  type config = { api_key : string; base_url : string; timeout_ms : int option }

  type admin_config = {
    admin_api_key : string;
    admin_base_url : string;
    admin_timeout_ms : int option;
  }
  (** Separate config for Administration endpoints. OpenAI admin API keys are
      intentionally not interchangeable with normal inference keys. *)

  val default_base_url : string

  val create_response :
    config -> responses_request -> (responses_response, api_error) result

  val retrieve_response :
    config -> response_id:string -> (responses_response, api_error) result

  val delete_response :
    config -> response_id:string -> (delete_response, api_error) result

  val list_response_input_items :
    config -> response_id:string -> (api_list, api_error) result

  val count_response_input_tokens :
    config ->
    responses_request ->
    (response_input_token_count, api_error) result

  val cancel_response :
    config -> response_id:string -> (responses_response, api_error) result

  val compact_response :
    config -> responses_request -> (responses_response, api_error) result

  val create_realtime_client_secret :
    ?safety_identifier:string ->
    config ->
    realtime_client_secret_request ->
    (realtime_client_secret, api_error) result

  val create_realtime_call :
    config -> realtime_call_request -> (string, api_error) result

  val create_conversation :
    config -> Chatoyant_runtime.Json.t -> (api_object, api_error) result

  val retrieve_conversation :
    config -> conversation_id:string -> (api_object, api_error) result

  val update_conversation :
    config ->
    conversation_id:string ->
    Chatoyant_runtime.Json.t ->
    (api_object, api_error) result

  val delete_conversation :
    config -> conversation_id:string -> (api_delete, api_error) result

  val create_conversation_items :
    config ->
    conversation_id:string ->
    Chatoyant_runtime.Json.t ->
    (api_list, api_error) result

  val retrieve_conversation_item :
    config ->
    conversation_id:string ->
    item_id:string ->
    (api_object, api_error) result

  val delete_conversation_item :
    config ->
    conversation_id:string ->
    item_id:string ->
    (api_object, api_error) result

  val list_conversation_items :
    config -> conversation_id:string -> (api_list, api_error) result

  val create_chat : config -> chat_request -> (chat_response, api_error) result

  val generate_image :
    config -> image_request -> (image_response, api_error) result

  val edit_image :
    config -> image_edit_request -> (image_response, api_error) result

  val create_image_variation :
    config -> image_variation_request -> (image_response, api_error) result

  val create_embedding :
    config -> embedding_request -> (embedding_response, api_error) result

  val create_transcription :
    config -> transcription_request -> (transcription, api_error) result

  val create_translation :
    config -> translation_request -> (transcription, api_error) result

  val create_speech : config -> speech_request -> (string, api_error) result
  val upload_file : config -> file_upload -> (file_object, api_error) result
  val list_files : config -> (file_list, api_error) result

  val retrieve_file :
    config -> file_id:string -> (file_object, api_error) result

  val delete_file : config -> file_id:string -> (file_delete, api_error) result
  val download_file : config -> file_id:string -> (string, api_error) result

  val create_moderation :
    config -> moderation_request -> (moderation_response, api_error) result

  val create_batch : config -> batch_create_request -> (batch, api_error) result
  val retrieve_batch : config -> batch_id:string -> (batch, api_error) result
  val cancel_batch : config -> batch_id:string -> (batch, api_error) result
  val list_batches : config -> (batch_list, api_error) result

  val create_vector_store :
    config -> vector_store_request -> (vector_store, api_error) result

  val list_vector_stores : config -> (vector_store_list, api_error) result

  val retrieve_vector_store :
    config -> vector_store_id:string -> (vector_store, api_error) result

  val update_vector_store :
    config ->
    vector_store_id:string ->
    vector_store_update ->
    (vector_store, api_error) result

  val delete_vector_store :
    config -> vector_store_id:string -> (vector_store_delete, api_error) result

  val search_vector_store :
    config ->
    vector_store_id:string ->
    vector_store_search_request ->
    (vector_store_search_response, api_error) result

  val create_vector_store_file :
    config ->
    vector_store_id:string ->
    vector_store_file_request ->
    (vector_store_file, api_error) result

  val list_vector_store_files :
    config ->
    vector_store_id:string ->
    (vector_store_file_list, api_error) result

  val retrieve_vector_store_file :
    config ->
    vector_store_id:string ->
    file_id:string ->
    (vector_store_file, api_error) result

  val delete_vector_store_file :
    config ->
    vector_store_id:string ->
    file_id:string ->
    (vector_store_delete, api_error) result

  val create_vector_store_file_batch :
    config ->
    vector_store_id:string ->
    vector_store_file_batch_request ->
    (vector_store_file_batch, api_error) result

  val retrieve_vector_store_file_batch :
    config ->
    vector_store_id:string ->
    batch_id:string ->
    (vector_store_file_batch, api_error) result

  val cancel_vector_store_file_batch :
    config ->
    vector_store_id:string ->
    batch_id:string ->
    (vector_store_file_batch, api_error) result

  val list_vector_store_file_batch_files :
    config ->
    vector_store_id:string ->
    batch_id:string ->
    (vector_store_file_list, api_error) result

  val create_fine_tuning_job :
    config -> fine_tuning_job_request -> (fine_tuning_job, api_error) result

  val list_fine_tuning_jobs : config -> (fine_tuning_job_list, api_error) result

  val retrieve_fine_tuning_job :
    config -> job_id:string -> (fine_tuning_job, api_error) result

  val cancel_fine_tuning_job :
    config -> job_id:string -> (fine_tuning_job, api_error) result

  val list_fine_tuning_events :
    config -> job_id:string -> (fine_tuning_event_list, api_error) result

  val list_fine_tuning_checkpoints :
    config -> job_id:string -> (fine_tuning_checkpoint_list, api_error) result

  val list_models : config -> (model_list, api_error) result
  val retrieve_model : config -> model_id:string -> (model, api_error) result

  val create_eval :
    config -> Chatoyant_runtime.Json.t -> (api_object, api_error) result

  val retrieve_eval : config -> eval_id:string -> (api_object, api_error) result

  val update_eval :
    config ->
    eval_id:string ->
    Chatoyant_runtime.Json.t ->
    (api_object, api_error) result

  val list_evals : config -> (api_list, api_error) result
  val delete_eval : config -> eval_id:string -> (api_delete, api_error) result

  val create_eval_run :
    config ->
    eval_id:string ->
    Chatoyant_runtime.Json.t ->
    (api_object, api_error) result

  val retrieve_eval_run :
    config -> eval_id:string -> run_id:string -> (api_object, api_error) result

  val list_eval_runs : config -> eval_id:string -> (api_list, api_error) result

  val cancel_eval_run :
    config -> eval_id:string -> run_id:string -> (api_object, api_error) result

  val delete_eval_run :
    config -> eval_id:string -> run_id:string -> (api_delete, api_error) result

  val list_eval_run_output_items :
    config -> eval_id:string -> run_id:string -> (api_list, api_error) result

  val create_container :
    config -> Chatoyant_runtime.Json.t -> (api_object, api_error) result

  val retrieve_container :
    config -> container_id:string -> (api_object, api_error) result

  val list_containers : config -> (api_list, api_error) result

  val delete_container :
    config -> container_id:string -> (api_delete, api_error) result

  val create_container_file :
    config ->
    container_id:string ->
    Chatoyant_runtime.Json.t ->
    (api_object, api_error) result

  val list_container_files :
    config -> container_id:string -> (api_list, api_error) result

  val retrieve_container_file :
    config ->
    container_id:string ->
    file_id:string ->
    (api_object, api_error) result

  val delete_container_file :
    config ->
    container_id:string ->
    file_id:string ->
    (api_delete, api_error) result

  val download_container_file :
    config ->
    container_id:string ->
    file_id:string ->
    (string, api_error) result

  val admin_get : admin_config -> path:string -> (api_object, api_error) result
  val admin_list : admin_config -> path:string -> (api_list, api_error) result

  val admin_post :
    admin_config ->
    path:string ->
    Chatoyant_runtime.Json.t ->
    (api_object, api_error) result

  val admin_patch :
    admin_config ->
    path:string ->
    Chatoyant_runtime.Json.t ->
    (api_object, api_error) result

  val admin_delete :
    admin_config -> path:string -> (api_delete, api_error) result

  val list_admin_api_keys : admin_config -> (api_list, api_error) result

  val create_admin_api_key :
    admin_config -> Chatoyant_runtime.Json.t -> (api_object, api_error) result

  val retrieve_admin_api_key :
    admin_config -> key_id:string -> (api_object, api_error) result

  val delete_admin_api_key :
    admin_config -> key_id:string -> (api_delete, api_error) result
end

(** OpenAI Realtime WebSocket helper. Events stay provider JSON because the
    Realtime API evolves quickly; callers can still use typed JSON-schema codecs
    on top. *)
module Make_realtime (Ws : Chatoyant_runtime.Effect.WEBSOCKET) : sig
  type connection = Ws.connection

  val default_base_url : string
  val connect : realtime_config -> (connection -> 'a) -> ('a, api_error) result

  val send_json :
    connection -> Chatoyant_runtime.Json.t -> (unit, api_error) result

  val receive_json : connection -> (Chatoyant_runtime.Json.t, api_error) result

  val close :
    ?code:int -> ?reason:string -> connection -> (unit, api_error) result
end

module Make_provider
    (Http : Chatoyant_runtime.Effect.HTTP)
    (Config : sig
      val api_key : string
      val base_url : string
      val timeout_ms : int option
    end) : Provider.CHAT
