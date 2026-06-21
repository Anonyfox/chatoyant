(** Unified generation options. *)

type reasoning =
  | Off
  | Low
  | Medium
  | High

type creativity =
  | Precise
  | Balanced
  | Creative
  | Wild

type model_preset =
  | Fast
  | Cheap
  | Best
  | Balanced_model
  | Reasoning

type t = {
  provider : Chatoyant_provider.Provider.id option;
  model : string option;
  timeout_ms : int option;
  retries : int;
  local_base_url : string option;
  local_api_key : string option;
  local_timeout_ms : int option;
  temperature : float option;
  creativity : creativity option;
  max_tokens : int option;
  top_p : float option;
  stop : string list;
  frequency_penalty : float option;
  presence_penalty : float option;
  reasoning : reasoning option;
  web_search : bool option;
  thinking_budget : int option;
  max_tool_iterations : int;
  tool_timeout_ms : int option;
  extra : Chatoyant_runtime.Json.t option;
}

val default_timeout_ms : int
val default_retries : int
val default_max_tool_iterations : int
val default_tool_timeout_ms : int
val default : t
val merge : t -> t -> t
val temperature_of_creativity : creativity -> float
val reasoning_effort : reasoning -> string
val anthropic_thinking_budget : reasoning -> int option
