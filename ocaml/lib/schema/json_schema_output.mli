(** Structured validation output.

    The public result is intentionally compact but keeps JSON Pointer paths and
    failing keyword names so provider errors, test failures, and downstream
    diagnostics can be rendered deterministically. *)

type error = {
  instance_path : string;
  schema_path : string;
  keyword : string;
  message : string;
}

type t = {
  valid : bool;
  errors : error list;
}

val valid : t
val invalid : error -> t
val error :
  instance_path:string ->
  schema_path:string ->
  keyword:string ->
  message:string ->
  error
val to_json : t -> Chatoyant_runtime.Json.t
val error_to_string : error -> string
