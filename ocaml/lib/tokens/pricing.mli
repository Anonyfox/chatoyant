(** Pricing lookup for known and family-matched models.

    Known prices are per 1M tokens unless media-specific. [get] returns exact
    entries first, then conservative family/provider fallbacks for recognizable
    future model names. [has] only reports explicit known table entries. *)

val all : (string * Cost.pricing) list
val get : ?fallback:Cost.pricing -> string -> Cost.pricing option
val has : string -> bool
