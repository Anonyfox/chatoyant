(** OpenAI-compatible response decoders over decoded JSON. *)

val chat_content : Chatoyant_runtime.Json.t -> string option
val chat_usage : Chatoyant_runtime.Json.t -> Chatoyant_tokens.Cost.usage
val responses_output_text : Chatoyant_runtime.Json.t -> string
val responses_usage : Chatoyant_runtime.Json.t -> Chatoyant_tokens.Cost.usage
val generation_of_chat_json : Chatoyant_runtime.Json.t -> Provider.generation
val generation_of_responses_json : Chatoyant_runtime.Json.t -> Provider.generation
