(** Provider-neutral contracts.

    Raw provider implementations should expose complete faithful API clients.
    Unified adapters can then implement these signatures to plug into
    [Chatoyant_core] without forcing the core to know provider-specific wire
    details. *)

type id =
  | Openai
  | Anthropic
  | Xai
  | Local
  | Openrouter

type role =
  | System
  | User
  | Assistant
  | Tool

type tool_call = {
  id : string;
  name : string;
  arguments : Chatoyant_runtime.Json.t;
  arguments_json : string;
  raw : Chatoyant_runtime.Json.t option;
}
(** Normalized assistant tool call. [arguments_json] preserves partial or
    provider-original argument text when JSON parsing is impossible; [arguments]
    is [Null] in that case. *)

type message = {
  role : role;
  content : string option;
  name : string option;
  tool_call_id : string option;
  tool_calls : tool_call list;
  tool_result_error : bool option;
}

type tool_definition = {
  tool_name : string;
  tool_description : string option;
  tool_parameters : Chatoyant_runtime.Json.t;
  tool_strict : bool option;
}

type options = {
  model : string;
  temperature : float option;
  max_tokens : int option;
  top_p : float option;
  stop : string list;
  frequency_penalty : float option;
  presence_penalty : float option;
  web_search : bool option;
  thinking_budget : int option;
  reasoning_effort : string option;
  timeout_ms : int option;
  tools : tool_definition list;
  tool_choice : string option;
  extra : Chatoyant_runtime.Json.t option;
}

type error =
  | Missing_api_key of { provider : id; env_key : string }
  | Http_error of { status : int; body : string }
  | Decode_error of string
  | Unsupported of string
  | Runtime_error of string

type generation = {
  content : string;
  reasoning_content : string;
  usage : Chatoyant_tokens.Cost.usage;
  usage_source : Chatoyant_tokens.Cost.source;
  tool_calls : tool_call list;
  finish_reason : string option;
  raw : Chatoyant_runtime.Json.t option;
}

module type CHAT = sig
  val id : id
  val generate : message list -> options -> (generation, error) result
end

val string_of_id : id -> string
val id_of_string : string -> id option
val error_to_string : error -> string
val tool_definition_to_json : tool_definition -> Chatoyant_runtime.Json.t
val tool_call_to_json : tool_call -> Chatoyant_runtime.Json.t
val generation_to_json : generation -> Chatoyant_runtime.Json.t
