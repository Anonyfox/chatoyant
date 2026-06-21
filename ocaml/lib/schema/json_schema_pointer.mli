(** JSON Pointer and URI-fragment helpers used by [$ref]. *)

type fragment =
  | Empty
  | Pointer of string list
  | Anchor of string

val percent_decode : string -> string
val split_uri_fragment : string -> string * string option
val parse_fragment : string option -> fragment
val resolve_pointer : Chatoyant_runtime.Json.t -> string list -> Chatoyant_runtime.Json.t option
val pointer_to_string : string list -> string
