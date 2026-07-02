(** Local OpenAI-compatible provider.

    Targets local inference servers such as Ollama, LM Studio, mlx-lm/oMLX,
    llama.cpp server, and vLLM. The public surface stays provider-specific;
    compatibility quirks are handled internally. *)

type request = Openai.chat_request
type response = Openai.chat_response
type responses_request = Openai.responses_request
type responses_response = Openai.responses_response
type image_request = Openai.image_request
type image_response = Openai.image_response
type embedding_request = Openai.embedding_request
type embedding_response = Openai.embedding_response

val chat_request_json : request -> Chatoyant_runtime.Json.t
val responses_request_json : responses_request -> Chatoyant_runtime.Json.t
val image_request_json : image_request -> Chatoyant_runtime.Json.t
val embedding_request_json : embedding_request -> Chatoyant_runtime.Json.t
val authorization_headers : ?api_key:string -> unit -> (string * string) list
val chat_response_of_stream_chunks : string list -> (response, string) result

val response_of_stream_chunks :
  string list -> (responses_response, string) result

module Make_client (Http : Chatoyant_runtime.Effect.HTTP) : sig
  type config = {
    base_url : string;
    api_key : string option;
    timeout_ms : int option;
    headers : (string * string) list;
  }

  val create_chat : config -> request -> (response, Openai.api_error) result

  val create_response :
    config -> responses_request -> (responses_response, Openai.api_error) result

  val generate_image :
    config -> image_request -> (image_response, Openai.api_error) result

  val create_embedding :
    config -> embedding_request -> (embedding_response, Openai.api_error) result

  val list_models : config -> (Openai.model_list, Openai.api_error) result

  val retrieve_model :
    config -> model_id:string -> (Openai.model, Openai.api_error) result
end

module Make_provider
    (Http : Chatoyant_runtime.Effect.HTTP)
    (Config : sig
      val base_url : string
      val api_key : string option
      val timeout_ms : int option
      val headers : (string * string) list
    end) : Provider.CHAT
