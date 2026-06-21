(** Provider usage decoders into normalized token usage. *)

val openai_compatible : Chatoyant_runtime.Json.t -> Chatoyant_tokens.Cost.usage
val anthropic : Chatoyant_runtime.Json.t -> Chatoyant_tokens.Cost.usage
val xai : Chatoyant_runtime.Json.t -> Chatoyant_tokens.Cost.usage
val openrouter : Chatoyant_runtime.Json.t -> Chatoyant_tokens.Cost.usage
