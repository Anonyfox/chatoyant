type 'a t = {
  schema : Schema.field;
  encode : 'a -> Chatoyant_runtime.Json.t;
  decode : Chatoyant_runtime.Json.t -> ('a, string) result;
  missing : (unit -> ('a, string) result) option;
}

type ('record, 'value) field = {
  name : string;
  codec : 'value t;
  get : 'record -> 'value;
}

let schema codec = codec.schema
let custom ~schema ~encode ~decode = { schema; encode; decode; missing = None }
let map_schema map codec = { codec with schema = map codec.schema }
let to_json_schema codec = Schema.to_json_schema codec.schema
let encode codec value = codec.encode value
let decode codec json = codec.decode json
let ok value = Ok value

let json ?description () =
  {
    schema = Schema.object_ ?description [];
    encode = Fun.id;
    decode = ok;
    missing = None;
  }

let string ?description () =
  {
    schema = Schema.string ?description ();
    encode = (fun value -> Chatoyant_runtime.Json.String value);
    decode =
      (function
      | Chatoyant_runtime.Json.String value -> Ok value
      | _ -> Error "expected string");
    missing = None;
  }

let float ?description () =
  {
    schema = Schema.number ?description ();
    encode = (fun value -> Chatoyant_runtime.Json.Float value);
    decode =
      (function
      | Chatoyant_runtime.Json.Float value -> Ok value
      | _ -> Error "expected number");
    missing = None;
  }

let int ?description () =
  {
    schema = Schema.integer ?description ();
    encode = (fun value -> Chatoyant_runtime.Json.Float (Float.of_int value));
    decode =
      (fun json ->
        match Chatoyant_runtime.Json.as_int json with
        | Some value -> Ok value
        | None -> Error "expected integer");
    missing = None;
  }

let bool ?description () =
  {
    schema = Schema.boolean ?description ();
    encode = (fun value -> Chatoyant_runtime.Json.Bool value);
    decode =
      (function
      | Chatoyant_runtime.Json.Bool value -> Ok value
      | _ -> Error "expected boolean");
    missing = None;
  }

let string_enum ?description values =
  let json_values =
    List.map (fun value -> Chatoyant_runtime.Json.String value) values
  in
  {
    schema = Schema.enum ?description json_values;
    encode = (fun value -> Chatoyant_runtime.Json.String value);
    decode =
      (function
      | Chatoyant_runtime.Json.String value when List.mem value values ->
          Ok value
      | Chatoyant_runtime.Json.String value ->
          Error ("unexpected enum value: " ^ value)
      | _ -> Error "expected enum string");
    missing = None;
  }

let array ?description item =
  {
    schema = Schema.array ?description item.schema;
    encode =
      (fun values -> Chatoyant_runtime.Json.Array (List.map item.encode values));
    decode =
      (function
      | Chatoyant_runtime.Json.Array values ->
          let rec loop acc = function
            | [] -> Ok (List.rev acc)
            | value :: rest -> (
                match item.decode value with
                | Ok decoded -> loop (decoded :: acc) rest
                | Error message -> Error message)
          in
          loop [] values
      | _ -> Error "expected array");
    missing = None;
  }

let set_base_optional optional base = { base with Schema.optional }

let with_optional = function
  | Schema.String options ->
      Schema.String
        {
          options with
          string_base = set_base_optional true options.string_base;
        }
  | Schema.Number options ->
      Schema.Number
        {
          options with
          number_base = set_base_optional true options.number_base;
        }
  | Schema.Integer options ->
      Schema.Integer
        {
          options with
          number_base = set_base_optional true options.number_base;
        }
  | Schema.Boolean options ->
      Schema.Boolean
        {
          options with
          boolean_base = set_base_optional true options.boolean_base;
        }
  | Schema.Null base -> Schema.Null (set_base_optional true base)
  | Schema.Array options ->
      Schema.Array
        { options with array_base = set_base_optional true options.array_base }
  | Schema.Object options ->
      Schema.Object
        {
          options with
          object_base = set_base_optional true options.object_base;
        }
  | Schema.Enum options ->
      Schema.Enum
        { options with enum_base = set_base_optional true options.enum_base }
  | Schema.Literal options ->
      Schema.Literal
        {
          options with
          literal_base = set_base_optional true options.literal_base;
        }

let optional codec =
  {
    schema = with_optional codec.schema;
    encode =
      (function
      | None -> Chatoyant_runtime.Json.Null
      | Some value -> codec.encode value);
    decode =
      (function
      | Chatoyant_runtime.Json.Null -> Ok None
      | json -> Result.map Option.some (codec.decode json));
    missing = Some (fun () -> Ok None);
  }

let field name codec ~get = { name; codec; get }

let decode_field name codec json =
  match Chatoyant_runtime.Json.field name json with
  | None -> (
      match codec.missing with
      | Some missing -> missing ()
      | None -> Error ("missing field: " ^ name))
  | Some value -> (
      match codec.decode value with
      | Ok _ as ok -> ok
      | Error message -> Error (name ^ ": " ^ message))

let decode_record_field json field = decode_field field.name field.codec json

let encode_field record field =
  (field.name, field.codec.encode (field.get record))

let schema_field field = (field.name, field.codec.schema)

let object1 ?description f1 make =
  {
    schema = Schema.object_ ?description [ schema_field f1 ];
    encode =
      (fun record -> Chatoyant_runtime.Json.Object [ encode_field record f1 ]);
    decode = (fun json -> Result.map make (decode_record_field json f1));
    missing = None;
  }

let object2 ?description f1 f2 make =
  {
    schema = Schema.object_ ?description [ schema_field f1; schema_field f2 ];
    encode =
      (fun record ->
        Chatoyant_runtime.Json.Object
          [ encode_field record f1; encode_field record f2 ]);
    decode =
      (fun json ->
        let ( let* ) = Result.bind in
        let* v1 = decode_record_field json f1 in
        let* v2 = decode_record_field json f2 in
        Ok (make v1 v2));
    missing = None;
  }

let object3 ?description f1 f2 f3 make =
  {
    schema =
      Schema.object_ ?description
        [ schema_field f1; schema_field f2; schema_field f3 ];
    encode =
      (fun record ->
        Chatoyant_runtime.Json.Object
          [
            encode_field record f1;
            encode_field record f2;
            encode_field record f3;
          ]);
    decode =
      (fun json ->
        let ( let* ) = Result.bind in
        let* v1 = decode_record_field json f1 in
        let* v2 = decode_record_field json f2 in
        let* v3 = decode_record_field json f3 in
        Ok (make v1 v2 v3));
    missing = None;
  }

let object4 ?description f1 f2 f3 f4 make =
  {
    schema =
      Schema.object_ ?description
        [ schema_field f1; schema_field f2; schema_field f3; schema_field f4 ];
    encode =
      (fun record ->
        Chatoyant_runtime.Json.Object
          [
            encode_field record f1;
            encode_field record f2;
            encode_field record f3;
            encode_field record f4;
          ]);
    decode =
      (fun json ->
        let ( let* ) = Result.bind in
        let* v1 = decode_record_field json f1 in
        let* v2 = decode_record_field json f2 in
        let* v3 = decode_record_field json f3 in
        let* v4 = decode_record_field json f4 in
        Ok (make v1 v2 v3 v4));
    missing = None;
  }

let object5 ?description f1 f2 f3 f4 f5 make =
  {
    schema =
      Schema.object_ ?description
        [
          schema_field f1;
          schema_field f2;
          schema_field f3;
          schema_field f4;
          schema_field f5;
        ];
    encode =
      (fun record ->
        Chatoyant_runtime.Json.Object
          [
            encode_field record f1;
            encode_field record f2;
            encode_field record f3;
            encode_field record f4;
            encode_field record f5;
          ]);
    decode =
      (fun json ->
        let ( let* ) = Result.bind in
        let* v1 = decode_record_field json f1 in
        let* v2 = decode_record_field json f2 in
        let* v3 = decode_record_field json f3 in
        let* v4 = decode_record_field json f4 in
        let* v5 = decode_record_field json f5 in
        Ok (make v1 v2 v3 v4 v5));
    missing = None;
  }
