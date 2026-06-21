(** Typed model, reasoning, and creativity presets. *)

type model_preset =
  | Fast
  | Cheap
  | Best
  | Balanced
  | Reasoning

type reasoning =
  | Off
  | Low
  | Medium
  | High

type creativity =
  | Precise
  | Balanced_creativity
  | Creative
  | Wild

type reasoning_config = {
  openai_effort : string;
  anthropic_budget_tokens : int option;
  xai_prefer_reasoning_model : bool;
}

val model_preset_of_string : string -> model_preset option
val string_of_model_preset : model_preset -> string

val resolve_model_preset :
  provider:Chatoyant_provider.Provider.id -> model_preset -> string option

val temperature_of_creativity : creativity -> float
val reasoning_config : reasoning -> reasoning_config
val supports_openai_reasoning : string -> bool
val adjust_xai_model_for_reasoning : prefer_reasoning:bool -> string -> string
