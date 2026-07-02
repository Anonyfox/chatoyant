(** Context window lookup for known models. *)

val all : (string * int) list
val get : ?fallback:int -> string -> int option
val has : string -> bool
