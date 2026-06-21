(** Text and message chunking helpers for context management. *)

type options = {
  max_tokens : int;
  overlap : int;
  separator : string option;
}

val split_text : ?overlap:int -> ?separator:string -> max_tokens:int -> string -> string list
val truncate_content : ?ellipsis:string -> max_tokens:int -> string -> string
val fit_messages :
  ?provider:Message_budget.provider ->
  max_tokens:int ->
  ?reserve_for_response:int ->
  Message_budget.message list ->
  Message_budget.message list
val paginate_messages :
  ?provider:Message_budget.provider ->
  tokens_per_page:int ->
  Message_budget.message list ->
  Message_budget.message list list
val estimate_chunk_count : chunk_size:int -> string -> int
