type request = Openai.chat_request
type response = Openai.chat_response
type responses_request = Openai.responses_request
type responses_response = Openai.responses_response
type image_request = Openai.image_request
type image_response = Openai.image_response
type embedding_request = Openai.embedding_request
type embedding_response = Openai.embedding_response

let default_config =
  Openai_compatible.local_config ~base_url:"http://127.0.0.1:11434/v1" ()

let chat_request_json request =
  Openai_compatible.chat_request_json default_config request

let responses_request_json request =
  Openai_compatible.responses_request_json default_config request

let image_request_json request =
  Openai_compatible.image_request_json default_config request

let embedding_request_json request =
  Openai_compatible.embedding_request_json default_config request

let authorization_headers ?(api_key = "local") () =
  Openai_compatible.authorization_headers
    (Openai_compatible.local_config ~api_key ~base_url:"http://127.0.0.1:11434/v1" ())

let chat_response_of_stream_chunks chunks =
  Openai_compatible.chat_response_of_stream_chunks default_config chunks

let response_of_stream_chunks chunks =
  Openai_compatible.response_of_stream_chunks default_config chunks

let compatible_config base_url api_key timeout_ms headers =
  Openai_compatible.local_config ?api_key ?timeout_ms ~headers ~base_url ()

module Make_client (Http : Chatoyant_runtime.Effect.HTTP) = struct
  module Client = Openai_compatible.Make_client (Http)

  type config = {
    base_url : string;
    api_key : string option;
    timeout_ms : int option;
    headers : (string * string) list;
  }

  let to_compatible config =
    compatible_config config.base_url config.api_key config.timeout_ms config.headers

  let create_chat config request =
    Client.create_chat (to_compatible config) request

  let create_response config request =
    Client.create_response (to_compatible config) request

  let generate_image config request =
    Client.generate_image (to_compatible config) request

  let create_embedding config request =
    Client.create_embedding (to_compatible config) request

  let list_models config = Client.list_models (to_compatible config)

  let retrieve_model config ~model_id =
    Client.retrieve_model (to_compatible config) ~model_id
end

module Make_provider
    (Http : Chatoyant_runtime.Effect.HTTP)
    (Config : sig
      val base_url : string
      val api_key : string option
      val timeout_ms : int option
      val headers : (string * string) list
    end) =
struct
  module Provider_impl =
    Openai_compatible.Make_provider (Http) (struct
      let provider_id = Provider.Local

      let config =
        compatible_config Config.base_url Config.api_key Config.timeout_ms Config.headers
    end)

  let id = Provider_impl.id
  let generate = Provider_impl.generate
end
