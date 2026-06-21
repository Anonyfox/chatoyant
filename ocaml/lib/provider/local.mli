(** Local OpenAI-compatible provider.

    Targets local inference servers such as Ollama, LM Studio, mlx-lm/oMLX,
    llama.cpp server, and vLLM. The public surface stays provider-specific;
    compatibility quirks are handled internally. *)

type request = Openai.chat_request
type response = Openai.chat_response

val chat_request_json : request -> Chatoyant_runtime.Json.t
val authorization_headers : ?api_key:string -> unit -> (string * string) list
val chat_response_of_stream_chunks : string list -> (response, string) result

module Make_client (Http : Chatoyant_runtime.Effect.HTTP) : sig
  type config = {
    base_url : string;
    api_key : string option;
    timeout_ms : int option;
    headers : (string * string) list;
  }

  val create_chat : config -> request -> (response, Openai.api_error) result
  val list_models : config -> (Openai.model_list, Openai.api_error) result
  val retrieve_model : config -> model_id:string -> (Openai.model, Openai.api_error) result
end

module Make_provider
    (Http : Chatoyant_runtime.Effect.HTTP)
    (Config : sig
      val base_url : string
      val api_key : string option
      val timeout_ms : int option
      val headers : (string * string) list
    end) : Provider.CHAT
