let parse_json text =
  match Chatoyant.Runtime.Json.parse text with
  | Ok json -> json
  | Error message -> failwith message

let parse_schema text =
  match Chatoyant.Schema.Json_schema.of_string text with
  | Ok schema -> schema
  | Error error -> failwith (error.path ^ ": " ^ error.message)

let validate ?options schema_text data_text =
  let schema = parse_schema schema_text in
  let data = parse_json data_text in
  Chatoyant.Schema.Json_schema.validate ?options schema data

let assert_valid ?options schema data =
  let result = validate ?options schema data in
  if not result.valid then
    failwith
      ("expected valid, got "
      ^ String.concat "; "
          (List.map Chatoyant.Schema.Json_schema.Output.error_to_string result.errors))

let assert_invalid ?options schema data =
  let result = validate ?options schema data in
  if result.valid then failwith "expected invalid JSON Schema result"

type search_args = {
  q : string;
  limit : int option;
}

type search_result = { count : int }

let test_typed_codecs_and_tools () =
  let module Codec = Chatoyant.Schema.Codec in
  let args_codec : search_args Codec.t =
    Codec.object2
      (Codec.field "q" (Codec.string ~description:"Search query." ()) ~get:(fun value -> value.q))
      (Codec.field "limit" (Codec.optional (Codec.int ())) ~get:(fun value -> value.limit))
      (fun q limit -> { q; limit })
  in
  let result_codec : search_result Codec.t =
    Codec.object1
      (Codec.field "count" (Codec.int ()) ~get:(fun value -> value.count))
      (fun count -> { count })
  in
  let schema_json = Codec.to_json_schema args_codec |> Chatoyant.Runtime.Json.to_string in
  if not (String.contains schema_json 'q') then failwith "codec schema missing field";
  let raw = parse_json {|{"q":"ocaml","limit":3}|} in
  (match Codec.decode args_codec raw with
  | Ok { q = "ocaml"; limit = Some 3 } -> ()
  | Ok _ -> failwith "unexpected codec decode value"
  | Error message -> failwith message);
  let tool =
    Chatoyant.Core.Tool.create_typed ~name:"search" ~description:"Search things"
      ~args:args_codec ~result:result_codec (fun _ args ->
        Ok { count = String.length args.q + Option.value args.limit ~default:0 })
  in
  let result =
    Chatoyant.Core.Tool.execute_call
      { model = "gpt-5.4-mini"; provider = Chatoyant.Provider.Provider.Openai }
      { id = "call_1"; name = "search"; arguments = raw }
      tool
  in
  if not result.ok then failwith "typed tool execution failed";
  match result.value with
  | Some (Chatoyant.Runtime.Json.Object fields) -> (
      match List.assoc_opt "count" fields with
      | Some (Chatoyant.Runtime.Json.Float value) when int_of_float value = 8 -> ()
      | _ -> failwith "typed tool encoded an unexpected result")
  | _ -> failwith "typed tool did not encode an object result"

let () =
  test_typed_codecs_and_tools ();
  assert_valid "true" "{\"anything\":1}";
  assert_invalid "false" "null";

  assert_valid
    {|{"type":["string","null"],"minLength":2}|}
    {|"ok"|};
  assert_valid
    {|{"type":["string","null"],"minLength":2}|}
    {|null|};
  assert_invalid
    {|{"type":["string","null"],"minLength":2}|}
    {|"x"|};

  assert_valid
    {|{
      "$schema":"https://json-schema.org/draft/2020-12/schema",
      "type":"object",
      "properties":{"name":{"type":"string"},"age":{"type":"integer","minimum":0}},
      "required":["name"],
      "additionalProperties":false
    }|}
    {|{"name":"Ada","age":36}|};
  assert_invalid
    {|{
      "type":"object",
      "properties":{"name":{"type":"string"}},
      "required":["name"],
      "additionalProperties":false
    }|}
    {|{"name":"Ada","extra":true}|};

  assert_valid
    {|{
      "allOf":[{"properties":{"a":{"type":"number"}}}],
      "properties":{"b":{"type":"string"}},
      "unevaluatedProperties":false
    }|}
    {|{"a":1,"b":"x"}|};
  assert_invalid
    {|{
      "allOf":[{"properties":{"a":{"type":"number"}}}],
      "properties":{"b":{"type":"string"}},
      "unevaluatedProperties":false
    }|}
    {|{"a":1,"b":"x","c":true}|};

  assert_valid
    {|{
      "prefixItems":[{"type":"string"}],
      "items":{"type":"integer"},
      "contains":{"minimum":10},
      "minContains":1,
      "unevaluatedItems":false
    }|}
    {|["head",1,12]|};
  assert_invalid
    {|{"prefixItems":[{"type":"string"}],"unevaluatedItems":false}|}
    {|["head",1]|};

  assert_valid
    {|{
      "$defs":{"positive":{"type":"integer","minimum":1}},
      "properties":{"count":{"$ref":"#/$defs/positive","maximum":10}},
      "required":["count"]
    }|}
    {|{"count":4}|};
  assert_invalid
    {|{
      "$defs":{"positive":{"type":"integer","minimum":1}},
      "properties":{"count":{"$ref":"#/$defs/positive","maximum":10}},
      "required":["count"]
    }|}
    {|{"count":0}|};

  assert_valid
    {|{
      "$ref":"#word",
      "$defs":{"w":{"$anchor":"word","type":"string","pattern":"^a+$"}}
    }|}
    {|"aaa"|};
  assert_invalid
    {|{
      "$ref":"#word",
      "$defs":{"w":{"$anchor":"word","type":"string","pattern":"^a+$"}}
    }|}
    {|"aba"|};

  assert_valid
    {|{
      "type":"object",
      "patternProperties":{"^foo":{"type":"string"},"[0-9]{2,}":{"type":"boolean"}},
      "additionalProperties":false
    }|}
    {|{"fooName":"ok","id99":true}|};
  assert_invalid
    {|{
      "type":"object",
      "patternProperties":{"^foo":{"type":"string"},"[0-9]{2,}":{"type":"boolean"}},
      "additionalProperties":false
    }|}
    {|{"fooName":"ok","id99":"nope"}|};

  assert_valid
    {|{
      "if":{"properties":{"kind":{"const":"a"}},"required":["kind"]},
      "then":{"required":["a"]},
      "else":{"required":["b"]}
    }|}
    {|{"kind":"a","a":true}|};
  assert_invalid
    {|{
      "if":{"properties":{"kind":{"const":"a"}},"required":["kind"]},
      "then":{"required":["a"]},
      "else":{"required":["b"]}
    }|}
    {|{"kind":"a","b":true}|};

  assert_valid
    {|{
      "dependentRequired":{"credit_card":["billing_address"]},
      "dependentSchemas":{"country":{"properties":{"postal_code":{"type":"string"}}}}
    }|}
    {|{"credit_card":1,"billing_address":"x","country":"DE","postal_code":"10115"}|};
  assert_invalid
    {|{"dependentRequired":{"credit_card":["billing_address"]}}|}
    {|{"credit_card":1}|};

  let schema =
    parse_schema
      {|{"type":"object","properties":{"q":{"type":"string"},"limit":{"type":"integer"}}}|}
  in
  let projected = Chatoyant.Schema.Json_schema.Project.openai_strict schema in
  let projected_json =
    Chatoyant.Schema.Json_schema.to_json projected.schema
    |> Chatoyant.Runtime.Json.to_string
  in
  if not (String.contains projected_json 'f') then failwith "projection did not encode";
  assert_valid projected_json {|{"q":"x","limit":1}|};
  assert_invalid projected_json {|{"q":"x"}|};
  assert_invalid projected_json {|{"q":"x","extra":1}|}

let () =
  let external_options =
    Chatoyant.Schema.Json_schema.Validator.
      {
        default_options with
        resources =
          [
            Chatoyant.Schema.Json_schema.Resolver.
              {
                uri = "http://example.com/integer.json";
                schema = parse_json {|{"type":"integer"}|};
              };
          ];
      }
  in
  assert_valid ~options:external_options
    {|{"$ref":"http://example.com/integer.json"}|}
    {|1|};
  assert_invalid ~options:external_options
    {|{"$ref":"http://example.com/integer.json"}|}
    {|"x"|};

  let base_uri_options =
    Chatoyant.Schema.Json_schema.Validator.
      {
        default_options with
        resources =
          [
            Chatoyant.Schema.Json_schema.Resolver.
              {
                uri = "http://example.com/root/folder/integer.json";
                schema = parse_json {|{"type":"integer"}|};
              };
          ];
      }
  in
  assert_valid ~options:base_uri_options
    {|{
      "$id":"http://example.com/root/",
      "items":{"$id":"folder/","items":{"$ref":"integer.json"}}
    }|}
    {|[[1]]|};

  assert_invalid ~options:base_uri_options
    {|{
      "$id":"http://example.com/root/",
      "items":{"$id":"folder/","items":{"$ref":"integer.json"}}
    }|}
    {|[["x"]]|};

  assert_valid
    {|{
      "$id":"https://test.example/dynamic/root",
      "$ref":"list",
      "$defs":{
        "override":{"$dynamicAnchor":"items","type":"string"},
        "list":{
          "$id":"list",
          "type":"array",
          "items":{"$dynamicRef":"#items"},
          "$defs":{"items":{"$dynamicAnchor":"items"}}
        }
      }
    }|}
    {|["a"]|};
  assert_invalid
    {|{
      "$id":"https://test.example/dynamic/root",
      "$ref":"list",
      "$defs":{
        "override":{"$dynamicAnchor":"items","type":"string"},
        "list":{
          "$id":"list",
          "type":"array",
          "items":{"$dynamicRef":"#items"},
          "$defs":{"items":{"$dynamicAnchor":"items"}}
        }
      }
    }|}
    {|[1]|};

  let no_validation_options =
    Chatoyant.Schema.Json_schema.Validator.
      {
        default_options with
        resources =
          [
            Chatoyant.Schema.Json_schema.Resolver.
              {
                uri = "http://example.com/meta/no-validation";
                schema =
                  parse_json
                    {|{
                      "$id":"http://example.com/meta/no-validation",
                      "$vocabulary":{
                        "https://json-schema.org/draft/2020-12/vocab/core":true,
                        "https://json-schema.org/draft/2020-12/vocab/applicator":true
                      }
                    }|};
              };
          ];
      }
  in
  assert_valid ~options:no_validation_options
    {|{
      "$schema":"http://example.com/meta/no-validation",
      "properties":{"numberProperty":{"minimum":10}}
    }|}
    {|{"numberProperty":1}|};
  assert_invalid ~options:no_validation_options
    {|{
      "$schema":"http://example.com/meta/no-validation",
      "properties":{"badProperty":false}
    }|}
    {|{"badProperty":"nope"}|}
