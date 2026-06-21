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

val chat_response_of_json : Chatoyant_runtime.Json.t -> chat_response
val generation_of_chat_response : chat_response -> Provider.generation
val responses_response_of_json : Chatoyant_runtime.Json.t -> responses_response
val generation_of_responses_response : responses_response -> Provider.generation
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
  val create_response : config -> responses_request -> (responses_response, api_error) result
  val compact_response : config -> responses_request -> (responses_response, api_error) result
  val retrieve_response : config -> response_id:string -> (responses_response, api_error) result
  val delete_response : config -> response_id:string -> (delete_response, api_error) result
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

module Make_provider
    (Http : Chatoyant_runtime.Effect.HTTP)
    (Config : sig
      val api_key : string
      val base_url : string
      val timeout_ms : int option
    end) : Provider.CHAT
(** Unified chat adapter used by higher-level Chatoyant core flows. *)
