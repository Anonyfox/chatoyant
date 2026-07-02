(** Runtime values produced by schema parsing.

    Schema validation accepts JSON values and returns typed errors. Later
    ergonomic layers can expose typed records/functors, but this value layer is
    the stable provider-facing representation. *)

type t = Chatoyant_runtime.Json.t

type error = {
  path : string;
  expected : string;
  received : t option;
  message : string;
}

val validate : Schema.field -> t -> (unit, error) result
val validate_object : (string * Schema.field) list -> t -> (unit, error) result
val error_to_string : error -> string
