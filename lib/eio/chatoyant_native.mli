(** Eio runtime integration for native Chatoyant consumers.

    This library keeps the provider implementations runtime-neutral while making
    the native path feel natural in Eio applications. Build the HTTP and clock
    effects from an [Eio_main.run] environment, then pass the resulting modules
    to the existing provider/core functors or use the provider constructors
    below. *)

module Clock : sig
  val make : clock:_ Eio.Time.clock -> (module Chatoyant_runtime.Effect.CLOCK)
  (** [make ~clock] adapts an Eio wall clock to Chatoyant's clock effect. *)
end

module Env : Chatoyant_runtime.Effect.ENV
(** Environment lookup backed by [Sys.getenv_opt]. *)

module Http : sig
  type multipart_part = {
    name : string;
    filename : string option;
    content_type : string option;
    body : string;
  }

  type body =
    | Empty
    | Text of string
    | Json of Chatoyant_runtime.Json.t
    | Multipart of multipart_part list

  type request = {
    method_ : string;
    url : string;
    headers : (string * string) list;
    body : body;
    timeout_ms : int option;
  }

  type response = {
    status : int;
    headers : (string * string) list;
    body : string;
  }

  type error = Timeout of int | Network of string | Invalid_response of string

  val error_to_string : error -> string
  (** Human-readable HTTP error rendering for app/tool handlers. *)

  (** HTTP effect module with types tied to [Chatoyant.Http]. *)
  module type EFFECT =
    Chatoyant_runtime.Effect.HTTP
      with type multipart_part = multipart_part
       and type body = body
       and type request = request
       and type response = response
       and type error = error

  type client_certificate = {
    certificate_pem : string;
    private_key_pem : string;
    authenticator : X509.Authenticator.t option;
  }
  (** PEM-encoded client certificate chain and private key for mTLS provider
      endpoints. When [authenticator] is omitted, system trust roots are used
      for server verification. *)

  type https =
    | System
        (** Use system trust roots through [ca-certs] and verify HTTPS hosts. *)
    | Authenticator of X509.Authenticator.t
        (** Build a TLS client from a caller-supplied X.509 authenticator. *)
    | Mutual_tls of client_certificate
        (** Use system/server authentication plus a PEM client certificate. *)
    | Tls_config of Tls.Config.client
        (** Use an already constructed TLS client config. *)
    | Disabled
        (** Disable HTTPS. Plain HTTP URLs still work; HTTPS URLs fail fast. *)

  val default_max_response_size : int
  (** Default response body limit, currently 100 MiB. *)

  val tls_config :
    ?authenticator:X509.Authenticator.t ->
    unit ->
    (Tls.Config.client, string) result
  (** Build the TLS client config used by [System] and [Authenticator]. *)

  val mtls_config :
    ?authenticator:X509.Authenticator.t ->
    certificate_pem:string ->
    private_key_pem:string ->
    unit ->
    (Tls.Config.client, string) result
  (** Build a TLS client config with a PEM certificate chain/private key for
      mTLS endpoints such as xAI enterprise deployments. *)

  val make :
    ?https:https ->
    ?max_response_size:int ->
    net:_ Eio.Net.t ->
    clock:_ Eio.Time.clock ->
    unit ->
    (module EFFECT)
  (** [make ~net ~clock ()] creates a Chatoyant HTTP effect backed by
      [cohttp-eio].

      Multipart bodies are encoded at this boundary, JSON bodies receive a
      default [content-type: application/json] header when absent, and
      [timeout_ms] is enforced with [Eio.Time.with_timeout]. *)

  val send :
    ?https:https ->
    ?max_response_size:int ->
    net:_ Eio.Net.t ->
    clock:_ Eio.Time.clock ->
    request ->
    (response, error) result
  (** One-shot HTTP request helper for Eio-native app/tool code. For provider
      clients that issue many requests, prefer [make] and reuse the returned
      effect module. *)

  val get :
    ?https:https ->
    ?max_response_size:int ->
    ?headers:(string * string) list ->
    ?timeout_ms:int ->
    net:_ Eio.Net.t ->
    clock:_ Eio.Time.clock ->
    string ->
    (response, error) result
  (** Convenience GET helper. *)

  val get_json :
    ?https:https ->
    ?max_response_size:int ->
    ?headers:(string * string) list ->
    ?timeout_ms:int ->
    net:_ Eio.Net.t ->
    clock:_ Eio.Time.clock ->
    string ->
    (Chatoyant_runtime.Json.t, error) result
  (** Convenience GET helper that parses a successful response body as JSON. *)

  val post_json :
    ?https:https ->
    ?max_response_size:int ->
    ?headers:(string * string) list ->
    ?timeout_ms:int ->
    net:_ Eio.Net.t ->
    clock:_ Eio.Time.clock ->
    string ->
    Chatoyant_runtime.Json.t ->
    (response, error) result
  (** Convenience JSON POST helper. *)
end

module Websocket : sig
  type message = Text of string | Binary of string
  type close = { code : int; reason : string }

  type request = {
    url : string;
    headers : (string * string) list;
    protocols : string list;
    timeout_ms : int option;
  }

  type error =
    | Timeout of int
    | Network of string
    | Invalid_response of string
    | Closed of close option

  type connection

  val error_to_string : error -> string

  module type EFFECT =
    Chatoyant_runtime.Effect.WEBSOCKET
      with type message = message
       and type close = close
       and type request = request
       and type error = error

  val make :
    ?https:Http.https ->
    ?max_frame_size:int ->
    net:_ Eio.Net.t ->
    clock:_ Eio.Time.clock ->
    unit ->
    (module EFFECT)
  (** Eio WebSocket effect with RFC 6455 handshake validation, masked client
      frames, close/ping/pong handling, and scoped connection resources. *)

  val with_connection :
    ?https:Http.https ->
    ?max_frame_size:int ->
    net:_ Eio.Net.t ->
    clock:_ Eio.Time.clock ->
    request ->
    (connection -> 'a) ->
    ('a, error) result

  val send : connection -> message -> (unit, error) result
  val recv : connection -> (message, error) result
  val close : ?code:int -> ?reason:string -> connection -> (unit, error) result
end

module Error : sig
  val provider : Chatoyant_provider.Provider.error -> string
  (** Human-readable provider error rendering. *)

  val http : Http.error -> string
  (** Human-readable Eio HTTP helper error rendering. *)

  val websocket : Websocket.error -> string
  (** Human-readable Eio WebSocket helper error rendering. *)
end

module Provider : sig
  val openai :
    ?https:Http.https ->
    ?max_response_size:int ->
    ?base_url:string ->
    ?timeout_ms:int ->
    net:_ Eio.Net.t ->
    clock:_ Eio.Time.clock ->
    api_key:string ->
    unit ->
    (module Chatoyant_provider.Provider.CHAT)
  (** OpenAI unified chat provider using the Responses API. *)

  val anthropic :
    ?https:Http.https ->
    ?max_response_size:int ->
    ?base_url:string ->
    ?timeout_ms:int ->
    ?beta_headers:string list ->
    net:_ Eio.Net.t ->
    clock:_ Eio.Time.clock ->
    api_key:string ->
    unit ->
    (module Chatoyant_provider.Provider.CHAT)
  (** Anthropic unified chat provider. *)

  val xai :
    ?https:Http.https ->
    ?max_response_size:int ->
    ?base_url:string ->
    ?timeout_ms:int ->
    net:_ Eio.Net.t ->
    clock:_ Eio.Time.clock ->
    api_key:string ->
    unit ->
    (module Chatoyant_provider.Provider.CHAT)
  (** xAI unified chat provider. *)

  val openrouter :
    ?https:Http.https ->
    ?max_response_size:int ->
    ?timeout_ms:int ->
    ?http_referer:string ->
    ?title:string ->
    ?headers:(string * string) list ->
    net:_ Eio.Net.t ->
    clock:_ Eio.Time.clock ->
    api_key:string ->
    unit ->
    (module Chatoyant_provider.Provider.CHAT)
  (** OpenRouter unified chat provider. *)

  val local :
    ?https:Http.https ->
    ?max_response_size:int ->
    ?api_key:string ->
    ?timeout_ms:int ->
    ?headers:(string * string) list ->
    net:_ Eio.Net.t ->
    clock:_ Eio.Time.clock ->
    base_url:string ->
    unit ->
    (module Chatoyant_provider.Provider.CHAT)
  (** Local OpenAI-compatible unified chat provider for Ollama, LM Studio,
      llama.cpp server, vLLM, and similar endpoints. *)
end

module Chat : sig
  type t
  (** Eio-native stateful chat wrapper.

      This hides provider/clock functor instantiation while preserving the same
      OCaml-owned session/tool-loop implementation underneath. Methods mutate
      the wrapped session and return [t], so pipeline style remains natural. *)

  val with_provider :
    ?model:string ->
    ?defaults:Chatoyant_core.Options.t ->
    clock:_ Eio.Time.clock ->
    (module Chatoyant_provider.Provider.CHAT) ->
    t
  (** Build a chat from any first-class Chatoyant provider. *)

  val openai :
    ?https:Http.https ->
    ?max_response_size:int ->
    ?base_url:string ->
    ?timeout_ms:int ->
    ?model:string ->
    ?defaults:Chatoyant_core.Options.t ->
    < net : _ Eio.Net.t ; clock : _ Eio.Time.clock ; .. > ->
    ?api_key:string ->
    unit ->
    t
  (** OpenAI chat. When [api_key] is omitted, [OPENAI_API_KEY] is read from the
      process environment and missing keys are reported as Chatoyant provider
      errors on generation. *)

  val anthropic :
    ?https:Http.https ->
    ?max_response_size:int ->
    ?base_url:string ->
    ?timeout_ms:int ->
    ?beta_headers:string list ->
    ?model:string ->
    ?defaults:Chatoyant_core.Options.t ->
    < net : _ Eio.Net.t ; clock : _ Eio.Time.clock ; .. > ->
    ?api_key:string ->
    unit ->
    t

  val xai :
    ?https:Http.https ->
    ?max_response_size:int ->
    ?base_url:string ->
    ?timeout_ms:int ->
    ?model:string ->
    ?defaults:Chatoyant_core.Options.t ->
    < net : _ Eio.Net.t ; clock : _ Eio.Time.clock ; .. > ->
    ?api_key:string ->
    unit ->
    t

  val openrouter :
    ?https:Http.https ->
    ?max_response_size:int ->
    ?timeout_ms:int ->
    ?http_referer:string ->
    ?title:string ->
    ?headers:(string * string) list ->
    ?model:string ->
    ?defaults:Chatoyant_core.Options.t ->
    < net : _ Eio.Net.t ; clock : _ Eio.Time.clock ; .. > ->
    ?api_key:string ->
    unit ->
    t

  val local :
    ?https:Http.https ->
    ?max_response_size:int ->
    ?api_key:string ->
    ?timeout_ms:int ->
    ?headers:(string * string) list ->
    ?model:string ->
    ?defaults:Chatoyant_core.Options.t ->
    < net : _ Eio.Net.t ; clock : _ Eio.Time.clock ; .. > ->
    base_url:string ->
    unit ->
    t

  val provider : t -> Chatoyant_provider.Provider.id
  (** Provider backing this chat. Useful for diagnostics and shortcut behavior.
  *)

  val model : t -> string
  val set_model : string -> t -> t
  val messages : t -> Chatoyant_core.Message.t list
  val tools : t -> Chatoyant_core.Tool.t list
  val last_result : t -> Chatoyant_core.Result.generation option
  val system : string -> t -> t
  val user : string -> t -> t
  val assistant : string -> t -> t
  val add_message : Chatoyant_core.Message.t -> t -> t
  val add_messages : Chatoyant_core.Message.t list -> t -> t
  val clear_messages : t -> t
  val add_tool : Chatoyant_core.Tool.t -> t -> t
  val add_tools : Chatoyant_core.Tool.t list -> t -> t
  val with_tool : Chatoyant_core.Tool.t -> t -> t
  val with_tools : Chatoyant_core.Tool.t list -> t -> t
  val clear_tools : t -> t

  val generate_with_result :
    ?options:Chatoyant_core.Options.t ->
    ?timeout_ms:int ->
    ?temperature:float ->
    ?max_tokens:int ->
    ?extra:Chatoyant_runtime.Json.t ->
    t ->
    (Chatoyant_core.Result.generation, Chatoyant_provider.Provider.error) result

  val generate :
    ?options:Chatoyant_core.Options.t ->
    ?timeout_ms:int ->
    ?temperature:float ->
    ?max_tokens:int ->
    ?extra:Chatoyant_runtime.Json.t ->
    t ->
    (string, Chatoyant_provider.Provider.error) result

  val ask :
    ?system:string ->
    ?tools:Chatoyant_core.Tool.t list ->
    ?options:Chatoyant_core.Options.t ->
    ?timeout_ms:int ->
    ?temperature:float ->
    ?max_tokens:int ->
    ?extra:Chatoyant_runtime.Json.t ->
    string ->
    t ->
    (Chatoyant_core.Result.generation, Chatoyant_provider.Provider.error) result
  (** Append an optional system prompt, optional tools, the user prompt, then
      generate a full result. This is the compact app-facing path for one-turn
      interactions while preserving the stateful [Chat] API underneath. *)

  val ask_text :
    ?system:string ->
    ?tools:Chatoyant_core.Tool.t list ->
    ?options:Chatoyant_core.Options.t ->
    ?timeout_ms:int ->
    ?temperature:float ->
    ?max_tokens:int ->
    ?extra:Chatoyant_runtime.Json.t ->
    string ->
    t ->
    (string, Chatoyant_provider.Provider.error) result
  (** Like [ask], but returns only assistant text. *)

  val stream_accumulate :
    ?options:Chatoyant_core.Options.t ->
    Chatoyant_core.Stream.frame list ->
    t ->
    Chatoyant_core.Result.generation

  val to_json : t -> Chatoyant_runtime.Json.t
  val stringify : ?pretty:bool -> t -> string
  val load_json : Chatoyant_runtime.Json.t -> t -> (t, string) result
  val clone : t -> t
  val fork : t -> t
end

type client = Chat.t
(** Reusable native Chatoyant client.

    Top-level shortcut calls fork this value before generating, so repeated
    [gen_text] and [gen_data] calls do not mutate the client's message history.
    Use {!Chat} directly when you want an accumulating conversation. *)

val openai :
  ?https:Http.https ->
  ?max_response_size:int ->
  ?base_url:string ->
  ?timeout_ms:int ->
  ?model:string ->
  ?defaults:Chatoyant_core.Options.t ->
  ?api_key:string ->
  ?system:string ->
  ?tools:Chatoyant_core.Tool.t list ->
  < net : _ Eio.Net.t ; clock : _ Eio.Time.clock ; .. > ->
  client
(** OpenAI client for one-shot shortcuts and chat forks. *)

val anthropic :
  ?https:Http.https ->
  ?max_response_size:int ->
  ?base_url:string ->
  ?timeout_ms:int ->
  ?beta_headers:string list ->
  ?model:string ->
  ?defaults:Chatoyant_core.Options.t ->
  ?api_key:string ->
  ?system:string ->
  ?tools:Chatoyant_core.Tool.t list ->
  < net : _ Eio.Net.t ; clock : _ Eio.Time.clock ; .. > ->
  client
(** Anthropic client for one-shot shortcuts and chat forks. *)

val xai :
  ?https:Http.https ->
  ?max_response_size:int ->
  ?base_url:string ->
  ?timeout_ms:int ->
  ?model:string ->
  ?defaults:Chatoyant_core.Options.t ->
  ?api_key:string ->
  ?system:string ->
  ?tools:Chatoyant_core.Tool.t list ->
  < net : _ Eio.Net.t ; clock : _ Eio.Time.clock ; .. > ->
  client
(** xAI client for one-shot shortcuts and chat forks. *)

val openrouter :
  ?https:Http.https ->
  ?max_response_size:int ->
  ?timeout_ms:int ->
  ?http_referer:string ->
  ?title:string ->
  ?headers:(string * string) list ->
  ?model:string ->
  ?defaults:Chatoyant_core.Options.t ->
  ?api_key:string ->
  ?system:string ->
  ?tools:Chatoyant_core.Tool.t list ->
  < net : _ Eio.Net.t ; clock : _ Eio.Time.clock ; .. > ->
  client
(** OpenRouter client for one-shot shortcuts and chat forks. *)

val local :
  ?https:Http.https ->
  ?max_response_size:int ->
  ?api_key:string ->
  ?timeout_ms:int ->
  ?headers:(string * string) list ->
  ?model:string ->
  ?defaults:Chatoyant_core.Options.t ->
  ?system:string ->
  ?tools:Chatoyant_core.Tool.t list ->
  < net : _ Eio.Net.t ; clock : _ Eio.Time.clock ; .. > ->
  base_url:string ->
  client
(** Local OpenAI-compatible client for one-shot shortcuts and chat forks. *)

val gen_result :
  ?system:string ->
  ?tools:Chatoyant_core.Tool.t list ->
  ?options:Chatoyant_core.Options.t ->
  ?timeout_ms:int ->
  ?temperature:float ->
  ?max_tokens:int ->
  ?extra:Chatoyant_runtime.Json.t ->
  client ->
  string ->
  (Chatoyant_core.Result.generation, Chatoyant_provider.Provider.error) result
(** One-shot generation returning full metadata. The supplied client is forked
    before messages are appended. *)

val gen_text :
  ?system:string ->
  ?tools:Chatoyant_core.Tool.t list ->
  ?options:Chatoyant_core.Options.t ->
  ?timeout_ms:int ->
  ?temperature:float ->
  ?max_tokens:int ->
  ?extra:Chatoyant_runtime.Json.t ->
  client ->
  string ->
  (string, Chatoyant_provider.Provider.error) result
(** One-shot text generation. *)

val gen_data :
  ?name:string ->
  ?description:string ->
  ?strict:bool ->
  codec:'a Chatoyant_schema.Codec.t ->
  ?system:string ->
  ?tools:Chatoyant_core.Tool.t list ->
  ?options:Chatoyant_core.Options.t ->
  ?timeout_ms:int ->
  ?temperature:float ->
  ?max_tokens:int ->
  ?extra:Chatoyant_runtime.Json.t ->
  client ->
  string ->
  ('a, Chatoyant_provider.Provider.error) result
(** One-shot typed JSON generation.

    Prefer [[%chatoyant.gen_data: your_type]] with [[@@deriving chatoyant]] so
    the codec and schema stay invisible at the call site. OpenAI uses Responses
    structured output, OpenAI-compatible providers use [response_format], and
    Anthropic receives a schema instruction plus local validation. *)

module Generate : sig
  val with_provider :
    ?options:Chatoyant_core.Options.t ->
    clock:_ Eio.Time.clock ->
    provider:(module Chatoyant_provider.Provider.CHAT) ->
    Chatoyant_core.Chat.t ->
    (Chatoyant_core.Result.generation, Chatoyant_provider.Provider.error) result
  (** Generate from a Chatoyant chat value with a first-class Eio provider. *)
end
