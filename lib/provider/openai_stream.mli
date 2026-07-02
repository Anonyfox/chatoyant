(** OpenAI-compatible stream accumulation over decoded JSON chunks. *)

type tool_call_delta = {
  tool_index : int;
  tool_id : string option;
  tool_name : string option;
  tool_arguments_delta : string option;
}

type delta = {
  delta_content : string option;
  delta_reasoning_content : string option;
  delta_tool_calls : tool_call_delta list;
  delta_finish_reason : string option;
  delta_usage : Chatoyant_runtime.Json.t option;
}

type accumulated = {
  accumulated_content : string;
  accumulated_reasoning_content : string;
  accumulated_finish_reason : string option;
  accumulated_usage : Chatoyant_runtime.Json.t option;
}

val empty : accumulated
val delta_of_json : Chatoyant_runtime.Json.t -> delta
val apply_delta : accumulated -> delta -> accumulated
val apply_chunk_json : accumulated -> Chatoyant_runtime.Json.t -> accumulated
