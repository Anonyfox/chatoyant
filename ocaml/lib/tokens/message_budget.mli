(** Chat message token estimation and fitting. *)

type provider =
  | Openai
  | Anthropic
  | Xai

type message = {
  role : string;
  content : string option;
  name : string option;
}

type overhead = {
  per_message : int;
  conversation : int;
}

val get_overhead : ?provider:provider -> unit -> overhead
val estimate_message : ?provider:provider -> message -> int
val estimate_chat : ?provider:provider -> message list -> int
val estimate_system_prompt : ?provider:provider -> string -> int
val available_tokens :
  context_window:int ->
  ?system_prompt_tokens:int ->
  ?reserve_for_response:int ->
  ?history_tokens:int ->
  unit ->
  int
val fits : ?provider:provider -> max_tokens:int -> message list -> bool
val fit : ?provider:provider -> max_tokens:int -> reserve_for_response:int -> message list -> message list
