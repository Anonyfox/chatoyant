(** Context window lookup for known and family-matched models. *)

val get : ?fallback:int -> string -> int option
val has : string -> bool
