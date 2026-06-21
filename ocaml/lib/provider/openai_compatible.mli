(** Internal OpenAI-compatible provider kernel.

    This module is intentionally not re-exported from [Chatoyant_provider].
    OpenRouter and Local expose small provider-specific surfaces while sharing
    deterministic request normalization, response decoding, usage accounting,
    and stream smoothing here. *)

type kind =
  | Local
  | Openrouter

type profile =
  | Full
  | Conservative_local

type config = {
  api_key : string;
  base_url : string;
  timeout_ms : int option;
  headers : (string * string) list;
  profile : profile;
  kind : kind;
}

type chat_response = Openai.chat_response
type responses_request = Openai.responses_request
type responses_response = Openai.responses_response
type image_request = Openai.image_request
type image_response = Openai.image_response
type embedding_request = Openai.embedding_request
type embedding_response = Openai.embedding_response

val local_config :
  ?api_key:string ->
  ?headers:(string * string) list ->
  ?timeout_ms:int ->
  base_url:string ->
  unit ->
  config

val openrouter_config :
  ?http_referer:string ->
  ?title:string ->
  ?headers:(string * string) list ->
  ?timeout_ms:int ->
  api_key:string ->
  unit ->
  config

val authorization_headers : config -> (string * string) list
val normalize_chat_request : config -> Openai.chat_request -> Openai.chat_request
val chat_request_json : config -> Openai.chat_request -> Chatoyant_runtime.Json.t
val responses_request_json : config -> responses_request -> Chatoyant_runtime.Json.t
val image_request_json : config -> image_request -> Chatoyant_runtime.Json.t
val embedding_request_json : config -> embedding_request -> Chatoyant_runtime.Json.t
val chat_response_of_json : config -> Chatoyant_runtime.Json.t -> chat_response
val responses_response_of_json : config -> Chatoyant_runtime.Json.t -> responses_response
val generation_of_chat_response : chat_response -> Provider.generation
val chat_response_of_stream_chunks : config -> string list -> (chat_response, string) result
val response_of_stream_chunks : config -> string list -> (responses_response, string) result

module Make_client (Http : Chatoyant_runtime.Effect.HTTP) : sig
  val create_chat : config -> Openai.chat_request -> (chat_response, Openai.api_error) result
  val create_response : config -> responses_request -> (responses_response, Openai.api_error) result
  val generate_image : config -> image_request -> (image_response, Openai.api_error) result
  val create_embedding : config -> embedding_request -> (embedding_response, Openai.api_error) result
  val list_models : config -> (Openai.model_list, Openai.api_error) result
  val retrieve_model : config -> model_id:string -> (Openai.model, Openai.api_error) result
end

module Make_provider
    (Http : Chatoyant_runtime.Effect.HTTP)
    (Config : sig
      val provider_id : Provider.id
      val config : config
    end) : Provider.CHAT
