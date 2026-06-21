type t = Chatoyant_runtime.Json.t

type error = {
  path : string;
  expected : string;
  received : t option;
  message : string;
}

let error_to_string error =
  if error.path = "" then error.message else error.path ^ ": " ^ error.message

let of_json_schema_error (schema_error : Json_schema_output.error) =
  {
    path = schema_error.instance_path;
    expected = schema_error.keyword;
    received = None;
    message = Json_schema_output.error_to_string schema_error;
  }

let validate field value =
  match value with
  | Chatoyant_runtime.Json.Null when Schema.is_optional field -> Ok ()
  | _ ->
      let schema_json = Schema.to_json_schema field in
      match Json_schema_validator.validate_json schema_json value with
      | Error error ->
          Error
            {
              path = error.path;
              expected = "json schema";
              received = Some schema_json;
              message = error.message;
            }
      | Ok result when result.valid -> Ok ()
      | Ok { errors = error :: _; _ } -> Error (of_json_schema_error error)
      | Ok _ ->
          Error
            {
              path = "";
              expected = "valid";
              received = Some value;
              message = "invalid value";
            }

let validate_object fields value = validate (Schema.object_ fields) value
