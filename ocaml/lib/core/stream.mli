(** Provider-neutral streaming accumulator.

    Raw providers decode their own SSE/WebSocket events first, then can map
    deltas into these frames. The accumulator owns cross-provider invariants:
    stable text concatenation, fragmented tool-call argument merging, usage
    provenance, finish reason, and timing/token-speed derivation. *)

type tool_call_delta = {
  index : int;
  id : string option;
  name : string option;
  arguments_delta : string;
  raw : Chatoyant_runtime.Json.t option;
}

type frame = {
  content_delta : string option;
  reasoning_delta : string option;
  tool_call_deltas : tool_call_delta list;
  usage : Chatoyant_tokens.Cost.usage option;
  usage_source : Chatoyant_tokens.Cost.source;
  finish_reason : string option;
  raw : Chatoyant_runtime.Json.t option;
}

type state

val empty : state
val apply : state -> frame -> state
val content : state -> string
val reasoning_content : state -> string
val tool_calls : state -> Chatoyant_provider.Provider.tool_call list
val usage : state -> Chatoyant_tokens.Cost.usage
val usage_source : state -> Chatoyant_tokens.Cost.source
val finish_reason : state -> string option
val note_first_token : now_ms:int -> state -> state
val to_generation :
  provider:Chatoyant_provider.Provider.id ->
  model:string ->
  started_ms:int ->
  finished_ms:int ->
  state ->
  Result.generation
val frame_to_json : frame -> Chatoyant_runtime.Json.t
val state_to_json : state -> Chatoyant_runtime.Json.t
