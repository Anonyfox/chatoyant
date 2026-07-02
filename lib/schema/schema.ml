type string_format =
  | Date_time
  | Date
  | Time
  | Duration
  | Email
  | Hostname
  | Ipv4
  | Ipv6
  | Uri
  | Uuid
  | Regex
  | Custom of string

type field =
  | String of string_options
  | Number of number_options
  | Integer of number_options
  | Boolean of boolean_options
  | Null of base_options
  | Array of array_options
  | Object of object_options
  | Enum of enum_options
  | Literal of literal_options

and base_options = { description : string option; optional : bool }

and string_options = {
  string_base : base_options;
  string_default : string option;
  min_length : int option;
  max_length : int option;
  pattern : string option;
  format : string_format option;
}

and number_options = {
  number_base : base_options;
  number_default : float option;
  minimum : float option;
  maximum : float option;
  exclusive_minimum : float option;
  exclusive_maximum : float option;
  multiple_of : float option;
}

and boolean_options = {
  boolean_base : base_options;
  boolean_default : bool option;
}

and array_options = {
  array_base : base_options;
  items : field;
  min_items : int option;
  max_items : int option;
  unique_items : bool option;
}

and object_options = {
  object_base : base_options;
  fields : (string * field) list;
}

and enum_options = {
  enum_base : base_options;
  values : Chatoyant_runtime.Json.t list;
  enum_default : Chatoyant_runtime.Json.t option;
}

and literal_options = {
  literal_base : base_options;
  value : Chatoyant_runtime.Json.t;
}

let base ?description ?(optional = false) () = { description; optional }

let string ?description ?optional ?default ?min_length ?max_length ?pattern
    ?format () =
  String
    {
      string_base = base ?description ?optional ();
      string_default = default;
      min_length;
      max_length;
      pattern;
      format;
    }

let number ?description ?optional ?default ?minimum ?maximum ?exclusive_minimum
    ?exclusive_maximum ?multiple_of () =
  Number
    {
      number_base = base ?description ?optional ();
      number_default = default;
      minimum;
      maximum;
      exclusive_minimum;
      exclusive_maximum;
      multiple_of;
    }

let integer ?description ?optional ?default ?minimum ?maximum () =
  let to_float = Option.map Float.of_int in
  Integer
    {
      number_base = base ?description ?optional ();
      number_default = to_float default;
      minimum = to_float minimum;
      maximum = to_float maximum;
      exclusive_minimum = None;
      exclusive_maximum = None;
      multiple_of = None;
    }

let boolean ?description ?optional ?default () =
  Boolean
    { boolean_base = base ?description ?optional (); boolean_default = default }

let null ?description ?optional () = Null (base ?description ?optional ())

let array ?description ?optional items =
  Array
    {
      array_base = base ?description ?optional ();
      items;
      min_items = None;
      max_items = None;
      unique_items = None;
    }

let object_ ?description ?optional fields =
  Object { object_base = base ?description ?optional (); fields }

let enum ?description ?optional values =
  Enum
    { enum_base = base ?description ?optional (); values; enum_default = None }

let literal ?description ?optional value =
  Literal { literal_base = base ?description ?optional (); value }

let with_base_description description base = { base with description }

let with_description description = function
  | String options ->
      String
        {
          options with
          string_base = with_base_description description options.string_base;
        }
  | Number options ->
      Number
        {
          options with
          number_base = with_base_description description options.number_base;
        }
  | Integer options ->
      Integer
        {
          options with
          number_base = with_base_description description options.number_base;
        }
  | Boolean options ->
      Boolean
        {
          options with
          boolean_base = with_base_description description options.boolean_base;
        }
  | Null base -> Null (with_base_description description base)
  | Array options ->
      Array
        {
          options with
          array_base = with_base_description description options.array_base;
        }
  | Object options ->
      Object
        {
          options with
          object_base = with_base_description description options.object_base;
        }
  | Enum options ->
      Enum
        {
          options with
          enum_base = with_base_description description options.enum_base;
        }
  | Literal options ->
      Literal
        {
          options with
          literal_base = with_base_description description options.literal_base;
        }

let with_array_constraints ?min_items ?max_items ?unique_items = function
  | Array options ->
      let keep previous next =
        match next with Some _ -> next | None -> previous
      in
      Array
        {
          options with
          min_items = keep options.min_items min_items;
          max_items = keep options.max_items max_items;
          unique_items = keep options.unique_items unique_items;
        }
  | field -> field

let with_string_constraints ?min_length ?max_length ?pattern = function
  | String options ->
      let keep previous next =
        match next with Some _ -> next | None -> previous
      in
      String
        {
          options with
          min_length = keep options.min_length min_length;
          max_length = keep options.max_length max_length;
          pattern = keep options.pattern pattern;
        }
  | field -> field

let with_number_constraints ?minimum ?maximum = function
  | Number options ->
      let keep previous next =
        match next with Some _ -> next | None -> previous
      in
      Number
        {
          options with
          minimum = keep options.minimum minimum;
          maximum = keep options.maximum maximum;
        }
  | Integer options ->
      let keep previous next =
        match next with Some _ -> next | None -> previous
      in
      Integer
        {
          options with
          minimum = keep options.minimum minimum;
          maximum = keep options.maximum maximum;
        }
  | field -> field

let string_of_format = function
  | Date_time -> "date-time"
  | Date -> "date"
  | Time -> "time"
  | Duration -> "duration"
  | Email -> "email"
  | Hostname -> "hostname"
  | Ipv4 -> "ipv4"
  | Ipv6 -> "ipv6"
  | Uri -> "uri"
  | Uuid -> "uuid"
  | Regex -> "regex"
  | Custom value -> value

let add_opt name encode value fields =
  match value with
  | None -> fields
  | Some value -> (name, encode value) :: fields

let add_base base fields =
  add_opt "description"
    (fun value -> Chatoyant_runtime.Json.String value)
    base.description fields

let number_fields options kind =
  [ ("type", Chatoyant_runtime.Json.String kind) ]
  |> add_base options.number_base
  |> add_opt "default"
       (fun value -> Chatoyant_runtime.Json.Float value)
       options.number_default
  |> add_opt "minimum"
       (fun value -> Chatoyant_runtime.Json.Float value)
       options.minimum
  |> add_opt "maximum"
       (fun value -> Chatoyant_runtime.Json.Float value)
       options.maximum
  |> add_opt "exclusiveMinimum"
       (fun value -> Chatoyant_runtime.Json.Float value)
       options.exclusive_minimum
  |> add_opt "exclusiveMaximum"
       (fun value -> Chatoyant_runtime.Json.Float value)
       options.exclusive_maximum
  |> add_opt "multipleOf"
       (fun value -> Chatoyant_runtime.Json.Float value)
       options.multiple_of

let rec to_property = function
  | String options ->
      [ ("type", Chatoyant_runtime.Json.String "string") ]
      |> add_base options.string_base
      |> add_opt "default"
           (fun value -> Chatoyant_runtime.Json.String value)
           options.string_default
      |> add_opt "minLength"
           (fun value -> Chatoyant_runtime.Json.Float (Float.of_int value))
           options.min_length
      |> add_opt "maxLength"
           (fun value -> Chatoyant_runtime.Json.Float (Float.of_int value))
           options.max_length
      |> add_opt "pattern"
           (fun value -> Chatoyant_runtime.Json.String value)
           options.pattern
      |> add_opt "format"
           (fun value -> Chatoyant_runtime.Json.String (string_of_format value))
           options.format
      |> List.rev
      |> fun fields -> Chatoyant_runtime.Json.Object fields
  | Number options ->
      Chatoyant_runtime.Json.Object (List.rev (number_fields options "number"))
  | Integer options ->
      Chatoyant_runtime.Json.Object (List.rev (number_fields options "integer"))
  | Boolean options ->
      [ ("type", Chatoyant_runtime.Json.String "boolean") ]
      |> add_base options.boolean_base
      |> add_opt "default"
           (fun value -> Chatoyant_runtime.Json.Bool value)
           options.boolean_default
      |> List.rev
      |> fun fields -> Chatoyant_runtime.Json.Object fields
  | Null base ->
      Chatoyant_runtime.Json.Object
        (List.rev
           (add_base base [ ("type", Chatoyant_runtime.Json.String "null") ]))
  | Array options ->
      [
        ("type", Chatoyant_runtime.Json.String "array");
        ("items", to_property options.items);
      ]
      |> add_base options.array_base
      |> add_opt "minItems"
           (fun value -> Chatoyant_runtime.Json.Float (Float.of_int value))
           options.min_items
      |> add_opt "maxItems"
           (fun value -> Chatoyant_runtime.Json.Float (Float.of_int value))
           options.max_items
      |> add_opt "uniqueItems"
           (fun value -> Chatoyant_runtime.Json.Bool value)
           options.unique_items
      |> List.rev
      |> fun fields -> Chatoyant_runtime.Json.Object fields
  | Object options ->
      let properties =
        options.fields
        |> List.map (fun (name, field) -> (name, to_nullable_property field))
        |> fun fields -> Chatoyant_runtime.Json.Object fields
      in
      let required =
        options.fields
        |> List.filter_map (fun (name, field) ->
            if is_optional field then None
            else Some (Chatoyant_runtime.Json.String name))
        |> fun fields -> Chatoyant_runtime.Json.Array fields
      in
      [
        ("type", Chatoyant_runtime.Json.String "object");
        ("properties", properties);
        ("required", required);
      ]
      |> add_base options.object_base
      |> List.rev
      |> fun fields -> Chatoyant_runtime.Json.Object fields
  | Enum options ->
      [ ("enum", Chatoyant_runtime.Json.Array options.values) ]
      |> add_base options.enum_base
      |> add_opt "default" (fun value -> value) options.enum_default
      |> List.rev
      |> fun fields -> Chatoyant_runtime.Json.Object fields
  | Literal options ->
      Chatoyant_runtime.Json.Object
        (List.rev (add_base options.literal_base [ ("const", options.value) ]))

and is_optional = function
  | String options -> options.string_base.optional
  | Number options -> options.number_base.optional
  | Integer options -> options.number_base.optional
  | Boolean options -> options.boolean_base.optional
  | Null base -> base.optional
  | Array options -> options.array_base.optional
  | Object options -> options.object_base.optional
  | Enum options -> options.enum_base.optional
  | Literal options -> options.literal_base.optional

and to_nullable_property field =
  let property = to_property field in
  if is_optional field then
    Chatoyant_runtime.Json.Object
      [
        ( "anyOf",
          Chatoyant_runtime.Json.Array
            [
              property;
              Chatoyant_runtime.Json.Object
                [ ("type", Chatoyant_runtime.Json.String "null") ];
            ] );
      ]
  else property

let to_json_schema field =
  match to_property field with
  | Chatoyant_runtime.Json.Object fields ->
      Chatoyant_runtime.Json.Object
        (( "$schema",
           Chatoyant_runtime.Json.String
             "https://json-schema.org/draft/2020-12/schema" )
        :: fields)
  | value -> value
