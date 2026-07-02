(** OpenRouter provider.

    OpenRouter is OpenAI-compatible at the transport layer but has its own
    routing, attribution headers, model naming, and credit-cost semantics. *)

type request = Openai.chat_request
type response = Openai.chat_response
type responses_request = Openai.responses_request
type responses_response = Openai.responses_response

type credits = {
  total_credits : float;
  total_usage : float;
  raw : Chatoyant_runtime.Json.t;
}

type provider_info = {
  provider_id : string option;
  provider_name : string option;
  provider_raw : Chatoyant_runtime.Json.t;
}

type provider_list = {
  providers : provider_info list;
  raw : Chatoyant_runtime.Json.t;
}

type generation = {
  generation_id : string option;
  generation_model : string option;
  generation_provider_name : string option;
  generation_total_cost : float option;
  generation_created_at : string option;
  generation_raw : Chatoyant_runtime.Json.t;
}

type model_count = {
  model_count : int;
  model_count_raw : Chatoyant_runtime.Json.t;
}

type model_endpoint = {
  model_endpoint_name : string option;
  model_endpoint_provider_name : string option;
  model_endpoint_context_length : int option;
  model_endpoint_max_completion_tokens : int option;
  model_endpoint_quantization : string option;
  model_endpoint_status : string option;
  model_endpoint_supported_parameters : string list;
  model_endpoint_pricing : Chatoyant_runtime.Json.t option;
  model_endpoint_raw : Chatoyant_runtime.Json.t;
}

type model_endpoint_list = {
  model_endpoint_model_id : string option;
  model_endpoint_model_name : string option;
  model_endpoint_model_description : string option;
  model_endpoint_model_created : int option;
  model_endpoint_model_architecture : Chatoyant_runtime.Json.t option;
  model_endpoints : model_endpoint list;
  model_endpoint_list_raw : Chatoyant_runtime.Json.t;
}

type rerank_document =
  | Rerank_text of string
  | Rerank_object of Chatoyant_runtime.Json.t

type rerank_request = {
  rerank_model : string;
  rerank_query : string;
  rerank_documents : rerank_document list;
  rerank_top_n : int option;
  rerank_provider : Chatoyant_runtime.Json.t option;
  rerank_extra : (string * Chatoyant_runtime.Json.t) list;
}

type rerank_result = {
  rerank_index : int option;
  rerank_relevance_score : float option;
  rerank_document : Chatoyant_runtime.Json.t option;
  rerank_result_raw : Chatoyant_runtime.Json.t;
}

type rerank_response = {
  rerank_id : string option;
  rerank_model_name : string option;
  rerank_provider_name : string option;
  rerank_results : rerank_result list;
  rerank_usage : Chatoyant_runtime.Json.t option;
  rerank_raw : Chatoyant_runtime.Json.t;
}

type video_request = {
  video_model : string;
  video_prompt : string;
  video_aspect_ratio : string option;
  video_callback_url : string option;
  video_duration : int option;
  video_frame_images : Chatoyant_runtime.Json.t list;
  video_generate_audio : bool option;
  video_input_references : Chatoyant_runtime.Json.t list;
  video_provider : Chatoyant_runtime.Json.t option;
  video_resolution : string option;
  video_seed : int option;
  video_size : string option;
  video_extra : (string * Chatoyant_runtime.Json.t) list;
}

type video_status =
  | Video_pending
  | Video_running
  | Video_completed
  | Video_failed
  | Video_cancelled
  | Video_unknown_status of string

type video_job = {
  video_job_id : string option;
  video_polling_url : string option;
  video_status : video_status;
  video_error : string option;
  video_generation_id : string option;
  video_unsigned_urls : string list;
  video_usage : Chatoyant_runtime.Json.t option;
  video_raw : Chatoyant_runtime.Json.t;
}

type video_model = {
  video_model_id : string option;
  video_model_name : string option;
  video_model_canonical_slug : string option;
  video_model_created : int option;
  video_model_raw : Chatoyant_runtime.Json.t;
}

type video_model_list = {
  video_models : video_model list;
  video_models_raw : Chatoyant_runtime.Json.t;
}

type management_resource = {
  management_id : string option;
  management_name : string option;
  management_raw : Chatoyant_runtime.Json.t;
}

type management_list = {
  management_data : management_resource list;
  management_raw : Chatoyant_runtime.Json.t;
}

type management_delete = {
  management_delete_id : string option;
  management_deleted : bool;
  management_delete_raw : Chatoyant_runtime.Json.t;
}

val base_url : string
val chat_request_json : request -> Chatoyant_runtime.Json.t
val rerank_request_json : rerank_request -> Chatoyant_runtime.Json.t
val video_request_json : video_request -> Chatoyant_runtime.Json.t

val authorization_headers :
  ?http_referer:string ->
  ?title:string ->
  api_key:string ->
  unit ->
  (string * string) list

val chat_response_of_stream_chunks : string list -> (response, string) result
val credits_of_json : Chatoyant_runtime.Json.t -> credits
val provider_list_of_json : Chatoyant_runtime.Json.t -> provider_list
val generation_of_json : Chatoyant_runtime.Json.t -> generation
val model_count_of_json : Chatoyant_runtime.Json.t -> model_count

val model_endpoint_list_of_json :
  Chatoyant_runtime.Json.t -> model_endpoint_list

val rerank_response_of_json : Chatoyant_runtime.Json.t -> rerank_response
val video_job_of_json : Chatoyant_runtime.Json.t -> video_job
val video_model_list_of_json : Chatoyant_runtime.Json.t -> video_model_list

val management_resource_of_json :
  Chatoyant_runtime.Json.t -> management_resource

val management_list_of_json : Chatoyant_runtime.Json.t -> management_list
val management_delete_of_json : Chatoyant_runtime.Json.t -> management_delete

module Make_client (Http : Chatoyant_runtime.Effect.HTTP) : sig
  type config = {
    api_key : string;
    timeout_ms : int option;
    http_referer : string option;
    title : string option;
    headers : (string * string) list;
  }

  type management_config = {
    management_api_key : string;
    management_base_url : string;
    management_timeout_ms : int option;
  }

  val create_chat : config -> request -> (response, Openai.api_error) result

  val create_response :
    config -> responses_request -> (responses_response, Openai.api_error) result

  val list_models : config -> (Openai.model_list, Openai.api_error) result
  val list_user_models : config -> (Openai.model_list, Openai.api_error) result

  val count_models :
    ?output_modalities:string ->
    config ->
    (model_count, Openai.api_error) result

  val retrieve_model :
    config -> model_id:string -> (Openai.model, Openai.api_error) result

  val list_model_endpoints :
    config ->
    author:string ->
    slug:string ->
    (model_endpoint_list, Openai.api_error) result

  val list_model_endpoints_by_id :
    config -> model_id:string -> (model_endpoint_list, Openai.api_error) result

  val get_credits : config -> (credits, Openai.api_error) result
  val list_providers : config -> (provider_list, Openai.api_error) result

  val retrieve_generation :
    config -> generation_id:string -> (generation, Openai.api_error) result

  val rerank :
    config -> rerank_request -> (rerank_response, Openai.api_error) result

  val create_video :
    config -> video_request -> (video_job, Openai.api_error) result

  val get_video :
    config -> job_id:string -> (video_job, Openai.api_error) result

  val download_video :
    ?index:int -> config -> job_id:string -> (string, Openai.api_error) result

  val list_video_models : config -> (video_model_list, Openai.api_error) result
  val default_management_base_url : string

  val management_get :
    management_config ->
    path:string ->
    (management_resource, Openai.api_error) result

  val management_list :
    management_config ->
    path:string ->
    (management_list, Openai.api_error) result

  val management_post :
    management_config ->
    path:string ->
    Chatoyant_runtime.Json.t ->
    (management_resource, Openai.api_error) result

  val management_patch :
    management_config ->
    path:string ->
    Chatoyant_runtime.Json.t ->
    (management_resource, Openai.api_error) result

  val management_delete :
    management_config ->
    path:string ->
    (management_delete, Openai.api_error) result

  val list_keys :
    management_config -> (management_list, Openai.api_error) result

  val get_current_key :
    management_config -> (management_resource, Openai.api_error) result

  val create_key :
    management_config ->
    Chatoyant_runtime.Json.t ->
    (management_resource, Openai.api_error) result

  val update_key :
    management_config ->
    key_hash:string ->
    Chatoyant_runtime.Json.t ->
    (management_resource, Openai.api_error) result

  val delete_key :
    management_config ->
    key_hash:string ->
    (management_delete, Openai.api_error) result

  val list_guardrails :
    management_config -> (management_list, Openai.api_error) result

  val create_guardrail :
    management_config ->
    Chatoyant_runtime.Json.t ->
    (management_resource, Openai.api_error) result

  val get_guardrail :
    management_config ->
    guardrail_id:string ->
    (management_resource, Openai.api_error) result

  val update_guardrail :
    management_config ->
    guardrail_id:string ->
    Chatoyant_runtime.Json.t ->
    (management_resource, Openai.api_error) result

  val delete_guardrail :
    management_config ->
    guardrail_id:string ->
    (management_delete, Openai.api_error) result
end

module Make_provider
    (Http : Chatoyant_runtime.Effect.HTTP)
    (Config : sig
      val api_key : string
      val timeout_ms : int option
      val http_referer : string option
      val title : string option
      val headers : (string * string) list
    end) : Provider.CHAT
