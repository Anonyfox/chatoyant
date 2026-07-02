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
      (** Provenance for token usage. Provider-reported values are
          authoritative; estimated values must only be used when a provider did
          not return usage. Local inference is unmetered by design. *)

type pricing = {
  input_per_million : float;
  output_per_million : float;
  cached_per_million : float option;
  cache_write_per_million : float option;
  cache_write_1h_per_million : float option;
  per_image : float option;
  per_second : float option;
}

type result = {
  input : float;
  output : float;
  cached : float;
  cache_write : float;
  actual_usd : float option;
  total : float;
}

type cost_per_token = {
  per_token_input : float;
  per_token_output : float;
  per_token_cached : float;
  per_token_cache_write : float;
}

val empty_usage : usage

val pricing :
  ?cached_per_million:float ->
  ?cache_write_per_million:float ->
  ?cache_write_1h_per_million:float ->
  ?per_image:float ->
  ?per_second:float ->
  input_per_million:float ->
  output_per_million:float ->
  unit ->
  pricing

val calculate : pricing:pricing option -> usage -> result

val estimate :
  pricing:pricing option ->
  ?input_tokens:int ->
  ?input_text:string ->
  expected_output_tokens:int ->
  unit ->
  result

val calculate_batch : pricing:pricing option -> usage list -> result
val calculate_image : pricing:pricing option -> count:int -> float
val calculate_video : pricing:pricing option -> duration_seconds:int -> float
val cost_per_token : pricing -> cost_per_token
val normalize_total : usage -> usage
val source_to_string : source -> string
val usage_to_json : usage -> Chatoyant_runtime.Json.t
val result_to_json : result -> Chatoyant_runtime.Json.t
