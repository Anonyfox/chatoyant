(** Token usage and cost data shared by core and provider layers. *)

type usage = {
  input_tokens : int;
  output_tokens : int;
  reasoning_tokens : int;
  cached_tokens : int;
  cache_write_tokens : int;
  total_tokens : int;
  actual_cost_usd : float option;
}

type source =
  | Provider_reported
  | Estimated
  | Unmetered
  | Unknown
(** Provenance for token usage. Provider-reported values are authoritative;
    estimated values must only be used when a provider did not return usage.
    Local inference is unmetered by design. *)

type pricing = {
  input_per_million : float;
  output_per_million : float;
  cached_per_million : float option;
  cache_write_per_million : float option;
}

type result = {
  input : float;
  output : float;
  cached : float;
  cache_write : float;
  actual_usd : float option;
  total : float;
}

val empty_usage : usage
val calculate : pricing:pricing option -> usage -> result
val normalize_total : usage -> usage
val source_to_string : source -> string
val usage_to_json : usage -> Chatoyant_runtime.Json.t
val result_to_json : result -> Chatoyant_runtime.Json.t
