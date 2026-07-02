module Json = Chatoyant_runtime.Json

type error = {
  instance_path : string;
  schema_path : string;
  keyword : string;
  message : string;
}

type t = { valid : bool; errors : error list }

let valid = { valid = true; errors = [] }
let invalid error = { valid = false; errors = [ error ] }

let error ~instance_path ~schema_path ~keyword ~message =
  { instance_path; schema_path; keyword; message }

let error_to_string error =
  let where = if error.instance_path = "" then "/" else error.instance_path in
  where ^ " " ^ error.keyword ^ ": " ^ error.message

let error_to_json error =
  Json.Object
    [
      ("instancePath", Json.String error.instance_path);
      ("schemaPath", Json.String error.schema_path);
      ("keyword", Json.String error.keyword);
      ("message", Json.String error.message);
    ]

let to_json result =
  Json.Object
    [
      ("valid", Json.Bool result.valid);
      ("errors", Json.Array (List.map error_to_json result.errors));
    ]
