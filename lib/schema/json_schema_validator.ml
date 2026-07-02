module Json = Chatoyant_runtime.Json
module Ast = Json_schema_ast
module Output = Json_schema_output
module Regex = Json_schema_regex
module Resolver = Json_schema_resolver

type options = { format_assertion : bool; resources : Resolver.resource list }

let default_options = { format_assertion = false; resources = [] }

type eval_result = {
  valid : bool;
  errors : Output.error list;
  evaluated_properties : string list;
  evaluated_items : int list;
}

type context = {
  options : options;
  resolver : Resolver.t;
  mutable ref_stack : (string * string) list;
  mutable validation_enabled : bool;
}

let draft202012_meta_schema = "https://json-schema.org/draft/2020-12/schema"

let validation_vocabulary =
  "https://json-schema.org/draft/2020-12/vocab/validation"

let empty =
  { valid = true; errors = []; evaluated_properties = []; evaluated_items = [] }

let fail ~instance_path ~schema_path ~keyword message =
  {
    empty with
    valid = false;
    errors = [ Output.error ~instance_path ~schema_path ~keyword ~message ];
  }

let uniq values =
  List.fold_left
    (fun acc value -> if List.mem value acc then acc else value :: acc)
    [] values
  |> List.rev

let merge results =
  {
    valid = List.for_all (fun result -> result.valid) results;
    errors = List.concat (List.map (fun result -> result.errors) results);
    evaluated_properties =
      results
      |> List.concat_map (fun result -> result.evaluated_properties)
      |> uniq;
    evaluated_items =
      results |> List.concat_map (fun result -> result.evaluated_items) |> uniq;
  }

let as_child_property name result =
  if result.valid then
    { result with evaluated_properties = [ name ]; evaluated_items = [] }
  else result

let as_child_item index result =
  if result.valid then
    { result with evaluated_properties = []; evaluated_items = [ index ] }
  else result

let append_dynamic_scope (ctx : context) base_uri
    (dynamic_scope : (string * Resolver.target) list) =
  Resolver.dynamic_anchors_for_resource ctx.resolver base_uri
  |> List.fold_left
       (fun (scope : (string * Resolver.target) list)
            (anchor, (target : Resolver.target)) ->
         if
           List.exists
             (fun (_, (existing : Resolver.target)) ->
               existing.Resolver.uri = target.Resolver.uri)
             scope
         then scope
         else scope @ [ (anchor, target) ])
       dynamic_scope

let json_field name = function
  | Json.Object fields -> List.assoc_opt name fields
  | _ -> None

let json_object = function Json.Object fields -> Some fields | _ -> None
let json_array = function Json.Array values -> Some values | _ -> None
let json_string = function Json.String value -> Some value | _ -> None
let json_float = function Json.Float value -> Some value | _ -> None

let json_int = function
  | Json.Float value when Float.is_integer value -> Some (Int.of_float value)
  | _ -> None

let json_bool = function Json.Bool value -> Some value | _ -> None

let vocabulary_validation_enabled ctx ~base_uri schema =
  match Option.bind (json_field "$schema" schema) json_string with
  | None -> ctx.validation_enabled
  | Some schema_uri -> (
      match Resolver.resolve ctx.resolver ~base_uri schema_uri with
      | None -> ctx.validation_enabled
      | Some target -> (
          match
            Option.bind (json_field "$vocabulary" target.schema) json_object
          with
          | None -> true
          | Some vocabularies -> (
              match
                Option.bind
                  (List.assoc_opt validation_vocabulary vocabularies)
                  json_bool
              with
              | Some true -> true
              | Some false | None -> false)))

let object_keys fields = List.map fst fields

let kind = function
  | Json.Null -> "null"
  | Bool _ -> "boolean"
  | Float value when Float.is_integer value -> "integer"
  | Float _ -> "number"
  | String _ -> "string"
  | Array _ -> "array"
  | Object _ -> "object"

let type_matches expected value =
  match (expected, value) with
  | "null", Json.Null -> true
  | "boolean", Json.Bool _ -> true
  | "object", Json.Object _ -> true
  | "array", Json.Array _ -> true
  | "number", Json.Float _ -> true
  | "integer", Json.Float value -> Float.is_integer value
  | "string", Json.String _ -> true
  | _ -> false

let rec json_equal left right =
  match (left, right) with
  | Json.Null, Json.Null -> true
  | Bool a, Bool b -> a = b
  | Float a, Float b -> Float.equal a b
  | String a, String b -> String.equal a b
  | Array a, Array b ->
      List.length a = List.length b && List.for_all2 json_equal a b
  | Object a, Object b ->
      let keys_a = object_keys a |> List.sort_uniq String.compare in
      let keys_b = object_keys b |> List.sort_uniq String.compare in
      keys_a = keys_b
      && List.for_all
           (fun key ->
             match (List.assoc_opt key a, List.assoc_opt key b) with
             | Some a, Some b -> json_equal a b
             | _ -> false)
           keys_a
  | _ -> false

let utf8_length value =
  let count = ref 0 in
  String.iter
    (fun ch -> if Char.code ch land 0xC0 <> 0x80 then incr count)
    value;
  !count

let pointer_append base token =
  let escaped =
    token |> String.split_on_char '~' |> String.concat "~0"
    |> String.split_on_char '/' |> String.concat "~1"
  in
  if base = "" then "/" ^ escaped else base ^ "/" ^ escaped

let schema_append base keyword = pointer_append base keyword
let index_path base index = pointer_append base (string_of_int index)

let multiple_of number divisor =
  if divisor = 0.0 then true
  else
    let quotient = number /. divisor in
    let nearest = Float.round quotient in
    Float.abs (quotient -. nearest) < 0.000000001

let schema_valued_keyword = function
  | "additionalProperties" | "unevaluatedProperties" | "propertyNames" | "items"
  | "contains" | "unevaluatedItems" | "not" | "if" | "then" | "else" ->
      true
  | _ -> false

let schema_array_keyword = function
  | "prefixItems" | "allOf" | "anyOf" | "oneOf" -> true
  | _ -> false

let schema_map_keyword = function
  | "$defs" | "definitions" | "properties" | "patternProperties"
  | "dependentSchemas" ->
      true
  | _ -> false

let valid_type_name = function
  | "null" | "boolean" | "object" | "array" | "number" | "string" | "integer" ->
      true
  | _ -> false

let non_negative_integer_keyword = function
  | "minLength" | "maxLength" | "minItems" | "maxItems" | "minProperties"
  | "maxProperties" | "minContains" | "maxContains" ->
      true
  | _ -> false

let rec validate_schema_document ~instance_path ~schema_path schema =
  match schema with
  | Json.Bool _ -> empty
  | Json.Object fields ->
      fields
      |> List.map (fun (name, value) ->
          let path = pointer_append instance_path name in
          if name = "type" then
            validate_type_keyword_shape ~instance_path:path ~schema_path value
          else if non_negative_integer_keyword name then
            validate_non_negative_integer_shape ~instance_path:path ~schema_path
              ~keyword:name value
          else if schema_valued_keyword name then
            validate_schema_document ~instance_path:path ~schema_path value
          else if schema_array_keyword name then
            validate_schema_array_shape ~instance_path:path ~schema_path value
          else if schema_map_keyword name then
            validate_schema_map_shape ~instance_path:path ~schema_path value
          else empty)
      |> merge
  | _ ->
      fail ~instance_path ~schema_path ~keyword:"$schema"
        "schema document must be a boolean or object"

and validate_type_keyword_shape ~instance_path ~schema_path = function
  | Json.String value when valid_type_name value -> empty
  | Json.Array values
    when values <> []
         && List.for_all
              (function
                | Json.String value -> valid_type_name value | _ -> false)
              values ->
      empty
  | _ ->
      fail ~instance_path ~schema_path ~keyword:"type"
        "type must be a valid JSON Schema primitive name or array of names"

and validate_non_negative_integer_shape ~instance_path ~schema_path ~keyword =
  function
  | Json.Float value when Float.is_integer value && value >= 0.0 -> empty
  | _ ->
      fail ~instance_path ~schema_path ~keyword
        (keyword ^ " must be a non-negative integer")

and validate_schema_array_shape ~instance_path ~schema_path = function
  | Json.Array values ->
      values
      |> List.mapi (fun index value ->
          validate_schema_document
            ~instance_path:(index_path instance_path index)
            ~schema_path value)
      |> merge
  | _ ->
      fail ~instance_path ~schema_path ~keyword:"schema-array"
        "keyword must contain an array of schemas"

and validate_schema_map_shape ~instance_path ~schema_path = function
  | Json.Object fields ->
      fields
      |> List.map (fun (name, value) ->
          validate_schema_document
            ~instance_path:(pointer_append instance_path name)
            ~schema_path value)
      |> merge
  | _ ->
      fail ~instance_path ~schema_path ~keyword:"schema-map"
        "keyword must contain an object whose values are schemas"

let rec validate_schema ctx ~base_uri ~schema_path ~instance_path ~dynamic_scope
    schema instance =
  match schema with
  | Json.Bool true -> empty
  | Json.Bool false ->
      fail ~instance_path ~schema_path ~keyword:"false" "boolean schema false"
  | Json.Object _ ->
      validate_object_schema ctx ~base_uri ~schema_path ~instance_path
        ~dynamic_scope schema instance
  | _ ->
      fail ~instance_path ~schema_path ~keyword:"schema"
        "schema position must contain a boolean or object"

and validate_object_schema ctx ~base_uri ~schema_path ~instance_path
    ~dynamic_scope schema instance =
  let base_uri = Resolver.child_base_uri ctx.resolver ~base_uri schema in
  let previous_validation_enabled = ctx.validation_enabled in
  ctx.validation_enabled <- vocabulary_validation_enabled ctx ~base_uri schema;
  let finish result =
    ctx.validation_enabled <- previous_validation_enabled;
    result
  in
  try
    let dynamic_scope = append_dynamic_scope ctx base_uri dynamic_scope in
    let ref_results =
      [
        validate_ref_keyword ctx ~base_uri ~schema_path ~instance_path
          ~dynamic_scope schema instance;
        validate_dynamic_ref_keyword ctx ~base_uri ~schema_path ~instance_path
          ~dynamic_scope schema instance;
      ]
      |> List.filter_map Fun.id
    in
    let assertion_results =
      (if ctx.validation_enabled then
         [
           validate_type ~schema_path ~instance_path schema instance;
           validate_enum ~schema_path ~instance_path schema instance;
           validate_const ~schema_path ~instance_path schema instance;
           validate_number ~schema_path ~instance_path schema instance;
           validate_string ~schema_path ~instance_path ctx.options schema
             instance;
         ]
       else [])
      @ [
          validate_object_keywords ctx ~base_uri ~schema_path ~instance_path
            ~dynamic_scope schema instance;
          validate_array_keywords ctx ~base_uri ~schema_path ~instance_path
            ~dynamic_scope schema instance;
          validate_dependent_keywords ctx ~base_uri ~schema_path ~instance_path
            ~dynamic_scope schema instance;
        ]
      |> List.filter_map Fun.id
    in
    let applicator_results =
      validate_applicators ctx ~base_uri ~schema_path ~instance_path
        ~dynamic_scope schema instance
    in
    let before_unevaluated =
      merge (ref_results @ assertion_results @ applicator_results)
    in
    let unevaluated_results =
      [
        validate_unevaluated_properties ctx ~base_uri ~schema_path
          ~instance_path ~dynamic_scope
          ~evaluated:before_unevaluated.evaluated_properties schema instance;
        validate_unevaluated_items ctx ~base_uri ~schema_path ~instance_path
          ~dynamic_scope ~evaluated:before_unevaluated.evaluated_items schema
          instance;
      ]
      |> List.filter_map Fun.id
    in
    finish
      (merge
         (ref_results @ assertion_results @ applicator_results
        @ unevaluated_results))
  with exn ->
    ctx.validation_enabled <- previous_validation_enabled;
    raise exn

and validate_ref_keyword ctx ~base_uri ~schema_path ~instance_path
    ~dynamic_scope schema instance =
  match Option.bind (json_field "$ref" schema) json_string with
  | None -> None
  | Some reference -> (
      match Resolver.resolve ctx.resolver ~base_uri reference with
      | None ->
          Some
            (fail ~instance_path
               ~schema_path:(schema_append schema_path "$ref")
               ~keyword:"$ref"
               ("unresolved reference " ^ reference))
      | Some target ->
          if target.uri = draft202012_meta_schema then
            Some
              (validate_schema_document ~instance_path ~schema_path:target.uri
                 instance)
          else
            let stack_key = (target.uri, instance_path) in
            if List.mem stack_key ctx.ref_stack then Some empty
            else (
              ctx.ref_stack <- stack_key :: ctx.ref_stack;
              let result =
                validate_schema ctx ~base_uri:target.base_uri
                  ~schema_path:target.uri ~instance_path ~dynamic_scope
                  target.schema instance
              in
              ctx.ref_stack <- List.tl ctx.ref_stack;
              Some result))

and validate_dynamic_ref_keyword ctx ~base_uri ~schema_path ~instance_path
    ~dynamic_scope schema instance =
  match Option.bind (json_field "$dynamicRef" schema) json_string with
  | None -> None
  | Some reference -> (
      match
        Resolver.resolve_dynamic ctx.resolver ~base_uri ~dynamic_scope reference
      with
      | None ->
          Some
            (fail ~instance_path
               ~schema_path:(schema_append schema_path "$dynamicRef")
               ~keyword:"$dynamicRef"
               ("unresolved dynamic reference " ^ reference))
      | Some target ->
          let stack_key = (target.uri, instance_path) in
          if List.mem stack_key ctx.ref_stack then Some empty
          else (
            ctx.ref_stack <- stack_key :: ctx.ref_stack;
            let result =
              validate_schema ctx ~base_uri:target.base_uri
                ~schema_path:target.uri ~instance_path ~dynamic_scope
                target.schema instance
            in
            ctx.ref_stack <- List.tl ctx.ref_stack;
            Some result))

and validate_type ~schema_path ~instance_path schema instance =
  match json_field "type" schema with
  | None -> None
  | Some (Json.String expected) ->
      if type_matches expected instance then Some empty
      else
        Some
          (fail ~instance_path
             ~schema_path:(schema_append schema_path "type")
             ~keyword:"type"
             ("expected " ^ expected ^ ", got " ^ kind instance))
  | Some (Json.Array values) ->
      let expected = List.filter_map json_string values in
      if List.exists (fun expected -> type_matches expected instance) expected
      then Some empty
      else
        Some
          (fail ~instance_path
             ~schema_path:(schema_append schema_path "type")
             ~keyword:"type"
             ("expected one of "
             ^ String.concat ", " expected
             ^ ", got " ^ kind instance))
  | Some _ -> None

and validate_enum ~schema_path ~instance_path schema instance =
  match Option.bind (json_field "enum" schema) json_array with
  | None -> None
  | Some values ->
      if List.exists (json_equal instance) values then Some empty
      else
        Some
          (fail ~instance_path
             ~schema_path:(schema_append schema_path "enum")
             ~keyword:"enum" "value is not one of the allowed enum members")

and validate_const ~schema_path ~instance_path schema instance =
  match json_field "const" schema with
  | None -> None
  | Some value ->
      if json_equal instance value then Some empty
      else
        Some
          (fail ~instance_path
             ~schema_path:(schema_append schema_path "const")
             ~keyword:"const" "value does not equal const")

and validate_number ~schema_path ~instance_path schema instance =
  match instance with
  | Json.Float number ->
      let checks =
        [
          ( "multipleOf",
            (fun divisor -> multiple_of number divisor),
            "number is not a multiple" );
          ( "maximum",
            (fun maximum -> number <= maximum),
            "number is greater than maximum" );
          ( "exclusiveMaximum",
            (fun maximum -> number < maximum),
            "number is not below exclusiveMaximum" );
          ( "minimum",
            (fun minimum -> number >= minimum),
            "number is less than minimum" );
          ( "exclusiveMinimum",
            (fun minimum -> number > minimum),
            "number is not above exclusiveMinimum" );
        ]
      in
      let results =
        List.filter_map
          (fun (keyword, predicate, message) ->
            match Option.bind (json_field keyword schema) json_float with
            | None -> None
            | Some bound ->
                if predicate bound then Some empty
                else
                  Some
                    (fail ~instance_path
                       ~schema_path:(schema_append schema_path keyword)
                       ~keyword message))
          checks
      in
      Some (merge results)
  | _ -> None

and validate_string ~schema_path ~instance_path options schema instance =
  match instance with
  | Json.String text ->
      let length = utf8_length text in
      let min_result =
        match Option.bind (json_field "minLength" schema) json_int with
        | Some minimum when length < minimum ->
            fail ~instance_path
              ~schema_path:(schema_append schema_path "minLength")
              ~keyword:"minLength" "string is shorter than minLength"
        | _ -> empty
      in
      let max_result =
        match Option.bind (json_field "maxLength" schema) json_int with
        | Some maximum when length > maximum ->
            fail ~instance_path
              ~schema_path:(schema_append schema_path "maxLength")
              ~keyword:"maxLength" "string is longer than maxLength"
        | _ -> empty
      in
      let pattern_result =
        match Option.bind (json_field "pattern" schema) json_string with
        | Some pattern when not (Regex.matches ~pattern text) ->
            fail ~instance_path
              ~schema_path:(schema_append schema_path "pattern")
              ~keyword:"pattern" "string does not match pattern"
        | _ -> empty
      in
      let format_result =
        if options.format_assertion then
          validate_format ~schema_path ~instance_path schema text
        else empty
      in
      Some (merge [ min_result; max_result; pattern_result; format_result ])
  | _ -> None

and validate_format ~schema_path ~instance_path schema text =
  match Option.bind (json_field "format" schema) json_string with
  | None -> empty
  | Some "email" ->
      if String.contains text '@' then empty
      else
        fail ~instance_path
          ~schema_path:(schema_append schema_path "format")
          ~keyword:"format" "invalid email format"
  | Some "uuid" ->
      if String.length text = 36 then empty
      else
        fail ~instance_path
          ~schema_path:(schema_append schema_path "format")
          ~keyword:"format" "invalid uuid format"
  | Some _ -> empty

and validate_object_keywords ctx ~base_uri ~schema_path ~instance_path
    ~dynamic_scope schema instance =
  match instance with
  | Json.Object fields ->
      let count = List.length fields in
      let min_result =
        match
          ( ctx.validation_enabled,
            Option.bind (json_field "minProperties" schema) json_int )
        with
        | true, Some minimum when count < minimum ->
            fail ~instance_path
              ~schema_path:(schema_append schema_path "minProperties")
              ~keyword:"minProperties" "object has too few properties"
        | _ -> empty
      in
      let max_result =
        match
          ( ctx.validation_enabled,
            Option.bind (json_field "maxProperties" schema) json_int )
        with
        | true, Some maximum when count > maximum ->
            fail ~instance_path
              ~schema_path:(schema_append schema_path "maxProperties")
              ~keyword:"maxProperties" "object has too many properties"
        | _ -> empty
      in
      let required_result =
        match
          ( ctx.validation_enabled,
            Option.bind (json_field "required" schema) json_array )
        with
        | false, _ -> empty
        | true, None -> empty
        | true, Some required ->
            required
            |> List.filter_map json_string
            |> List.map (fun name ->
                if List.mem_assoc name fields then empty
                else
                  fail ~instance_path
                    ~schema_path:(schema_append schema_path "required")
                    ~keyword:"required"
                    ("missing required property " ^ name))
            |> merge
      in
      let property_result, property_names =
        validate_properties ctx ~base_uri ~schema_path ~instance_path
          ~dynamic_scope schema fields
      in
      let pattern_result, pattern_names =
        validate_pattern_properties ctx ~base_uri ~schema_path ~instance_path
          ~dynamic_scope schema fields
      in
      let additional_result =
        validate_additional_properties ctx ~base_uri ~schema_path ~instance_path
          ~dynamic_scope schema fields
          ~covered:(uniq (property_names @ pattern_names))
      in
      let property_names_result =
        validate_property_names ctx ~base_uri ~schema_path ~instance_path
          ~dynamic_scope schema fields
      in
      Some
        (merge
           [
             min_result;
             max_result;
             required_result;
             property_result;
             pattern_result;
             additional_result;
             property_names_result;
           ])
  | _ -> None

and validate_properties ctx ~base_uri ~schema_path ~instance_path ~dynamic_scope
    schema fields =
  match Option.bind (json_field "properties" schema) json_object with
  | None -> (empty, [])
  | Some properties ->
      let results, names =
        List.fold_left
          (fun (results, names) (name, subschema) ->
            match List.assoc_opt name fields with
            | None -> (results, names)
            | Some value ->
                let result =
                  validate_schema ctx ~base_uri
                    ~schema_path:
                      (schema_append
                         (schema_append schema_path "properties")
                         name)
                    ~instance_path:(pointer_append instance_path name)
                    ~dynamic_scope subschema value
                  |> as_child_property name
                in
                (result :: results, name :: names))
          ([], []) properties
      in
      (merge (List.rev results), List.rev names)

and validate_pattern_properties ctx ~base_uri ~schema_path ~instance_path
    ~dynamic_scope schema fields =
  match Option.bind (json_field "patternProperties" schema) json_object with
  | None -> (empty, [])
  | Some patterns ->
      let results, names =
        List.fold_left
          (fun (results, names) (pattern, subschema) ->
            List.fold_left
              (fun (results, names) (name, value) ->
                if Regex.matches ~pattern name then
                  let result =
                    validate_schema ctx ~base_uri
                      ~schema_path:
                        (schema_append
                           (schema_append schema_path "patternProperties")
                           pattern)
                      ~instance_path:(pointer_append instance_path name)
                      ~dynamic_scope subschema value
                    |> as_child_property name
                  in
                  (result :: results, name :: names)
                else (results, names))
              (results, names) fields)
          ([], []) patterns
      in
      (merge (List.rev results), List.rev (uniq names))

and validate_additional_properties ctx ~base_uri ~schema_path ~instance_path
    ~dynamic_scope schema fields ~covered =
  match json_field "additionalProperties" schema with
  | None -> empty
  | Some subschema ->
      fields
      |> List.filter (fun (name, _) -> not (List.mem name covered))
      |> List.map (fun (name, value) ->
          validate_schema ctx ~base_uri
            ~schema_path:(schema_append schema_path "additionalProperties")
            ~instance_path:(pointer_append instance_path name)
            ~dynamic_scope subschema value
          |> as_child_property name)
      |> merge

and validate_property_names ctx ~base_uri ~schema_path ~instance_path
    ~dynamic_scope schema fields =
  match json_field "propertyNames" schema with
  | None -> empty
  | Some subschema ->
      fields
      |> List.map (fun (name, _) ->
          validate_schema ctx ~base_uri
            ~schema_path:(schema_append schema_path "propertyNames")
            ~instance_path:(pointer_append instance_path name)
            ~dynamic_scope subschema (Json.String name))
      |> merge

and validate_dependent_keywords ctx ~base_uri ~schema_path ~instance_path
    ~dynamic_scope schema instance =
  match instance with
  | Json.Object fields ->
      let dependent_required =
        match
          ( ctx.validation_enabled,
            Option.bind (json_field "dependentRequired" schema) json_object )
        with
        | false, _ -> empty
        | true, None -> empty
        | true, Some dependencies ->
            dependencies
            |> List.concat_map (fun (name, requirements) ->
                if not (List.mem_assoc name fields) then []
                else
                  match json_array requirements with
                  | None -> []
                  | Some required ->
                      required
                      |> List.filter_map json_string
                      |> List.map (fun required_name ->
                          if List.mem_assoc required_name fields then empty
                          else
                            fail ~instance_path
                              ~schema_path:
                                (schema_append schema_path "dependentRequired")
                              ~keyword:"dependentRequired"
                              (name ^ " requires property " ^ required_name)))
            |> merge
      in
      let dependent_schemas =
        match
          Option.bind (json_field "dependentSchemas" schema) json_object
        with
        | None -> empty
        | Some dependencies ->
            dependencies
            |> List.filter_map (fun (name, subschema) ->
                if List.mem_assoc name fields then
                  Some
                    (validate_schema ctx ~base_uri
                       ~schema_path:
                         (schema_append
                            (schema_append schema_path "dependentSchemas")
                            name)
                       ~instance_path ~dynamic_scope subschema instance)
                else None)
            |> merge
      in
      Some (merge [ dependent_required; dependent_schemas ])
  | _ -> None

and validate_array_keywords ctx ~base_uri ~schema_path ~instance_path
    ~dynamic_scope schema instance =
  match instance with
  | Json.Array values ->
      let length = List.length values in
      let min_result =
        match
          ( ctx.validation_enabled,
            Option.bind (json_field "minItems" schema) json_int )
        with
        | true, Some minimum when length < minimum ->
            fail ~instance_path
              ~schema_path:(schema_append schema_path "minItems")
              ~keyword:"minItems" "array has too few items"
        | _ -> empty
      in
      let max_result =
        match
          ( ctx.validation_enabled,
            Option.bind (json_field "maxItems" schema) json_int )
        with
        | true, Some maximum when length > maximum ->
            fail ~instance_path
              ~schema_path:(schema_append schema_path "maxItems")
              ~keyword:"maxItems" "array has too many items"
        | _ -> empty
      in
      let unique_result =
        match
          ( ctx.validation_enabled,
            Option.bind (json_field "uniqueItems" schema) json_bool )
        with
        | true, Some true when not (unique_items values) ->
            fail ~instance_path
              ~schema_path:(schema_append schema_path "uniqueItems")
              ~keyword:"uniqueItems" "array items are not unique"
        | _ -> empty
      in
      let prefix_result, prefix_count =
        validate_prefix_items ctx ~base_uri ~schema_path ~instance_path
          ~dynamic_scope schema values
      in
      let items_result =
        validate_items ctx ~base_uri ~schema_path ~instance_path ~dynamic_scope
          schema values ~prefix_count
      in
      let contains_result =
        validate_contains ctx ~base_uri ~schema_path ~instance_path
          ~dynamic_scope schema values
      in
      Some
        (merge
           [
             min_result;
             max_result;
             unique_result;
             prefix_result;
             items_result;
             contains_result;
           ])
  | _ -> None

and unique_items values =
  let rec loop = function
    | [] -> true
    | value :: rest -> (not (List.exists (json_equal value) rest)) && loop rest
  in
  loop values

and validate_prefix_items ctx ~base_uri ~schema_path ~instance_path
    ~dynamic_scope schema values =
  match Option.bind (json_field "prefixItems" schema) json_array with
  | None -> (empty, 0)
  | Some schemas ->
      let results =
        List.mapi
          (fun index subschema ->
            match List.nth_opt values index with
            | None -> empty
            | Some value ->
                validate_schema ctx ~base_uri
                  ~schema_path:
                    (index_path (schema_append schema_path "prefixItems") index)
                  ~instance_path:(index_path instance_path index)
                  ~dynamic_scope subschema value
                |> as_child_item index)
          schemas
      in
      (merge results, List.length schemas)

and validate_items ctx ~base_uri ~schema_path ~instance_path ~dynamic_scope
    schema values ~prefix_count =
  match json_field "items" schema with
  | None -> empty
  | Some subschema ->
      values
      |> List.mapi (fun index value -> (index, value))
      |> List.filter (fun (index, _) -> index >= prefix_count)
      |> List.map (fun (index, value) ->
          validate_schema ctx ~base_uri
            ~schema_path:(schema_append schema_path "items")
            ~instance_path:(index_path instance_path index)
            ~dynamic_scope subschema value
          |> as_child_item index)
      |> merge

and validate_contains ctx ~base_uri ~schema_path ~instance_path ~dynamic_scope
    schema values =
  match json_field "contains" schema with
  | None -> empty
  | Some subschema ->
      let matches =
        values
        |> List.mapi (fun index value ->
            let result =
              validate_schema ctx ~base_uri
                ~schema_path:(schema_append schema_path "contains")
                ~instance_path:(index_path instance_path index)
                ~dynamic_scope subschema value
            in
            (index, result))
        |> List.filter (fun (_, result) -> result.valid)
      in
      let count = List.length matches in
      let min_contains =
        if ctx.validation_enabled then
          match Option.bind (json_field "minContains" schema) json_int with
          | Some value -> value
          | None -> 1
        else 0
      in
      let min_result =
        if count < min_contains then
          fail ~instance_path
            ~schema_path:(schema_append schema_path "contains")
            ~keyword:"contains" "array does not contain enough matching items"
        else empty
      in
      let max_result =
        match
          ( ctx.validation_enabled,
            Option.bind (json_field "maxContains" schema) json_int )
        with
        | true, Some maximum when count > maximum ->
            fail ~instance_path
              ~schema_path:(schema_append schema_path "maxContains")
              ~keyword:"maxContains" "array contains too many matching items"
        | _ -> empty
      in
      let result = merge [ min_result; max_result ] in
      if result.valid then
        { result with evaluated_items = List.map fst matches }
      else result

and validate_applicators ctx ~base_uri ~schema_path ~instance_path
    ~dynamic_scope schema instance =
  let all_of =
    match Option.bind (json_field "allOf" schema) json_array with
    | None -> empty
    | Some schemas ->
        schemas
        |> List.mapi (fun index subschema ->
            validate_schema ctx ~base_uri
              ~schema_path:
                (index_path (schema_append schema_path "allOf") index)
              ~instance_path ~dynamic_scope subschema instance)
        |> merge
  in
  let any_of =
    match Option.bind (json_field "anyOf" schema) json_array with
    | None -> empty
    | Some schemas ->
        let results =
          schemas
          |> List.mapi (fun index subschema ->
              validate_schema ctx ~base_uri
                ~schema_path:
                  (index_path (schema_append schema_path "anyOf") index)
                ~instance_path ~dynamic_scope subschema instance)
        in
        let passing = List.filter (fun result -> result.valid) results in
        if passing = [] then
          fail ~instance_path
            ~schema_path:(schema_append schema_path "anyOf")
            ~keyword:"anyOf" "value does not match any subschema"
        else merge passing
  in
  let one_of =
    match Option.bind (json_field "oneOf" schema) json_array with
    | None -> empty
    | Some schemas ->
        let results =
          schemas
          |> List.mapi (fun index subschema ->
              validate_schema ctx ~base_uri
                ~schema_path:
                  (index_path (schema_append schema_path "oneOf") index)
                ~instance_path ~dynamic_scope subschema instance)
        in
        let passing = List.filter (fun result -> result.valid) results in
        if List.length passing = 1 then merge passing
        else
          fail ~instance_path
            ~schema_path:(schema_append schema_path "oneOf")
            ~keyword:"oneOf" "value must match exactly one subschema"
  in
  let not_ =
    match json_field "not" schema with
    | None -> empty
    | Some subschema ->
        let result =
          validate_schema ctx ~base_uri
            ~schema_path:(schema_append schema_path "not")
            ~instance_path ~dynamic_scope subschema instance
        in
        if result.valid then
          fail ~instance_path
            ~schema_path:(schema_append schema_path "not")
            ~keyword:"not" "value matched forbidden subschema"
        else empty
  in
  let conditional =
    match json_field "if" schema with
    | None -> empty
    | Some if_schema -> (
        let if_result =
          validate_schema ctx ~base_uri
            ~schema_path:(schema_append schema_path "if")
            ~instance_path ~dynamic_scope if_schema instance
        in
        if if_result.valid then
          match json_field "then" schema with
          | None -> if_result
          | Some then_schema ->
              merge
                [
                  if_result;
                  validate_schema ctx ~base_uri
                    ~schema_path:(schema_append schema_path "then")
                    ~instance_path ~dynamic_scope then_schema instance;
                ]
        else
          match json_field "else" schema with
          | None -> empty
          | Some else_schema ->
              validate_schema ctx ~base_uri
                ~schema_path:(schema_append schema_path "else")
                ~instance_path ~dynamic_scope else_schema instance)
  in
  [ all_of; any_of; one_of; not_; conditional ]

and validate_unevaluated_properties ctx ~base_uri ~schema_path ~instance_path
    ~dynamic_scope ~evaluated schema instance =
  match (json_field "unevaluatedProperties" schema, instance) with
  | None, _ -> None
  | Some subschema, Json.Object fields ->
      fields
      |> List.filter (fun (name, _) -> not (List.mem name evaluated))
      |> List.map (fun (name, value) ->
          validate_schema ctx ~base_uri
            ~schema_path:(schema_append schema_path "unevaluatedProperties")
            ~instance_path:(pointer_append instance_path name)
            ~dynamic_scope subschema value
          |> as_child_property name)
      |> merge
      |> fun result -> Some result
  | Some _, _ -> Some empty

and validate_unevaluated_items ctx ~base_uri ~schema_path ~instance_path
    ~dynamic_scope ~evaluated schema instance =
  match (json_field "unevaluatedItems" schema, instance) with
  | None, _ -> None
  | Some subschema, Json.Array values ->
      values
      |> List.mapi (fun index value -> (index, value))
      |> List.filter (fun (index, _) -> not (List.mem index evaluated))
      |> List.map (fun (index, value) ->
          validate_schema ctx ~base_uri
            ~schema_path:(schema_append schema_path "unevaluatedItems")
            ~instance_path:(index_path instance_path index)
            ~dynamic_scope subschema value
          |> as_child_item index)
      |> merge
      |> fun result -> Some result
  | Some _, _ -> Some empty

let validate ?(options = default_options) schema instance =
  let schema_json = Ast.to_json schema in
  let resolver = Resolver.create ~resources:options.resources schema_json in
  let ctx = { options; resolver; ref_stack = []; validation_enabled = true } in
  let result =
    validate_schema ctx
      ~base_uri:(Resolver.root_base_uri resolver)
      ~schema_path:"" ~instance_path:"" ~dynamic_scope:[] schema_json instance
  in
  { Output.valid = result.valid; errors = result.errors }

let validate_json ?options schema_json instance =
  match Ast.of_json schema_json with
  | Error _ as error -> error
  | Ok schema -> Ok (validate ?options schema instance)
