module Ast = Json_schema_ast
module Pointer = Json_schema_pointer
module Resolver = Json_schema_resolver
module Output = Json_schema_output
module Validator = Json_schema_validator
module Project = Json_schema_project

type t = Ast.t

let of_json = Ast.of_json
let of_string = Ast.of_string
let to_json = Ast.to_json
let to_string = Ast.to_string
let validate = Validator.validate
let validate_json = Validator.validate_json
