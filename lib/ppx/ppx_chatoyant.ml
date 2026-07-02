open Ppxlib
module B = Ast_builder.Default
module String_map = Map.Make (String)

type metadata = {
  description : string option;
  min_items : int option;
  max_items : int option;
  unique_items : bool option;
  min_length : int option;
  max_length : int option;
  pattern : string option;
  minimum : string option;
  maximum : string option;
}

type run_shape = {
  env_type : core_type option;
  input_type : core_type;
  output_type : core_type;
  returns_result : bool;
}

let empty_metadata =
  {
    description = None;
    min_items = None;
    max_items = None;
    unique_items = None;
    min_length = None;
    max_length = None;
    pattern = None;
    minimum = None;
    maximum = None;
  }

let raise_errorf ~loc fmt = Location.raise_errorf ~loc fmt
let lident ~loc name = B.Located.mk ~loc (Longident.Lident name)
let lid ~loc name = B.Located.mk ~loc (Longident.parse name)
let evar ~loc name = B.pexp_ident ~loc (lid ~loc name)
let pvar ~loc name = B.ppat_var ~loc (B.Located.mk ~loc name)
let estring ~loc value = B.estring ~loc value
let eint ~loc value = B.eint ~loc value
let ebool ~loc value = B.ebool ~loc value
let eunit ~loc = [%expr ()]
let some ~loc expr = B.pexp_construct ~loc (lident ~loc "Some") (Some expr)
let none ~loc = B.pexp_construct ~loc (lident ~loc "None") None
let trim_doc value = String.trim value

let payload_string = function
  | PStr
      [
        {
          pstr_desc =
            Pstr_eval
              ({ pexp_desc = Pexp_constant (Pconst_string (value, _, _)); _ }, _);
          _;
        };
      ] ->
      Some value
  | _ -> None

let payload_int = function
  | PStr
      [
        {
          pstr_desc =
            Pstr_eval
              ({ pexp_desc = Pexp_constant (Pconst_integer (value, _)); _ }, _);
          _;
        };
      ] ->
      int_of_string_opt value
  | _ -> None

let payload_number_string = function
  | PStr
      [
        {
          pstr_desc =
            Pstr_eval
              ({ pexp_desc = Pexp_constant (Pconst_integer (value, _)); _ }, _);
          _;
        };
      ] ->
      Some (value ^ ".")
  | PStr
      [
        {
          pstr_desc =
            Pstr_eval
              ({ pexp_desc = Pexp_constant (Pconst_float (value, _)); _ }, _);
          _;
        };
      ] ->
      Some value
  | _ -> None

let payload_bool = function
  | PStr
      [
        {
          pstr_desc =
            Pstr_eval
              ( {
                  pexp_desc =
                    Pexp_construct
                      ( {
                          txt = Longident.Lident (("true" | "false") as value);
                          _;
                        },
                        None );
                  _;
                },
                _ );
          _;
        };
      ] ->
      Some (String.equal value "true")
  | _ -> None

let doc_from_attrs attrs =
  attrs
  |> List.find_map (fun attr ->
      match attr.attr_name.txt with
      | "ocaml.doc" | "description" | "schema.description" | "doc" ->
          Option.map trim_doc (payload_string attr.attr_payload)
      | _ -> None)

let merge_metadata first second =
  {
    description =
      (match first.description with
      | Some _ -> first.description
      | None -> second.description);
    min_items =
      (match first.min_items with
      | Some _ -> first.min_items
      | None -> second.min_items);
    max_items =
      (match first.max_items with
      | Some _ -> first.max_items
      | None -> second.max_items);
    unique_items =
      (match first.unique_items with
      | Some _ -> first.unique_items
      | None -> second.unique_items);
    min_length =
      (match first.min_length with
      | Some _ -> first.min_length
      | None -> second.min_length);
    max_length =
      (match first.max_length with
      | Some _ -> first.max_length
      | None -> second.max_length);
    pattern =
      (match first.pattern with
      | Some _ -> first.pattern
      | None -> second.pattern);
    minimum =
      (match first.minimum with
      | Some _ -> first.minimum
      | None -> second.minimum);
    maximum =
      (match first.maximum with
      | Some _ -> first.maximum
      | None -> second.maximum);
  }

let metadata_from_attrs attrs =
  List.fold_left
    (fun metadata attr ->
      match attr.attr_name.txt with
      | "ocaml.doc" | "description" | "schema.description" | "doc" ->
          {
            metadata with
            description = Option.map trim_doc (payload_string attr.attr_payload);
          }
      | "min_items" | "schema.min_items" ->
          { metadata with min_items = payload_int attr.attr_payload }
      | "max_items" | "schema.max_items" ->
          { metadata with max_items = payload_int attr.attr_payload }
      | "unique_items" | "schema.unique_items" ->
          { metadata with unique_items = payload_bool attr.attr_payload }
      | "min_length" | "schema.min_length" ->
          { metadata with min_length = payload_int attr.attr_payload }
      | "max_length" | "schema.max_length" ->
          { metadata with max_length = payload_int attr.attr_payload }
      | "pattern" | "schema.pattern" ->
          { metadata with pattern = payload_string attr.attr_payload }
      | "minimum" | "schema.minimum" ->
          { metadata with minimum = payload_number_string attr.attr_payload }
      | "maximum" | "schema.maximum" ->
          { metadata with maximum = payload_number_string attr.attr_payload }
      | _ -> metadata)
    empty_metadata attrs

let metadata_of_field (field : label_declaration) =
  merge_metadata
    (metadata_from_attrs field.pld_attributes)
    (metadata_from_attrs field.pld_type.ptyp_attributes)

let has_metadata metadata =
  Option.is_some metadata.description
  || Option.is_some metadata.min_items
  || Option.is_some metadata.max_items
  || Option.is_some metadata.unique_items
  || Option.is_some metadata.min_length
  || Option.is_some metadata.max_length
  || Option.is_some metadata.pattern
  || Option.is_some metadata.minimum
  || Option.is_some metadata.maximum

let pexp_float ~loc value = B.pexp_constant ~loc (Pconst_float (value, None))
let call ~loc name args = B.pexp_apply ~loc (evar ~loc name) args

let apply_metadata ~loc metadata codec =
  if not (has_metadata metadata) then codec
  else
    let schema = evar ~loc "schema" in
    let schema =
      match metadata.description with
      | None -> schema
      | Some description ->
          call ~loc "Chatoyant.Schema.Schema.with_description"
            [
              (Nolabel, some ~loc (estring ~loc description)); (Nolabel, schema);
            ]
    in
    let schema =
      let args =
        [
          Option.map
            (fun value -> (Labelled "min_items", eint ~loc value))
            metadata.min_items;
          Option.map
            (fun value -> (Labelled "max_items", eint ~loc value))
            metadata.max_items;
          Option.map
            (fun value -> (Labelled "unique_items", ebool ~loc value))
            metadata.unique_items;
        ]
        |> List.filter_map Fun.id
      in
      if args = [] then schema
      else
        call ~loc "Chatoyant.Schema.Schema.with_array_constraints"
          (args @ [ (Nolabel, schema) ])
    in
    let schema =
      let args =
        [
          Option.map
            (fun value -> (Labelled "min_length", eint ~loc value))
            metadata.min_length;
          Option.map
            (fun value -> (Labelled "max_length", eint ~loc value))
            metadata.max_length;
          Option.map
            (fun value -> (Labelled "pattern", estring ~loc value))
            metadata.pattern;
        ]
        |> List.filter_map Fun.id
      in
      if args = [] then schema
      else
        call ~loc "Chatoyant.Schema.Schema.with_string_constraints"
          (args @ [ (Nolabel, schema) ])
    in
    let schema =
      let args =
        [
          Option.map
            (fun value -> (Labelled "minimum", pexp_float ~loc value))
            metadata.minimum;
          Option.map
            (fun value -> (Labelled "maximum", pexp_float ~loc value))
            metadata.maximum;
        ]
        |> List.filter_map Fun.id
      in
      if args = [] then schema
      else
        call ~loc "Chatoyant.Schema.Schema.with_number_constraints"
          (args @ [ (Nolabel, schema) ])
    in
    [%expr
      Chatoyant.Schema.Codec.map_schema (fun schema -> [%e schema]) [%e codec]]

let codec_name type_name = "__chatoyant_codec_" ^ type_name

let constructor_json_name name =
  let buffer = Buffer.create (String.length name + 4) in
  String.iteri
    (fun index ch ->
      if ch = '_' then Buffer.add_char buffer '_'
      else if Char.uppercase_ascii ch = ch && Char.lowercase_ascii ch <> ch then (
        if index > 0 then Buffer.add_char buffer '_';
        Buffer.add_char buffer (Char.lowercase_ascii ch))
      else Buffer.add_char buffer ch)
    name;
  Buffer.contents buffer

let tool_name_from_module name =
  let raw = constructor_json_name name in
  if String.length raw > 0 && raw.[0] = '_' then
    String.sub raw 1 (String.length raw - 1)
  else raw

let type_name_of_core_type = function
  | { ptyp_desc = Ptyp_constr ({ txt = Longident.Lident name; _ }, []); _ } ->
      Some name
  | _ -> None

let rec append_codec_suffix = function
  | Longident.Lident name -> Longident.Lident (name ^ "_codec")
  | Longident.Ldot (parent, name) -> Longident.Ldot (parent, name ^ "_codec")
  | Longident.Lapply _ ->
      Location.raise_errorf
        "chatoyant.ppx cannot derive a codec path for this type"

let rec codec_expr_of_type ~type_names typ =
  let loc = typ.ptyp_loc in
  let codec =
    match typ.ptyp_desc with
    | Ptyp_constr ({ txt = Longident.Lident "string"; _ }, []) ->
        [%expr Chatoyant.Schema.Codec.string ()]
    | Ptyp_constr ({ txt = Longident.Lident "float"; _ }, []) ->
        [%expr Chatoyant.Schema.Codec.float ()]
    | Ptyp_constr ({ txt = Longident.Lident "int"; _ }, []) ->
        [%expr Chatoyant.Schema.Codec.int ()]
    | Ptyp_constr ({ txt = Longident.Lident "bool"; _ }, []) ->
        [%expr Chatoyant.Schema.Codec.bool ()]
    | Ptyp_constr ({ txt = Longident.Lident "list"; _ }, [ item ])
    | Ptyp_constr
        ({ txt = Longident.Ldot (Longident.Lident "List", "t"); _ }, [ item ])
      ->
        [%expr
          Chatoyant.Schema.Codec.array [%e codec_expr_of_type ~type_names item]]
    | Ptyp_constr ({ txt = Longident.Lident "option"; _ }, [ item ])
    | Ptyp_constr
        ({ txt = Longident.Ldot (Longident.Lident "Option", "t"); _ }, [ item ])
      ->
        [%expr
          Chatoyant.Schema.Codec.optional
            [%e codec_expr_of_type ~type_names item]]
    | Ptyp_constr ({ txt = Longident.Lident name; _ }, [])
      when String_map.mem name type_names ->
        call ~loc (codec_name name) [ (Nolabel, eunit ~loc) ]
    | Ptyp_constr ({ txt = Longident.Lident name; _ }, []) ->
        call ~loc (name ^ "_codec") [ (Nolabel, eunit ~loc) ]
    | Ptyp_constr ({ txt = Longident.Ldot _ as name; _ }, []) ->
        B.pexp_apply ~loc
          (B.pexp_ident ~loc (B.Located.mk ~loc (append_codec_suffix name)))
          [ (Nolabel, eunit ~loc) ]
    | _ ->
        raise_errorf ~loc
          "chatoyant.ppx cannot derive a JSON codec for this type yet; use a \
           local record/variant or string/int/float/bool/list/option"
  in
  apply_metadata ~loc (metadata_from_attrs typ.ptyp_attributes) codec

let tuple2 ~loc left right = B.pexp_tuple ~loc [ left; right ]

let field_codec_expr ~type_names (field : label_declaration) =
  let base = codec_expr_of_type ~type_names field.pld_type in
  apply_metadata ~loc:field.pld_loc (metadata_of_field field) base

let schema_field_expr ~type_names field =
  let loc = field.pld_loc in
  tuple2 ~loc
    (estring ~loc field.pld_name.txt)
    [%expr
      Chatoyant.Schema.Codec.schema [%e field_codec_expr ~type_names field]]

let record_field_access ~loc value field_name =
  B.pexp_field ~loc value (lident ~loc field_name)

let encode_field_expr ~type_names field =
  let loc = field.pld_loc in
  let value = evar ~loc "value" in
  tuple2 ~loc
    (estring ~loc field.pld_name.txt)
    [%expr
      Chatoyant.Schema.Codec.encode
        [%e field_codec_expr ~type_names field]
        [%e record_field_access ~loc value field.pld_name.txt]]

let bind_result ~loc rhs name body =
  [%expr
    match [%e rhs] with
    | Error __chatoyant_error -> Error __chatoyant_error
    | Ok [%p pvar ~loc name] -> [%e body]]

let decode_field_binding ~type_names field body =
  let loc = field.pld_loc in
  let rhs =
    [%expr
      Chatoyant.Schema.Codec.decode_field
        [%e estring ~loc field.pld_name.txt]
        [%e field_codec_expr ~type_names field]
        json]
  in
  bind_result ~loc rhs field.pld_name.txt body

let local_type ~loc type_name = B.ptyp_constr ~loc (lident ~loc type_name) []

let record_expr ~loc ~type_name fields =
  B.pexp_constraint ~loc
    (B.pexp_record ~loc
       (List.map
          (fun (field : label_declaration) ->
            (lident ~loc field.pld_name.txt, evar ~loc field.pld_name.txt))
          fields)
       None)
    (local_type ~loc type_name)

let record_codec_body ~type_names ~type_name ?description fields =
  let loc = type_name.loc in
  List.iter
    (fun (field : label_declaration) ->
      match field.pld_mutable with
      | Mutable ->
          raise_errorf ~loc:field.pld_loc
            "chatoyant.ppx tool types must use immutable record fields"
      | Immutable -> ())
    fields;
  let decode_body =
    List.fold_right
      (decode_field_binding ~type_names)
      fields
      [%expr Ok [%e record_expr ~loc ~type_name:type_name.txt fields]]
  in
  let schema =
    let args =
      (match description with
        | None -> []
        | Some description ->
            [ (Optional "description", some ~loc (estring ~loc description)) ])
      @ [
          ( Nolabel,
            B.elist ~loc (List.map (schema_field_expr ~type_names) fields) );
        ]
    in
    call ~loc "Chatoyant.Schema.Schema.object_" args
  in
  [%expr
    Chatoyant.Schema.Codec.custom ~schema:[%e schema]
      ~encode:(fun (value : [%t local_type ~loc type_name.txt]) ->
        Chatoyant.Runtime.Json.Object
          [%e B.elist ~loc (List.map (encode_field_expr ~type_names) fields)])
      ~decode:(fun json -> [%e decode_body])]

let variant_codec_body ~type_name ?description constructors =
  let loc = type_name.loc in
  let cases =
    List.map
      (fun (constructor : constructor_declaration) ->
        match constructor.pcd_args with
        | Pcstr_tuple [] ->
            let json_name = constructor_json_name constructor.pcd_name.txt in
            (constructor, json_name)
        | _ ->
            raise_errorf ~loc:constructor.pcd_loc
              "chatoyant.ppx only supports nullary variant constructors for \
               JSON enum tool types")
      constructors
  in
  let encode_cases =
    List.map
      (fun (constructor, json_name) ->
        B.case
          ~lhs:
            (B.ppat_construct ~loc (lident ~loc constructor.pcd_name.txt) None)
          ~guard:None
          ~rhs:[%expr Chatoyant.Runtime.Json.String [%e estring ~loc json_name]])
      cases
  in
  let decode_cases =
    List.map
      (fun (constructor, json_name) ->
        B.case
          ~lhs:[%pat? Chatoyant.Runtime.Json.String value]
          ~guard:(Some [%expr String.equal value [%e estring ~loc json_name]])
          ~rhs:
            [%expr
              Ok
                [%e
                  B.pexp_construct ~loc
                    (lident ~loc constructor.pcd_name.txt)
                    None]])
      cases
  in
  let decode_cases =
    decode_cases
    @ [
        B.case
          ~lhs:[%pat? Chatoyant.Runtime.Json.String value]
          ~guard:None
          ~rhs:
            [%expr
              Error
                ("unexpected " ^ [%e estring ~loc type_name.txt] ^ " value: "
               ^ value)];
        B.case
          ~lhs:[%pat? _]
          ~guard:None
          ~rhs:
            [%expr
              Error ("expected " ^ [%e estring ~loc type_name.txt] ^ " string")];
      ]
  in
  let schema =
    let values =
      B.elist ~loc
        (List.map
           (fun (_, json_name) ->
             [%expr Chatoyant.Runtime.Json.String [%e estring ~loc json_name]])
           cases)
    in
    let args =
      (match description with
        | None -> []
        | Some description ->
            [ (Optional "description", some ~loc (estring ~loc description)) ])
      @ [ (Nolabel, values) ]
    in
    call ~loc "Chatoyant.Schema.Schema.enum" args
  in
  [%expr
    Chatoyant.Schema.Codec.custom ~schema:[%e schema]
      ~encode:(fun __chatoyant_variant ->
        [%e B.pexp_match ~loc [%expr __chatoyant_variant] encode_cases])
      ~decode:(fun __chatoyant_json ->
        [%e B.pexp_match ~loc [%expr __chatoyant_json] decode_cases])]

let alias_codec_body ~type_names ~metadata typ =
  codec_expr_of_type ~type_names typ
  |> apply_metadata ~loc:typ.ptyp_loc metadata

let codec_body_of_decl ~type_names decl =
  let metadata = metadata_from_attrs decl.ptype_attributes in
  let description = metadata.description in
  match (decl.ptype_kind, decl.ptype_manifest) with
  | Ptype_record fields, None ->
      record_codec_body ~type_names ~type_name:decl.ptype_name ?description
        fields
  | Ptype_variant constructors, None ->
      variant_codec_body ~type_name:decl.ptype_name ?description constructors
  | Ptype_abstract, Some manifest ->
      alias_codec_body ~type_names ~metadata manifest
  | _ ->
      raise_errorf ~loc:decl.ptype_loc
        "chatoyant.ppx can derive tool codecs from records, nullary variants, \
         and aliases only"

let codec_binding ~type_names decl =
  let loc = decl.ptype_loc in
  B.value_binding ~loc
    ~pat:(pvar ~loc (codec_name decl.ptype_name.txt))
    ~expr:[%expr fun () -> [%e codec_body_of_decl ~type_names decl]]

let type_map_of_decls type_decls =
  List.fold_left
    (fun map decl -> String_map.add decl.ptype_name.txt decl map)
    String_map.empty type_decls

let helper_bindings decl =
  let loc = decl.ptype_loc in
  let type_name = decl.ptype_name.txt in
  let codec = call ~loc (codec_name type_name) [ (Nolabel, eunit ~loc) ] in
  [
    B.value_binding ~loc
      ~pat:(pvar ~loc (type_name ^ "_codec"))
      ~expr:[%expr fun () -> [%e codec]];
    B.value_binding ~loc
      ~pat:(pvar ~loc (type_name ^ "_schema"))
      ~expr:[%expr Chatoyant.Schema.Codec.schema [%e codec]];
    B.value_binding ~loc
      ~pat:(pvar ~loc (type_name ^ "_to_json"))
      ~expr:[%expr fun value -> Chatoyant.Schema.Codec.encode [%e codec] value];
    B.value_binding ~loc
      ~pat:(pvar ~loc (type_name ^ "_of_json"))
      ~expr:[%expr fun json -> Chatoyant.Schema.Codec.decode [%e codec] json];
  ]

let generated_codec_items ~loc type_decls =
  let type_names = type_map_of_decls type_decls in
  let codec_item =
    B.pstr_value ~loc Recursive
      (List.map (codec_binding ~type_names) type_decls)
  in
  let helper_items =
    type_decls |> List.concat_map helper_bindings |> fun bindings ->
    if bindings = [] then [] else [ B.pstr_value ~loc Nonrecursive bindings ]
  in
  codec_item :: helper_items

let helper_sig_items decl =
  let loc = decl.ptype_loc in
  let type_name = decl.ptype_name.txt in
  let typ = local_type ~loc type_name in
  let value name typ =
    B.psig_value ~loc
      (B.value_description ~loc ~name:(B.Located.mk ~loc name) ~type_:typ
         ~prim:[])
  in
  [
    value (type_name ^ "_codec")
      [%type: unit -> [%t typ] Chatoyant.Schema.Codec.t];
    value (type_name ^ "_schema") [%type: Chatoyant.Schema.Schema.field];
    value (type_name ^ "_to_json") [%type: [%t typ] -> Chatoyant.Runtime.Json.t];
    value (type_name ^ "_of_json")
      [%type: Chatoyant.Runtime.Json.t -> ([%t typ], string) result];
  ]

let generated_codec_sig_items type_decls =
  List.concat_map helper_sig_items type_decls

let type_decls_of_structure structure =
  structure
  |> List.concat_map (function
    | { pstr_desc = Pstr_type (_, decls); _ } -> decls
    | _ -> [])

let constructor_arg_types = function
  | Pcstr_tuple args -> args
  | Pcstr_record fields -> List.map (fun field -> field.pld_type) fields

let rec collect_reachable_type type_map seen typ =
  let seen =
    match typ.ptyp_desc with
    | Ptyp_constr ({ txt = Longident.Lident name; _ }, args) ->
        let seen = List.fold_left (collect_reachable_type type_map) seen args in
        if String_map.mem name type_map then
          collect_reachable_decl type_map seen (String_map.find name type_map)
        else seen
    | Ptyp_constr (_, args) ->
        List.fold_left (collect_reachable_type type_map) seen args
    | Ptyp_tuple types ->
        List.fold_left (collect_reachable_type type_map) seen types
    | _ -> seen
  in
  seen

and collect_reachable_decl type_map seen decl =
  let name = decl.ptype_name.txt in
  if String_map.mem name seen then seen
  else
    let seen = String_map.add name decl seen in
    let seen =
      match decl.ptype_kind with
      | Ptype_record fields ->
          List.fold_left
            (fun seen field ->
              collect_reachable_type type_map seen field.pld_type)
            seen fields
      | Ptype_variant constructors ->
          List.fold_left
            (fun seen constructor ->
              constructor_arg_types constructor.pcd_args
              |> List.fold_left (collect_reachable_type type_map) seen)
            seen constructors
      | _ -> seen
    in
    match decl.ptype_manifest with
    | Some typ -> collect_reachable_type type_map seen typ
    | None -> seen

let reachable_type_decls type_decls types =
  let type_map = type_map_of_decls type_decls in
  let reachable =
    List.fold_left (collect_reachable_type type_map) String_map.empty types
  in
  List.filter
    (fun decl -> String_map.mem decl.ptype_name.txt reachable)
    type_decls

let rec insert_after_leading_type_decls ~generated acc = function
  | ({ pstr_desc = Pstr_attribute _ | Pstr_type _; _ } as item) :: rest ->
      insert_after_leading_type_decls ~generated (item :: acc) rest
  | rest -> List.rev acc @ generated @ rest

let run_binding_of_structure structure =
  structure
  |> List.find_map (function
    | { pstr_desc = Pstr_value (_, bindings); _ } ->
        List.find_opt
          (fun binding ->
            match binding.pvb_pat.ppat_desc with
            | Ppat_var { txt = "run"; _ } -> true
            | _ -> false)
          bindings
    | _ -> None)

let rec arrows acc typ =
  match typ.ptyp_desc with
  | Ptyp_arrow (Nolabel, arg, rest) -> arrows (arg :: acc) rest
  | Ptyp_arrow ((Labelled _ | Optional _), _, _) ->
      raise_errorf ~loc:typ.ptyp_loc
        "module%%tool currently expects run to take one request record \
         argument or env -> request"
  | _ -> (List.rev acc, typ)

let is_string_type = function
  | { ptyp_desc = Ptyp_constr ({ txt = Longident.Lident "string"; _ }, []); _ }
    ->
      true
  | _ -> false

let parse_return_type typ =
  match typ.ptyp_desc with
  | Ptyp_constr ({ txt = Longident.Lident "result"; _ }, [ output; error ])
    when is_string_type error ->
      (output, true)
  | Ptyp_constr
      ( { txt = Longident.Ldot (Longident.Lident "Stdlib", "result"); _ },
        [ output; error ] )
    when is_string_type error ->
      (output, true)
  | _ -> (typ, false)

let parse_run_shape binding =
  let typ =
    match binding.pvb_constraint with
    | Some (Pvc_constraint { typ; _ }) -> typ
    | Some (Pvc_coercion _) | None ->
        raise_errorf ~loc:binding.pvb_loc
          "module%%tool requires an explicit type signature on let run"
  in
  let args, return_type = arrows [] typ in
  let output_type, returns_result = parse_return_type return_type in
  match args with
  | [ input_type ] ->
      { env_type = None; input_type; output_type; returns_result }
  | [ env_type; input_type ] ->
      { env_type = Some env_type; input_type; output_type; returns_result }
  | _ ->
      raise_errorf ~loc:typ.ptyp_loc
        "module%%tool run must have shape request -> result or env -> request \
         -> result"

let tool_description module_doc run_binding =
  match doc_from_attrs run_binding.pvb_attributes with
  | Some description when description <> "" -> description
  | _ -> (
      match module_doc with
      | Some description when description <> "" -> description
      | _ -> "Tool generated by Chatoyant.")

let module_doc_from_structure structure =
  structure
  |> List.find_map (function
    | {
        pstr_desc =
          Pstr_attribute
            {
              attr_name = { txt = "ocaml.text" | "ocaml.doc"; _ };
              attr_payload;
              _;
            };
        _;
      } ->
        Option.map trim_doc (payload_string attr_payload)
    | _ -> None)

let codec_for_named_or_type ~type_names typ =
  match type_name_of_core_type typ with
  | Some name when String_map.mem name type_names ->
      let loc = typ.ptyp_loc in
      call ~loc (codec_name name) [ (Nolabel, eunit ~loc) ]
  | _ -> codec_expr_of_type ~type_names typ

let generated_tool_item ~loc ~module_name ~description ~type_names shape =
  let name_expr = estring ~loc (tool_name_from_module module_name) in
  let description_expr = estring ~loc description in
  let input_codec = codec_for_named_or_type ~type_names shape.input_type in
  let output_codec = codec_for_named_or_type ~type_names shape.output_type in
  let body_no_env =
    if shape.returns_result then [%expr run input] else [%expr Ok (run input)]
  in
  let body_with_env =
    if shape.returns_result then [%expr run env input]
    else [%expr Ok (run env input)]
  in
  match shape.env_type with
  | None ->
      [%stri
        let tool =
          Chatoyant.Core.Tool.create_typed ~name:[%e name_expr]
            ~description:[%e description_expr] ~args:[%e input_codec]
            ~result:[%e output_codec] (fun _context input -> [%e body_no_env])]
  | Some _ ->
      [%stri
        let make env =
          Chatoyant.Core.Tool.create_typed ~name:[%e name_expr]
            ~description:[%e description_expr] ~args:[%e input_codec]
            ~result:[%e output_codec] (fun _context input -> [%e body_with_env])]

let expand_tool_module ~loc binding =
  let module_name =
    match binding.pmb_name.txt with
    | Some name -> name
    | None ->
        raise_errorf ~loc:binding.pmb_loc "module%%tool requires a named module"
  in
  match binding.pmb_expr.pmod_desc with
  | Pmod_structure structure ->
      let type_decls = type_decls_of_structure structure in
      let run_binding =
        match run_binding_of_structure structure with
        | Some binding -> binding
        | None ->
            raise_errorf ~loc:binding.pmb_loc
              "module%%tool requires a let run binding"
      in
      let shape = parse_run_shape run_binding in
      let type_decls =
        reachable_type_decls type_decls [ shape.input_type; shape.output_type ]
      in
      let type_names = type_map_of_decls type_decls in
      let description =
        tool_description (module_doc_from_structure structure) run_binding
      in
      let codec_items =
        if type_decls = [] then [] else generated_codec_items ~loc type_decls
      in
      let tool_item =
        generated_tool_item ~loc ~module_name ~description ~type_names shape
      in
      let structure =
        insert_after_leading_type_decls ~generated:codec_items [] structure
      in
      {
        binding with
        pmb_expr =
          {
            binding.pmb_expr with
            pmod_desc = Pmod_structure (structure @ [ tool_item ]);
          };
      }
  | _ ->
      raise_errorf ~loc:binding.pmb_loc
        "module%%tool expects a struct ... end module body"

let rec last_module_name = function
  | Longident.Lident name -> Some name
  | Longident.Ldot (_, name) -> Some name
  | Longident.Lapply _ -> None

let default_data_name = function
  | Longident.Lident name -> constructor_json_name name
  | Longident.Ldot (parent, "t") -> (
      match last_module_name parent with
      | Some name -> tool_name_from_module name
      | None -> "data")
  | Longident.Ldot (_, name) -> constructor_json_name name
  | Longident.Lapply _ -> "data"

let codec_call_of_payload_type typ =
  let loc = typ.ptyp_loc in
  match typ.ptyp_desc with
  | Ptyp_constr ({ txt = type_lid; _ }, []) ->
      let codec_lid = append_codec_suffix type_lid in
      B.pexp_apply ~loc
        (B.pexp_ident ~loc (B.Located.mk ~loc codec_lid))
        [ (Nolabel, eunit ~loc) ]
  | _ ->
      raise_errorf ~loc
        "%%chatoyant.gen_data expects a concrete type name, such as \
         [%%chatoyant.gen_data: invoice] or [%%chatoyant.gen_data: Product.t]"

let expand_gen_data_expression ~loc typ =
  let type_lid =
    match typ.ptyp_desc with
    | Ptyp_constr ({ txt; _ }, []) -> txt
    | _ ->
        raise_errorf ~loc:typ.ptyp_loc
          "%%chatoyant.gen_data expects a concrete type name"
  in
  B.pexp_apply ~loc
    (evar ~loc "Chatoyant.gen_data")
    [
      (Labelled "name", estring ~loc (default_data_name type_lid));
      (Labelled "codec", codec_call_of_payload_type typ);
    ]

let expand_structure_item item =
  match item.pstr_desc with
  | Pstr_extension
      ( ( { txt = "tool" | "chatoyant.tool"; loc },
          PStr [ { pstr_desc = Pstr_module binding; _ } ] ),
        _ ) ->
      let binding = expand_tool_module ~loc binding in
      { item with pstr_desc = Pstr_module binding }
  | _ -> item

let mapper =
  object
    inherit Ast_traverse.map as super

    method! structure_item item =
      match item.pstr_desc with
      | Pstr_extension
          ( ( { txt = "tool" | "chatoyant.tool"; _ },
              PStr [ { pstr_desc = Pstr_module _; _ } ] ),
            _ ) ->
          expand_structure_item item
      | _ -> super#structure_item item

    method! expression expr =
      match expr.pexp_desc with
      | Pexp_extension
          ({ txt = "chatoyant.gen_data" | "gen_data"; loc }, PTyp typ) ->
          expand_gen_data_expression ~loc typ
      | _ -> super#expression expr
  end

let impl structure = mapper#structure structure

let str_type_decl =
  Deriving.Generator.make_noarg (fun ~loc ~path:_ (_rec_flag, decls) ->
      generated_codec_items ~loc decls)

let sig_type_decl =
  Deriving.Generator.make_noarg (fun ~loc:_ ~path:_ (_rec_flag, decls) ->
      generated_codec_sig_items decls)

let (_ : Deriving.t) = Deriving.add "chatoyant" ~str_type_decl ~sig_type_decl
let () = Driver.register_transformation "chatoyant.ppx" ~impl
