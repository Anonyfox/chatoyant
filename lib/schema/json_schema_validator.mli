(** Draft 2020-12 validation engine.

    The validator implements assertion keywords and tracks evaluated object
    properties/array items for the unevaluated vocabulary. Format is treated as
    an annotation by default, matching draft 2020-12 unless the caller opts into
    format assertions. *)

type options = {
  format_assertion : bool;
  resources : Json_schema_resolver.resource list;
}

val default_options : options

val validate :
  ?options:options ->
  Json_schema_ast.t ->
  Chatoyant_runtime.Json.t ->
  Json_schema_output.t

val validate_json :
  ?options:options ->
  Chatoyant_runtime.Json.t ->
  Chatoyant_runtime.Json.t ->
  (Json_schema_output.t, Json_schema_ast.parse_error) result
