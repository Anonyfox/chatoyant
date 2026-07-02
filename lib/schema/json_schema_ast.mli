(** Lossless JSON Schema AST.

    JSON Schema is itself a JSON language: a schema is either a boolean or an
    object. This module keeps that shape lossless while giving the rest of the
    implementation a typed boundary. Known vocabularies are interpreted by the
    validator; unknown keywords remain in the raw JSON object so parsers,
    printers, provider projections, and downstream tooling do not discard
    forward-compatible data. *)

type t = Bool of bool | Object of (string * Chatoyant_runtime.Json.t) list
type parse_error = { path : string; message : string }

val of_json : Chatoyant_runtime.Json.t -> (t, parse_error) result
val of_string : string -> (t, parse_error) result
val to_json : t -> Chatoyant_runtime.Json.t
val to_string : t -> string
val fields : t -> (string * Chatoyant_runtime.Json.t) list option
val field : string -> t -> Chatoyant_runtime.Json.t option
