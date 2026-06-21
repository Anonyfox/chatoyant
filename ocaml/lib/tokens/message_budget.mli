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

val estimate_message : ?provider:provider -> message -> int
val estimate_chat : ?provider:provider -> message list -> int
val fits : ?provider:provider -> max_tokens:int -> message list -> bool
val fit : ?provider:provider -> max_tokens:int -> reserve_for_response:int -> message list -> message list
