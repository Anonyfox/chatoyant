(** Pricing lookup for known and family-matched models. *)

val get : string -> Cost.pricing option
val has : string -> bool
