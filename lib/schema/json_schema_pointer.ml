module Json = Chatoyant_runtime.Json

type fragment = Empty | Pointer of string list | Anchor of string

let hex_value = function
  | '0' .. '9' as ch -> Some (Char.code ch - Char.code '0')
  | 'a' .. 'f' as ch -> Some (10 + Char.code ch - Char.code 'a')
  | 'A' .. 'F' as ch -> Some (10 + Char.code ch - Char.code 'A')
  | _ -> None

let percent_decode value =
  let buffer = Buffer.create (String.length value) in
  let rec loop index =
    if index >= String.length value then Buffer.contents buffer
    else
      match value.[index] with
      | '%' when index + 2 < String.length value -> (
          match (hex_value value.[index + 1], hex_value value.[index + 2]) with
          | Some hi, Some lo ->
              Buffer.add_char buffer (Char.chr ((hi * 16) + lo));
              loop (index + 3)
          | _ ->
              Buffer.add_char buffer value.[index];
              loop (index + 1))
      | ch ->
          Buffer.add_char buffer ch;
          loop (index + 1)
  in
  loop 0

let split_uri_fragment uri =
  match String.index_opt uri '#' with
  | None -> (uri, None)
  | Some index ->
      let document = String.sub uri 0 index in
      let fragment =
        String.sub uri (index + 1) (String.length uri - index - 1)
      in
      (document, Some fragment)

let split_on_slash value =
  let rec loop start acc =
    match String.index_from_opt value start '/' with
    | None ->
        let part = String.sub value start (String.length value - start) in
        List.rev (part :: acc)
    | Some index ->
        let part = String.sub value start (index - start) in
        loop (index + 1) (part :: acc)
  in
  if value = "" then [] else loop 0 []

let unescape_pointer_token token =
  let buffer = Buffer.create (String.length token) in
  let rec loop index =
    if index >= String.length token then Buffer.contents buffer
    else if index + 1 < String.length token && token.[index] = '~' then (
      match token.[index + 1] with
      | '0' ->
          Buffer.add_char buffer '~';
          loop (index + 2)
      | '1' ->
          Buffer.add_char buffer '/';
          loop (index + 2)
      | _ ->
          Buffer.add_char buffer token.[index];
          loop (index + 1))
    else (
      Buffer.add_char buffer token.[index];
      loop (index + 1))
  in
  loop 0

let parse_fragment = function
  | None | Some "" -> Empty
  | Some fragment ->
      let decoded = percent_decode fragment in
      if String.length decoded > 0 && decoded.[0] = '/' then
        let rest = String.sub decoded 1 (String.length decoded - 1) in
        Pointer (List.map unescape_pointer_token (split_on_slash rest))
      else Anchor decoded

let rec nth_opt values index =
  match (values, index) with
  | [], _ -> None
  | value :: _, 0 -> Some value
  | _ :: rest, index when index > 0 -> nth_opt rest (index - 1)
  | _ -> None

let rec resolve_pointer json = function
  | [] -> Some json
  | token :: rest -> (
      match json with
      | Json.Object fields -> (
          match List.assoc_opt token fields with
          | None -> None
          | Some value -> resolve_pointer value rest)
      | Json.Array values -> (
          match int_of_string_opt token with
          | None -> None
          | Some index -> (
              match nth_opt values index with
              | None -> None
              | Some value -> resolve_pointer value rest))
      | _ -> None)

let escape_pointer_token token =
  let buffer = Buffer.create (String.length token) in
  String.iter
    (function
      | '~' -> Buffer.add_string buffer "~0"
      | '/' -> Buffer.add_string buffer "~1"
      | ch -> Buffer.add_char buffer ch)
    token;
  Buffer.contents buffer

let pointer_to_string tokens =
  match tokens with
  | [] -> ""
  | _ -> "/" ^ String.concat "/" (List.map escape_pointer_token tokens)
