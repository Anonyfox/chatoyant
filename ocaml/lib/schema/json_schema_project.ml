module Json = Chatoyant_runtime.Json
module Ast = Json_schema_ast

type warning = {
  path : string;
  message : string;
}

type result = {
  schema : Ast.t;
  warnings : warning list;
}

let identity schema = { schema; warnings = [] }

let has_field name fields = List.mem_assoc name fields

let replace_field name value fields =
  List.map (fun (field_name, field_value) -> if field_name = name then (field_name, value) else (field_name, field_value)) fields

let property_names fields =
  match List.assoc_opt "properties" fields with
  | Some (Json.Object properties) -> List.map fst properties
  | _ -> []

let required_names fields =
  match List.assoc_opt "required" fields with
  | Some (Json.Array values) ->
      List.filter_map
        (function
          | Json.String name -> Some name
          | _ -> None)
        values
  | _ -> []

let add_required_properties fields =
  let properties = property_names fields in
  if properties = [] then fields
  else
    let existing = required_names fields in
    let merged =
      existing
      @ List.filter (fun name -> not (List.mem name existing)) properties
    in
    let required = Json.Array (List.map (fun name -> Json.String name) merged) in
    if has_field "required" fields then replace_field "required" required fields
    else fields @ [ ("required", required) ]

let rec project_json path json =
  match json with
  | Json.Object fields ->
      let fields =
        fields
        |> List.map (fun (name, value) -> (name, project_child path name value))
      in
      let fields =
        if has_field "properties" fields && not (has_field "additionalProperties" fields)
        then fields @ [ ("additionalProperties", Json.Bool false) ]
        else fields
      in
      let fields =
        if has_field "properties" fields then add_required_properties fields
        else fields
      in
      Json.Object fields
  | Json.Array values -> Json.Array (List.mapi (fun index -> project_json (path ^ "/" ^ string_of_int index)) values)
  | value -> value

and project_child path name value =
  match name with
  | "$defs" | "definitions" | "properties" | "patternProperties" | "dependentSchemas" -> (
      match value with
      | Json.Object fields ->
          Json.Object
            (List.map
               (fun (name, schema) -> (name, project_json (path ^ "/" ^ name) schema))
               fields)
      | _ -> value)
  | "prefixItems" | "allOf" | "anyOf" | "oneOf" -> (
      match value with
      | Json.Array values ->
          Json.Array
            (List.mapi
               (fun index schema -> project_json (path ^ "/" ^ name ^ "/" ^ string_of_int index) schema)
               values)
      | _ -> value)
  | "items" | "contains" | "additionalProperties" | "unevaluatedProperties"
  | "unevaluatedItems" | "propertyNames" | "not" | "if" | "then" | "else" ->
      project_json (path ^ "/" ^ name) value
  | _ -> value

let openai_strict schema =
  let projected = schema |> Ast.to_json |> project_json "" in
  match Ast.of_json projected with
  | Ok schema -> { schema; warnings = [] }
  | Error error ->
      {
        schema;
        warnings =
          [
            {
              path = error.path;
              message = "projection produced invalid schema: " ^ error.message;
            };
          ];
      }
