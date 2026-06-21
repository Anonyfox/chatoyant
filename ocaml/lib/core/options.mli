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
  temperature : float option;
  creativity : creativity option;
  max_tokens : int option;
  reasoning : reasoning option;
  extra : Chatoyant_runtime.Json.t option;
}

val default : t
val merge : t -> t -> t
val temperature_of_creativity : creativity -> float
