(** Heuristic token estimation.

    These functions intentionally mirror the current TypeScript package's
    zero-dependency token estimates. They are fast approximations, not provider
    tokenizer bindings. *)

type content_kind =
  | English
  | Code
  | Cjk
  | Mixed

val chars_per_token : content_kind -> float
val classify : string -> content_kind
val estimate : string -> int
val estimate_many : string list -> int
val estimate_with_ratio : chars_per_token:float -> string -> int
