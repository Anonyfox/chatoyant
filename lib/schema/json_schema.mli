(** Standalone JSON Schema implementation.

    The initial dialect target is draft 2020-12. The module is structured as a
    standalone package surface so Chatoyant tool/structured-output code can use
    it without depending on provider modules. *)

module Ast = Json_schema_ast
module Pointer = Json_schema_pointer
module Resolver = Json_schema_resolver
module Output = Json_schema_output
module Validator = Json_schema_validator
module Project = Json_schema_project

type t = Ast.t

val of_json : Chatoyant_runtime.Json.t -> (t, Ast.parse_error) result
val of_string : string -> (t, Ast.parse_error) result
val to_json : t -> Chatoyant_runtime.Json.t
val to_string : t -> string

val validate :
  ?options:Validator.options -> t -> Chatoyant_runtime.Json.t -> Output.t

val validate_json :
  ?options:Validator.options ->
  Chatoyant_runtime.Json.t ->
  Chatoyant_runtime.Json.t ->
  (Output.t, Ast.parse_error) result
