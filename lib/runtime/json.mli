(** Runtime-independent JSON representation.

    This module is intentionally small and pure. Provider decoders should use it
    at their boundaries, while backend-specific modules can translate to and
    from native OCaml parsers or JavaScript values. Unknown provider fields
    should be preserved as JSON values when doing so helps forward
    compatibility. *)

type t =
  | Null
  | Bool of bool
  | Float of float
  | String of string
  | Array of t list
  | Object of (string * t) list

val field : string -> t -> t option
(** Return a field from an object, or [None] when the value is not an object or
    the field is missing. Duplicate keys resolve to the first key encountered.
*)

val as_string : t -> string option
(** Decode helpers for tolerant provider parsing. *)

val as_bool : t -> bool option
val as_float : t -> float option
val as_int : t -> int option
val as_list : t -> t list option
val as_object : t -> (string * t) list option

val to_string : t -> string
(** Encode a compact JSON string. This is used by tests and deterministic
    request-body fixtures; backend implementations may use native encoders for
    production IO. *)

val parse : string -> (t, string) result
(** Parse a JSON string. The parser is strict enough for provider responses and
    returns an error message instead of raising for malformed input. *)
