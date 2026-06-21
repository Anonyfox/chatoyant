type context = {
  model : string;
  provider : Chatoyant_provider.Provider.id;
}

type call = {
  id : string;
  name : string;
  arguments : Chatoyant_runtime.Json.t;
}

type result = {
  id : string;
  ok : bool;
  value : Chatoyant_runtime.Json.t option;
  error : string option;
}

type t = {
  tool_name : string;
  tool_description : string;
  tool_parameters : Chatoyant_schema.Schema.field;
  tool_result_schema : Chatoyant_schema.Schema.field option;
  execute :
    context -> Chatoyant_runtime.Json.t -> (Chatoyant_runtime.Json.t, string) Stdlib.result;
}

let create ~name ~description ~parameters ?result_schema execute =
  { tool_name = name; tool_description = description; tool_parameters = parameters; tool_result_schema = result_schema; execute }

let create_typed ~name ~description ~args ~result execute =
  create ~name ~description ~parameters:(Chatoyant_schema.Codec.schema args)
    ~result_schema:(Chatoyant_schema.Codec.schema result)
    (fun context json ->
      match Chatoyant_schema.Codec.decode args json with
      | Error message -> Error message
      | Ok args -> (
          match execute context args with
          | Error _ as err -> err
          | Ok value -> Ok (Chatoyant_schema.Codec.encode result value)))

let name tool = tool.tool_name
let description tool = tool.tool_description
let parameters tool = tool.tool_parameters
let json_schema tool = Chatoyant_schema.Schema.to_json_schema tool.tool_parameters

let to_provider_definition (tool : t) : Chatoyant_provider.Provider.tool_definition =
  {
    Chatoyant_provider.Provider.tool_name = tool.tool_name;
    tool_description = Some tool.tool_description;
    tool_parameters = json_schema tool;
    tool_strict = Some true;
  }

let failure id message = { id; ok = false; value = None; error = Some message }
let success id value = { id; ok = true; value = Some value; error = None }

let execute_call context call tool =
  if call.name <> tool.tool_name then failure call.id ("Unknown tool: " ^ call.name)
  else
    match Chatoyant_schema.Value.validate tool.tool_parameters call.arguments with
    | Error error -> failure call.id (Chatoyant_schema.Value.error_to_string error)
    | Ok () -> (
        match tool.execute context call.arguments with
        | Error message -> failure call.id message
        | Ok value -> (
            match tool.tool_result_schema with
            | None -> success call.id value
            | Some schema -> (
                match Chatoyant_schema.Value.validate schema value with
                | Ok () -> success call.id value
                | Error error -> failure call.id (Chatoyant_schema.Value.error_to_string error))))

let string value = Chatoyant_runtime.Json.String value

let add_opt name value fields =
  match value with
  | None -> fields
  | Some value -> (name, value) :: fields

let call_to_json (call : call) =
  Chatoyant_runtime.Json.Object
    [
      ("id", string call.id);
      ("name", string call.name);
      ("arguments", call.arguments);
    ]

let result_to_json (result : result) =
  [
    ("id", string result.id);
    ("ok", Chatoyant_runtime.Json.Bool result.ok);
  ]
  |> add_opt "value" result.value
  |> add_opt "error" (Option.map string result.error)
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

module Args = struct
  let ( let* ) result fn = Stdlib.Result.bind result fn

  let field name json =
    match Chatoyant_runtime.Json.field name json with
    | Some value -> Ok value
    | None -> Error ("missing field: " ^ name)

  let type_error name expected =
    Error ("expected field " ^ name ^ " to be " ^ expected)

  let string name json =
    let* value = field name json in
    match Chatoyant_runtime.Json.as_string value with
    | Some value -> Ok value
    | None -> type_error name "a string"

  let float name json =
    let* value = field name json in
    match Chatoyant_runtime.Json.as_float value with
    | Some value -> Ok value
    | None -> type_error name "a number"

  let int name json =
    let* value = field name json in
    match Chatoyant_runtime.Json.as_int value with
    | Some value -> Ok value
    | None -> type_error name "an integer"

  let bool name json =
    let* value = field name json in
    match Chatoyant_runtime.Json.as_bool value with
    | Some value -> Ok value
    | None -> type_error name "a boolean"

  let object_ name json =
    let* value = field name json in
    match Chatoyant_runtime.Json.as_object value with
    | Some value -> Ok value
    | None -> type_error name "an object"

  let list name json =
    let* value = field name json in
    match Chatoyant_runtime.Json.as_list value with
    | Some value -> Ok value
    | None -> type_error name "an array"

  let optional decode name json =
    match Chatoyant_runtime.Json.field name json with
    | None | Some Chatoyant_runtime.Json.Null -> Ok None
    | Some _ -> Stdlib.Result.map Option.some (decode name json)
end

module Json = struct
  let null = Chatoyant_runtime.Json.Null
  let string value = Chatoyant_runtime.Json.String value
  let float value = Chatoyant_runtime.Json.Float value
  let int value = Chatoyant_runtime.Json.Float (Float.of_int value)
  let bool value = Chatoyant_runtime.Json.Bool value
  let object_ fields = Chatoyant_runtime.Json.Object fields
  let array values = Chatoyant_runtime.Json.Array values
end
