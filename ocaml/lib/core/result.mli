(** Normalized generation metadata. *)

type timing = {
  latency_ms : int;
  time_to_first_token_ms : int option;
}

type token_speed = {
  output_tokens_per_second : float option;
  total_tokens_per_second : float option;
  measured_output_tokens : int;
  measured_total_tokens : int;
}
(** Throughput derived only from real elapsed time and reported/estimated
    token counts. Values are [None] when the denominator or numerator is zero. *)

type cost = {
  estimated_usd : float;
  actual_usd : float option;
}

type generation = {
  content : string;
  reasoning_content : string;
  usage : Chatoyant_tokens.Cost.usage;
  usage_source : Chatoyant_tokens.Cost.source;
  timing : timing;
  token_speed : token_speed;
  cost : cost;
  provider : Chatoyant_provider.Provider.id;
  model : string;
  tool_calls : Chatoyant_provider.Provider.tool_call list;
  finish_reason : string option;
  cached : bool;
  iterations : int;
}

val empty_timing : timing
val empty_token_speed : token_speed
val empty_cost : cost
val token_speed : latency_ms:int -> Chatoyant_tokens.Cost.usage -> token_speed
val timing_to_json : timing -> Chatoyant_runtime.Json.t
val token_speed_to_json : token_speed -> Chatoyant_runtime.Json.t
val cost_to_json : cost -> Chatoyant_runtime.Json.t
val generation_to_json : generation -> Chatoyant_runtime.Json.t
