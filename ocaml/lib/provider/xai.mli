(** Standalone xAI API mirror.

    xAI shares OpenAI-compatible wire formats for some endpoints, but this
    module owns xAI semantics directly: model capability quirks, web search,
    cost ticks, Imagine image/video endpoints, and xAI-specific errors. *)

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

type service_tier =
  | Auto_tier
  | Default_tier
  | Priority_tier
  | Service_tier of string

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
(** Chat Completions request body for xAI's [/v1/chat/completions]
    endpoint. Optional fields intentionally stay explicit instead of being
    inherited from OpenAI, because xAI evolves capabilities and unsupported
    parameters on its own schedule. [chat_extra] is the forward-compatible
    escape hatch for freshly shipped provider fields. *)

type chat_response = {
  response_id : string option;
  response_model : string option;
  response_content : string;
  response_reasoning_content : string;
  response_usage : Chatoyant_tokens.Cost.usage;
  response_raw : Chatoyant_runtime.Json.t;
}
(** Decoded chat response. [response_raw] preserves the complete provider JSON
    so parity tests can inspect unknown fields without weakening the typed
    normalized surface. *)

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
(** Preferred xAI Responses API request body for [/v1/responses]. *)

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
(** Decoded Responses API object, including message output text and reasoning
    summary text when xAI returns it. *)

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

type form_part = {
  form_name : string;
  form_filename : string option;
  form_content_type : string option;
  form_body : string;
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

type tts_output_format = {
  output_codec : string option;
  output_sample_rate : int option;
  output_bit_rate : int option;
}

type tts_request = {
  tts_text : string;
  tts_voice_id : string option;
  tts_language : string;
  tts_output_format : tts_output_format option;
  tts_speed : float option;
  tts_optimize_streaming_latency : int option;
  tts_text_normalization : bool option;
  tts_with_timestamps : bool option;
  tts_extra : (string * Chatoyant_runtime.Json.t) list;
}
(** REST text-to-speech request for [/v1/tts]. The normal response body is raw
    audio bytes; when [tts_with_timestamps] is true, xAI returns a JSON envelope
    as the body. *)

type audio_body = {
  audio_body : string;
  audio_content_type : string option;
}

type stt_request = {
  stt_file : upload_part option;
  stt_url : string option;
  stt_audio_format : string option;
  stt_sample_rate : int option;
  stt_language : string option;
  stt_format : bool option;
  stt_multichannel : bool option;
  stt_channels : int option;
  stt_diarize : bool option;
  stt_keyterms : string list;
  stt_filler_words : bool option;
  stt_extra : (string * string) list;
}
(** REST speech-to-text request for [/v1/stt]. Either [stt_file] or [stt_url]
    must be supplied. When [stt_file] is present it is encoded last, matching
    xAI's multipart requirement. *)

type stt_word = {
  word_text : string option;
  word_start : float option;
  word_end : float option;
  word_speaker : int option;
  word_raw : Chatoyant_runtime.Json.t;
}

type stt_channel = {
  channel_index : int option;
  channel_text : string option;
  channel_words : stt_word list;
  channel_raw : Chatoyant_runtime.Json.t;
}

type stt_response = {
  stt_text : string option;
  stt_language : string option;
  stt_duration : float option;
  stt_words : stt_word list;
  stt_channels : stt_channel list;
  stt_raw : Chatoyant_runtime.Json.t;
}

type voice = {
  voice_id : string option;
  voice_name : string option;
  voice_description : string option;
  voice_gender : string option;
  voice_accent : string option;
  voice_age : string option;
  voice_language : string option;
  voice_use_case : string option;
  voice_tone : string option;
  voice_created_at : string option;
  voice_raw : Chatoyant_runtime.Json.t;
}

type voice_list = {
  voices : voice list;
  voices_pagination_token : string option;
  voices_raw : Chatoyant_runtime.Json.t;
}

type custom_voice_request = {
  custom_voice_file : upload_part;
  custom_voice_name : string option;
  custom_voice_description : string option;
  custom_voice_gender : string option;
  custom_voice_accent : string option;
  custom_voice_age : string option;
  custom_voice_language : string option;
  custom_voice_use_case : string option;
  custom_voice_tone : string option;
  custom_voice_extra : (string * string) list;
}

type custom_voice_update = {
  custom_voice_update_name : string option;
  custom_voice_update_description : string option;
  custom_voice_update_gender : string option;
  custom_voice_update_accent : string option;
  custom_voice_update_age : string option;
  custom_voice_update_language : string option;
  custom_voice_update_use_case : string option;
  custom_voice_update_tone : string option;
  custom_voice_update_extra : (string * Chatoyant_runtime.Json.t) list;
}

type voice_delete = {
  deleted_voice_id : string option;
  voice_deleted : bool;
  voice_delete_raw : Chatoyant_runtime.Json.t;
}

type realtime_client_secret_request = {
  realtime_client_secret_expires_after_seconds : int option;
  realtime_client_secret_extra : (string * Chatoyant_runtime.Json.t) list;
}
(** Ephemeral token request for browser/mobile WebSocket clients. *)

type realtime_client_secret = {
  realtime_client_secret_value : string option;
  realtime_client_secret_expires_at : int option;
  realtime_client_secret_raw : Chatoyant_runtime.Json.t;
}
(** Ephemeral Realtime client secret returned by xAI. *)

type websocket_config = {
  websocket_api_key : string;
  websocket_url : string;
  websocket_timeout_ms : int option;
  websocket_headers : (string * string) list;
  websocket_protocols : string list;
}
(** xAI WebSocket config for voice-agent realtime and streaming TTS. *)

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
(** xAI Responses SSE events. The provider currently follows OpenAI's event
    names for [/v1/responses], while this type remains owned by the xAI module
    so downstream explicit-provider code never depends on OpenAI internals. *)

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
(** Image generation request for Grok Imagine image models. *)

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
(** Image edit request. The source list is encoded as the singular xAI [image]
    field, either as one object or an array of reference images. *)

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
(** Async Imagine video generation/edit request. Poll the returned request id
    with {!Make_client.get_video_status}. *)

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

val role_to_string : role -> string
val service_tier_to_string : service_tier -> string
val service_tier_extra : service_tier -> string * Chatoyant_runtime.Json.t
val background_extra : bool -> string * Chatoyant_runtime.Json.t
val tts_request_json : tts_request -> Chatoyant_runtime.Json.t
val stt_request_parts : stt_request -> form_part list
val custom_voice_request_parts : custom_voice_request -> form_part list
val custom_voice_update_json : custom_voice_update -> Chatoyant_runtime.Json.t
val realtime_client_secret_request_json :
  realtime_client_secret_request -> Chatoyant_runtime.Json.t
val chat_request_json : chat_request -> Chatoyant_runtime.Json.t
val responses_request_json : responses_request -> Chatoyant_runtime.Json.t
val batch_create_request_json : batch_create_request -> Chatoyant_runtime.Json.t
val batch_requests_add_json : batch_requests_add -> Chatoyant_runtime.Json.t
val collection_request_json : collection_request -> Chatoyant_runtime.Json.t
val collection_update_json : collection_update -> Chatoyant_runtime.Json.t
val collection_search_request_json : collection_search_request -> Chatoyant_runtime.Json.t
val image_request_json : image_request -> Chatoyant_runtime.Json.t
val image_edit_request_json : image_edit_request -> Chatoyant_runtime.Json.t
val video_request_json : video_request -> Chatoyant_runtime.Json.t
val authorization_headers : api_key:string -> (string * string) list
(** Bearer auth headers for xAI REST calls. *)

val voice_agent_url : ?base_url:string -> model:string -> unit -> string
val streaming_tts_url :
  ?base_url:string ->
  ?language:string ->
  ?voice:string ->
  ?codec:string ->
  ?sample_rate:int ->
  ?bit_rate:int ->
  ?speed:float ->
  ?optimize_streaming_latency:int ->
  ?text_normalization:bool ->
  ?with_timestamps:bool ->
  unit ->
  string
val streaming_stt_url :
  ?base_url:string ->
  ?sample_rate:int ->
  ?encoding:string ->
  ?interim_results:bool ->
  ?endpointing:int ->
  ?language:string ->
  ?diarize:bool ->
  ?filler_words:bool ->
  ?multichannel:bool ->
  ?channels:int ->
  ?keyterms:string list ->
  ?smart_turn:float ->
  ?smart_turn_timeout:int ->
  unit ->
  string
val responses_websocket_url : ?base_url:string -> unit -> string
val chat_response_of_json : Chatoyant_runtime.Json.t -> chat_response
val generation_of_chat_response : chat_response -> Provider.generation
val responses_response_of_json : Chatoyant_runtime.Json.t -> responses_response
val generation_of_responses_response : responses_response -> Provider.generation
val stt_response_of_json : Chatoyant_runtime.Json.t -> stt_response
val voice_of_json : Chatoyant_runtime.Json.t -> voice
val voice_list_of_json : Chatoyant_runtime.Json.t -> voice_list
val voice_delete_of_json : Chatoyant_runtime.Json.t -> voice_delete
val realtime_client_secret_of_json : Chatoyant_runtime.Json.t -> realtime_client_secret
val responses_stream_event_of_json : Chatoyant_runtime.Json.t -> responses_stream_event
val responses_stream_events_of_chunks : string list -> (responses_stream_event list, string) result
val response_of_stream_chunks : string list -> (responses_response, string) result
val delete_response_of_json : Chatoyant_runtime.Json.t -> delete_response
val model_list_of_json : Chatoyant_runtime.Json.t -> model_list
val file_object_of_json : Chatoyant_runtime.Json.t -> file_object
val file_list_of_json : Chatoyant_runtime.Json.t -> file_list
val file_delete_of_json : Chatoyant_runtime.Json.t -> file_delete
val batch_of_json : Chatoyant_runtime.Json.t -> batch
val batch_list_of_json : Chatoyant_runtime.Json.t -> batch_list
val batch_request_metadata_list_of_json :
  Chatoyant_runtime.Json.t -> batch_request_metadata_list
val api_error_of_json : Chatoyant_runtime.Json.t -> api_error
val stream_response_of_chunks : string list -> (chat_response, string) result
(** Decode OpenAI-compatible SSE chunks while preserving xAI reasoning deltas
    and cost-tick usage when present. *)
val image_response_of_json : Chatoyant_runtime.Json.t -> image_response
val video_start_response_of_json : Chatoyant_runtime.Json.t -> video_start_response
val video_status_response_of_json : Chatoyant_runtime.Json.t -> video_status_response
val collection_of_json : Chatoyant_runtime.Json.t -> collection
val collection_list_of_json : Chatoyant_runtime.Json.t -> collection_list
val collection_document_of_json : Chatoyant_runtime.Json.t -> collection_document
val collection_document_list_of_json :
  Chatoyant_runtime.Json.t -> collection_document_list
val collection_delete_of_json : Chatoyant_runtime.Json.t -> collection_delete
val collection_search_response_of_json :
  Chatoyant_runtime.Json.t -> collection_search_response

module Make_client (Http : Chatoyant_runtime.Effect.HTTP) : sig
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

  val default_base_url : string
  val default_management_base_url : string
  val create_chat : config -> chat_request -> (chat_response, api_error) result
  val retrieve_deferred_chat :
    config -> request_id:string -> (chat_response, api_error) result
  val create_response : config -> responses_request -> (responses_response, api_error) result
  val compact_response : config -> responses_request -> (responses_response, api_error) result
  val retrieve_deferred_response :
    config -> request_id:string -> (responses_response, api_error) result
  val retrieve_response : config -> response_id:string -> (responses_response, api_error) result
  val delete_response : config -> response_id:string -> (delete_response, api_error) result
  val synthesize_speech : config -> tts_request -> (audio_body, api_error) result
  val list_tts_voices : config -> (voice_list, api_error) result
  val transcribe_speech : config -> stt_request -> (stt_response, api_error) result
  val create_realtime_client_secret :
    config -> realtime_client_secret_request -> (realtime_client_secret, api_error) result
  val create_custom_voice : config -> custom_voice_request -> (voice, api_error) result
  val list_custom_voices :
    ?limit:int -> ?pagination_token:string -> config -> (voice_list, api_error) result
  val retrieve_custom_voice : config -> voice_id:string -> (voice, api_error) result
  val update_custom_voice :
    config -> voice_id:string -> custom_voice_update -> (voice, api_error) result
  val download_custom_voice_audio : config -> voice_id:string -> (audio_body, api_error) result
  val delete_custom_voice : config -> voice_id:string -> (voice_delete, api_error) result
  val list_models : config -> (model_list, api_error) result
  val upload_file : config -> file_upload -> (file_object, api_error) result
  val list_files :
    ?limit:int ->
    ?order:string ->
    ?sort_by:string ->
    ?pagination_token:string ->
    config ->
    (file_list, api_error) result
  val retrieve_file : config -> file_id:string -> (file_object, api_error) result
  val delete_file : config -> file_id:string -> (file_delete, api_error) result
  val download_file : config -> file_id:string -> (string, api_error) result
  val create_batch : config -> batch_create_request -> (batch, api_error) result
  val list_batches : config -> (batch_list, api_error) result
  val retrieve_batch : config -> batch_id:string -> (batch, api_error) result
  val list_batch_requests :
    config -> batch_id:string -> (batch_request_metadata_list, api_error) result
  val add_batch_requests :
    config -> batch_id:string -> batch_requests_add -> (batch_request_metadata_list, api_error) result
  val batch_results : config -> batch_id:string -> (batch, api_error) result
  val cancel_batch : config -> batch_id:string -> (batch, api_error) result
  val generate_image : config -> image_request -> (image_response, api_error) result
  val edit_image : config -> image_edit_request -> (image_response, api_error) result
  val start_video : config -> video_request -> (video_start_response, api_error) result
  val get_video_status : config -> request_id:string -> (video_status_response, api_error) result
  val download_video : config -> request_id:string -> (string, api_error) result
  val create_collection :
    management_config -> collection_request -> (collection, api_error) result
  val list_collections :
    ?limit:int ->
    ?order:string ->
    ?sort_by:string ->
    ?pagination_token:string ->
    ?filter:string ->
    management_config ->
    (collection_list, api_error) result
  val retrieve_collection :
    management_config -> collection_id:string -> (collection, api_error) result
  val update_collection :
    management_config -> collection_id:string -> collection_update -> (collection, api_error) result
  val delete_collection :
    management_config -> collection_id:string -> (collection_delete, api_error) result
  val add_collection_document :
    management_config ->
    collection_id:string ->
    file_id:string ->
    fields:Chatoyant_runtime.Json.t option ->
    (collection_document, api_error) result
  val list_collection_documents :
    ?limit:int ->
    ?order:string ->
    ?sort_by:string ->
    ?pagination_token:string ->
    ?filter:string ->
    management_config ->
    collection_id:string ->
    (collection_document_list, api_error) result
  val retrieve_collection_document :
    management_config ->
    collection_id:string ->
    file_id:string ->
    (collection_document, api_error) result
  val regenerate_collection_document :
    management_config ->
    collection_id:string ->
    file_id:string ->
    (collection_document, api_error) result
  val remove_collection_document :
    management_config ->
    collection_id:string ->
    file_id:string ->
    (collection_delete, api_error) result
  val search_collection :
    management_config ->
    collection_id:string ->
    collection_search_request ->
    (collection_search_response, api_error) result
end
(** Runtime-independent xAI client. Native OCaml, Node/Melange, browser, and
    tests supply the [HTTP] effect implementation; the provider logic never
    performs ambient IO. *)

module Make_websocket (Ws : Chatoyant_runtime.Effect.WEBSOCKET) : sig
  type connection = Ws.connection

  val default_realtime_base_url : string
  val default_responses_base_url : string
  val default_tts_base_url : string
  val default_stt_base_url : string
  val connect : websocket_config -> (connection -> 'a) -> ('a, api_error) result
  val send_json : connection -> Chatoyant_runtime.Json.t -> (unit, api_error) result
  val receive_json : connection -> (Chatoyant_runtime.Json.t, api_error) result
  val send_text : connection -> string -> (unit, api_error) result
  val receive_frame : connection -> (Ws.message, api_error) result
  val close : ?code:int -> ?reason:string -> connection -> (unit, api_error) result
end
(** xAI WebSocket helper for Voice Agent and streaming TTS endpoints. *)

module Make_provider
    (Http : Chatoyant_runtime.Effect.HTTP)
    (Config : sig
      val api_key : string
      val base_url : string
      val timeout_ms : int option
    end) : Provider.CHAT
(** Unified chat adapter used by higher-level Chatoyant core flows. *)
