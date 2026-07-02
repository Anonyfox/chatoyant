type t =
  | Null
  | Bool of bool
  | Float of float
  | String of string
  | Array of t list
  | Object of (string * t) list

let field name = function
  | Object fields -> List.assoc_opt name fields
  | _ -> None

let as_string = function String value -> Some value | _ -> None
let as_bool = function Bool value -> Some value | _ -> None
let as_float = function Float value -> Some value | _ -> None

let as_int = function
  | Float value when Float.is_integer value -> Some (Int.of_float value)
  | _ -> None

let as_list = function Array values -> Some values | _ -> None
let as_object = function Object fields -> Some fields | _ -> None

let escape_string value =
  let buffer = Buffer.create (String.length value + 2) in
  String.iter
    (function
      | '"' -> Buffer.add_string buffer "\\\""
      | '\\' -> Buffer.add_string buffer "\\\\"
      | '\b' -> Buffer.add_string buffer "\\b"
      | '\012' -> Buffer.add_string buffer "\\f"
      | '\n' -> Buffer.add_string buffer "\\n"
      | '\r' -> Buffer.add_string buffer "\\r"
      | '\t' -> Buffer.add_string buffer "\\t"
      | ch when Char.code ch < 0x20 ->
          Buffer.add_string buffer (Printf.sprintf "\\u%04x" (Char.code ch))
      | ch -> Buffer.add_char buffer ch)
    value;
  Buffer.contents buffer

let rec to_string = function
  | Null -> "null"
  | Bool true -> "true"
  | Bool false -> "false"
  | Float value ->
      if Float.is_integer value then Printf.sprintf "%.0f" value
      else string_of_float value
  | String value -> "\"" ^ escape_string value ^ "\""
  | Array values -> "[" ^ String.concat "," (List.map to_string values) ^ "]"
  | Object fields ->
      let encode_field (key, value) =
        "\"" ^ escape_string key ^ "\":" ^ to_string value
      in
      "{" ^ String.concat "," (List.map encode_field fields) ^ "}"

type parser = { source : string; mutable index : int }

let parse_error parser message =
  Error (Printf.sprintf "JSON parse error at byte %d: %s" parser.index message)

let peek parser =
  if parser.index >= String.length parser.source then None
  else Some parser.source.[parser.index]

let bump parser =
  match peek parser with
  | None -> None
  | Some ch ->
      parser.index <- parser.index + 1;
      Some ch

let rec skip_ws parser =
  match peek parser with
  | Some (' ' | '\n' | '\r' | '\t') ->
      parser.index <- parser.index + 1;
      skip_ws parser
  | _ -> ()

let expect parser expected =
  match bump parser with
  | Some ch when ch = expected -> Ok ()
  | Some _ -> parse_error parser (Printf.sprintf "expected %C" expected)
  | None ->
      parse_error parser
        (Printf.sprintf "expected %C, got end of input" expected)

let hex_value = function
  | '0' .. '9' as ch -> Some (Char.code ch - Char.code '0')
  | 'a' .. 'f' as ch -> Some (10 + Char.code ch - Char.code 'a')
  | 'A' .. 'F' as ch -> Some (10 + Char.code ch - Char.code 'A')
  | _ -> None

let parse_unicode_escape parser =
  let value = ref 0 in
  let rec loop count =
    if count = 4 then Ok !value
    else
      match bump parser with
      | Some ch -> (
          match hex_value ch with
          | Some v ->
              value := (!value * 16) + v;
              loop (count + 1)
          | None -> parse_error parser "invalid unicode escape")
      | None -> parse_error parser "unterminated unicode escape"
  in
  loop 0

let add_utf8 buffer code =
  if code <= 0x7F then Buffer.add_char buffer (Char.chr code)
  else if code <= 0x7FF then (
    Buffer.add_char buffer (Char.chr (0xC0 lor (code lsr 6)));
    Buffer.add_char buffer (Char.chr (0x80 lor (code land 0x3F))))
  else (
    Buffer.add_char buffer (Char.chr (0xE0 lor (code lsr 12)));
    Buffer.add_char buffer (Char.chr (0x80 lor ((code lsr 6) land 0x3F)));
    Buffer.add_char buffer (Char.chr (0x80 lor (code land 0x3F))))

let parse_string parser =
  match expect parser '"' with
  | Error _ as err -> err
  | Ok () ->
      let buffer = Buffer.create 32 in
      let rec loop () =
        match bump parser with
        | None -> parse_error parser "unterminated string"
        | Some '"' -> Ok (String (Buffer.contents buffer))
        | Some '\\' -> (
            match bump parser with
            | Some '"' ->
                Buffer.add_char buffer '"';
                loop ()
            | Some '\\' ->
                Buffer.add_char buffer '\\';
                loop ()
            | Some '/' ->
                Buffer.add_char buffer '/';
                loop ()
            | Some 'b' ->
                Buffer.add_char buffer '\b';
                loop ()
            | Some 'f' ->
                Buffer.add_char buffer '\012';
                loop ()
            | Some 'n' ->
                Buffer.add_char buffer '\n';
                loop ()
            | Some 'r' ->
                Buffer.add_char buffer '\r';
                loop ()
            | Some 't' ->
                Buffer.add_char buffer '\t';
                loop ()
            | Some 'u' -> (
                match parse_unicode_escape parser with
                | Error _ as err -> err
                | Ok code ->
                    add_utf8 buffer code;
                    loop ())
            | Some _ -> parse_error parser "invalid escape"
            | None -> parse_error parser "unterminated escape")
        | Some ch ->
            Buffer.add_char buffer ch;
            loop ()
      in
      loop ()

let starts_with parser literal =
  let len = String.length literal in
  parser.index + len <= String.length parser.source
  && String.sub parser.source parser.index len = literal

let parse_literal parser literal value =
  if starts_with parser literal then (
    parser.index <- parser.index + String.length literal;
    Ok value)
  else parse_error parser ("expected " ^ literal)

let parse_number parser =
  let start = parser.index in
  let consume_while pred =
    while
      match peek parser with
      | Some ch when pred ch ->
          parser.index <- parser.index + 1;
          true
      | _ -> false
    do
      ()
    done
  in
  (match peek parser with
  | Some '-' -> parser.index <- parser.index + 1
  | _ -> ());
  consume_while (function '0' .. '9' -> true | _ -> false);
  (match peek parser with
  | Some '.' ->
      parser.index <- parser.index + 1;
      consume_while (function '0' .. '9' -> true | _ -> false)
  | _ -> ());
  (match peek parser with
  | Some ('e' | 'E') ->
      parser.index <- parser.index + 1;
      (match peek parser with
      | Some ('+' | '-') -> parser.index <- parser.index + 1
      | _ -> ());
      consume_while (function '0' .. '9' -> true | _ -> false)
  | _ -> ());
  let raw = String.sub parser.source start (parser.index - start) in
  match float_of_string_opt raw with
  | Some value -> Ok (Float value)
  | None -> parse_error parser "invalid number"

let rec parse_value parser =
  skip_ws parser;
  match peek parser with
  | None -> parse_error parser "unexpected end of input"
  | Some '"' -> parse_string parser
  | Some '{' -> parse_object parser
  | Some '[' -> parse_array parser
  | Some 't' -> parse_literal parser "true" (Bool true)
  | Some 'f' -> parse_literal parser "false" (Bool false)
  | Some 'n' -> parse_literal parser "null" Null
  | Some ('-' | '0' .. '9') -> parse_number parser
  | Some _ -> parse_error parser "unexpected character"

and parse_array parser =
  match expect parser '[' with
  | Error _ as err -> err
  | Ok () ->
      skip_ws parser;
      let rec loop acc =
        skip_ws parser;
        match peek parser with
        | Some ']' ->
            parser.index <- parser.index + 1;
            Ok (Array (List.rev acc))
        | _ -> (
            match parse_value parser with
            | Error _ as err -> err
            | Ok value -> (
                skip_ws parser;
                match peek parser with
                | Some ',' ->
                    parser.index <- parser.index + 1;
                    loop (value :: acc)
                | Some ']' ->
                    parser.index <- parser.index + 1;
                    Ok (Array (List.rev (value :: acc)))
                | _ -> parse_error parser "expected ',' or ']'"))
      in
      loop []

and parse_object parser =
  match expect parser '{' with
  | Error _ as err -> err
  | Ok () ->
      skip_ws parser;
      let rec loop acc =
        skip_ws parser;
        match peek parser with
        | Some '}' ->
            parser.index <- parser.index + 1;
            Ok (Object (List.rev acc))
        | _ -> (
            match parse_string parser with
            | Error _ as err -> err
            | Ok (String key) -> (
                skip_ws parser;
                match expect parser ':' with
                | Error _ as err -> err
                | Ok () -> (
                    match parse_value parser with
                    | Error _ as err -> err
                    | Ok value -> (
                        skip_ws parser;
                        match peek parser with
                        | Some ',' ->
                            parser.index <- parser.index + 1;
                            loop ((key, value) :: acc)
                        | Some '}' ->
                            parser.index <- parser.index + 1;
                            Ok (Object (List.rev ((key, value) :: acc)))
                        | _ -> parse_error parser "expected ',' or '}'")))
            | Ok _ -> parse_error parser "object keys must be strings")
      in
      loop []

let parse source =
  let parser = { source; index = 0 } in
  match parse_value parser with
  | Error _ as err -> err
  | Ok value ->
      skip_ws parser;
      if parser.index = String.length source then Ok value
      else parse_error parser "trailing input"
