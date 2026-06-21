module Json = Chatoyant_runtime.Json
module Pointer = Json_schema_pointer

type target = {
  uri : string;
  base_uri : string;
  schema : Json.t;
}

type resource = {
  uri : string;
  schema : Json.t;
}

type t = {
  root : Json.t;
  root_base_uri : string;
  resources : (string * Json.t) list;
  anchors : (string * Json.t) list;
  dynamic_anchors : (string * Json.t) list;
}

let root registry = registry.root
let root_base_uri registry = registry.root_base_uri

let has_scheme uri =
  match String.index_opt uri ':' with
  | None -> false
  | Some index ->
      index > 0
      &&
      let rec loop i =
        if i >= index then true
        else
          match uri.[i] with
          | 'a' .. 'z' | 'A' .. 'Z' | '0' .. '9' | '+' | '-' | '.' -> loop (i + 1)
          | _ -> false
      in
      loop 0

let split_document uri = fst (Pointer.split_uri_fragment uri)

let normalize_path path =
  let absolute = String.length path > 0 && path.[0] = '/' in
  let trailing_slash = String.length path > 1 && path.[String.length path - 1] = '/' in
  let parts =
    path
    |> String.split_on_char '/'
    |> List.fold_left
         (fun acc part ->
           match part with
           | "" | "." -> acc
           | ".." -> (
               match acc with
               | [] -> []
               | _ :: rest -> rest)
           | value -> value :: acc)
         []
    |> List.rev
  in
  let normalized = (if absolute then "/" else "") ^ String.concat "/" parts in
  if trailing_slash && normalized <> "/" then normalized ^ "/" else normalized

let scheme_authority uri =
  match String.index_opt uri ':' with
  | None -> None
  | Some colon ->
      if colon + 2 < String.length uri
         && uri.[colon + 1] = '/'
         && uri.[colon + 2] = '/'
      then
        let start = colon + 3 in
        let stop =
          match String.index_from_opt uri start '/' with
          | Some index -> index
          | None -> String.length uri
        in
        Some
          ( String.sub uri 0 colon,
            String.sub uri start (stop - start),
            if stop < String.length uri then
              String.sub uri stop (String.length uri - stop)
            else "/" )
      else None

let directory document =
  match String.rindex_opt document '/' with
  | None -> ""
  | Some index -> String.sub document 0 (index + 1)

let resolve_uri ~base_uri reference =
  if reference = "" then split_document base_uri
  else if has_scheme reference then reference
  else
    let base_document = split_document base_uri in
    if String.length reference > 0 && reference.[0] = '#' then
      base_document ^ reference
    else if String.length reference > 0 && reference.[0] = '/' then
      match scheme_authority base_document with
      | Some (scheme, authority, _) -> scheme ^ "://" ^ authority ^ normalize_path reference
      | None -> normalize_path reference
    else
      match scheme_authority base_document with
      | Some (scheme, authority, path) ->
          let combined = normalize_path (directory path ^ reference) in
          scheme ^ "://" ^ authority ^ combined
      | None -> normalize_path (directory base_document ^ reference)

let without_fragment uri = split_document uri

let string_ends_with value suffix =
  let value_len = String.length value in
  let suffix_len = String.length suffix in
  suffix_len <= value_len
  && String.sub value (value_len - suffix_len) suffix_len = suffix

let json_string_field name = function
  | Json.Object fields -> Option.bind (List.assoc_opt name fields) Json.as_string
  | _ -> None

let is_schema_keyword name =
  match name with
  | "additionalProperties" | "unevaluatedProperties" | "propertyNames" | "items"
  | "contains" | "unevaluatedItems" | "not" | "if" | "then" | "else" ->
      true
  | _ -> false

let is_schema_array_keyword name =
  match name with
  | "prefixItems" | "allOf" | "anyOf" | "oneOf" -> true
  | _ -> false

let object_values = function
  | Json.Object fields -> List.map snd fields
  | _ -> []

let array_values = function
  | Json.Array values -> values
  | _ -> []

let add_unique key value entries =
  if List.mem_assoc key entries then entries else (key, value) :: entries

let merge_unique entries additions =
  List.fold_left
    (fun acc (key, value) -> add_unique key value acc)
    entries additions

let scan root_base root =
  let rec loop base schema (resources, anchors, dynamic_anchors) =
    match schema with
    | Json.Bool _ -> (resources, anchors, dynamic_anchors)
    | Json.Object fields ->
        let base =
          match json_string_field "$id" schema with
          | None -> base
          | Some id -> resolve_uri ~base_uri:base id |> without_fragment
        in
        let resources = add_unique base schema resources in
        let anchors =
          match json_string_field "$anchor" schema with
          | None -> anchors
          | Some anchor -> add_unique (base ^ "#" ^ anchor) schema anchors
        in
        let dynamic_anchors =
          match json_string_field "$dynamicAnchor" schema with
          | None -> dynamic_anchors
          | Some anchor -> add_unique (base ^ "#" ^ anchor) schema dynamic_anchors
        in
        List.fold_left
          (fun acc (name, value) ->
            if is_schema_keyword name then
              match value with
              | Json.Bool _ | Json.Object _ -> loop base value acc
              | Json.Array _ | Json.Float _ | Json.String _ | Json.Null -> acc
            else if name = "$defs" || name = "definitions" || name = "properties"
                    || name = "patternProperties" || name = "dependentSchemas"
            then List.fold_left (fun acc value -> loop base value acc) acc (object_values value)
            else if is_schema_array_keyword name then
              List.fold_left (fun acc value -> loop base value acc) acc (array_values value)
            else acc)
          (resources, anchors, dynamic_anchors)
          fields
    | _ -> (resources, anchors, dynamic_anchors)
  in
  loop root_base root ([], [], [])

let scan_resource ~retrieval_uri schema (resources, anchors, dynamic_anchors) =
  let base_uri =
    match json_string_field "$id" schema with
    | None -> without_fragment retrieval_uri
    | Some id -> resolve_uri ~base_uri:retrieval_uri id |> without_fragment
  in
  let scanned_resources, scanned_anchors, scanned_dynamic_anchors = scan base_uri schema in
  let resources = merge_unique resources scanned_resources in
  let anchors = merge_unique anchors scanned_anchors in
  let dynamic_anchors = merge_unique dynamic_anchors scanned_dynamic_anchors in
  let resources = add_unique (without_fragment retrieval_uri) schema resources in
  (resources, anchors, dynamic_anchors, base_uri)

let create ?(base_uri = "") ?(resources = []) root =
  let root_resources, root_anchors, root_dynamic_anchors, root_base_uri =
    scan_resource ~retrieval_uri:base_uri root ([], [], [])
  in
  let resources, anchors, dynamic_anchors =
    List.fold_left
      (fun (resources, anchors, dynamic_anchors) resource ->
        let scanned_resources, scanned_anchors, scanned_dynamic_anchors, _ =
          scan_resource ~retrieval_uri:resource.uri resource.schema
            (resources, anchors, dynamic_anchors)
        in
        (scanned_resources, scanned_anchors, scanned_dynamic_anchors))
      (root_resources, root_anchors, root_dynamic_anchors)
      resources
  in
  let resources =
    add_unique "https://json-schema.org/draft/2020-12/schema" (Json.Bool true)
      resources
  in
  {
    root;
    root_base_uri;
    resources = List.rev resources;
    anchors = List.rev anchors;
    dynamic_anchors = List.rev dynamic_anchors;
  }

let child_base_uri _registry ~base_uri schema =
  match json_string_field "$id" schema with
  | None -> base_uri
  | Some id ->
      let resolved = resolve_uri ~base_uri id |> without_fragment in
      let id_document = without_fragment id in
      if base_uri <> ""
         && (base_uri = resolved
            || (not (has_scheme id_document) && string_ends_with base_uri id_document))
      then base_uri
      else resolved

let resource registry document =
  if document = "" then Some registry.root
  else List.assoc_opt document registry.resources

let resolve registry ~base_uri reference =
  let absolute = resolve_uri ~base_uri reference in
  let document, fragment = Pointer.split_uri_fragment absolute in
  let document =
    if document = "" then split_document base_uri else document
  in
  match Pointer.parse_fragment fragment with
  | Pointer.Empty -> (
      match resource registry document with
      | None -> None
      | Some schema -> Some { uri = document; base_uri = document; schema })
  | Pointer.Pointer tokens -> (
      match resource registry document with
      | None -> None
      | Some schema -> (
          match Pointer.resolve_pointer schema tokens with
          | None -> None
          | Some schema ->
              Some { uri = document ^ "#" ^ Pointer.pointer_to_string tokens; base_uri = document; schema }))
  | Pointer.Anchor anchor -> (
      match List.assoc_opt (document ^ "#" ^ anchor) registry.anchors with
      | Some schema -> Some { uri = document ^ "#" ^ anchor; base_uri = document; schema }
      | None -> (
          match List.assoc_opt (document ^ "#" ^ anchor) registry.dynamic_anchors with
          | Some schema -> Some { uri = document ^ "#" ^ anchor; base_uri = document; schema }
          | None -> None))

let dynamic_anchors_for_resource registry base_uri =
  let document = without_fragment base_uri in
  registry.dynamic_anchors
  |> List.filter_map (fun (uri, schema) ->
         let document', fragment = Pointer.split_uri_fragment uri in
         match Pointer.parse_fragment fragment with
         | Pointer.Anchor anchor when document' = document ->
             Some (anchor, { uri; base_uri = document; schema })
         | _ -> None)

let resolve_dynamic registry ~base_uri ~dynamic_scope reference =
  let absolute = resolve_uri ~base_uri reference in
  let _, fragment = Pointer.split_uri_fragment absolute in
  match Pointer.parse_fragment fragment with
  | Pointer.Anchor anchor -> (
      let static = resolve registry ~base_uri reference in
      let static_is_dynamic =
        match static with
        | None -> false
        | Some target -> (
            match json_string_field "$dynamicAnchor" target.schema with
            | Some dynamic_anchor when dynamic_anchor = anchor -> true
            | _ -> false)
      in
      if not static_is_dynamic then static
      else
        match List.assoc_opt anchor dynamic_scope with
        | Some target -> Some target
      | None -> resolve registry ~base_uri reference)
  | _ -> resolve registry ~base_uri reference
