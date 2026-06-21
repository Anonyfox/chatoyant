module Json = Chatoyant_runtime.Json

type t =
  | Bool of bool
  | Object of (string * Json.t) list

type parse_error = {
  path : string;
  message : string;
}

let of_json = function
  | Json.Bool value -> Ok (Bool value)
  | Json.Object fields -> Ok (Object fields)
  | _ -> Error { path = ""; message = "JSON Schema must be a boolean or object" }

let of_string source =
  match Json.parse source with
  | Error message -> Error { path = ""; message }
  | Ok json -> of_json json

let to_json = function
  | Bool value -> Json.Bool value
  | Object fields -> Json.Object fields

let to_string schema = schema |> to_json |> Json.to_string

let fields = function
  | Bool _ -> None
  | Object fields -> Some fields

let field name = function
  | Bool _ -> None
  | Object fields -> List.assoc_opt name fields
