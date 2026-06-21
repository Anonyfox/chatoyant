type atom =
  | Literal of char
  | Any
  | Digit
  | Letter
  | Char_class of (char * char) list

type quantifier =
  | Once
  | Star
  | Plus
  | At_least of int

let is_ascii_letter = function
  | 'a' .. 'z' | 'A' .. 'Z' -> true
  | ch -> Char.code ch >= 0x80

let atom_matches atom ch =
  match atom with
  | Literal expected -> ch = expected
  | Any -> true
  | Digit -> ch >= '0' && ch <= '9'
  | Letter -> is_ascii_letter ch
  | Char_class ranges -> List.exists (fun (lo, hi) -> ch >= lo && ch <= hi) ranges

let parse_quantifier pattern index =
  if index >= String.length pattern then (Once, index)
  else
    match pattern.[index] with
    | '*' -> (Star, index + 1)
    | '+' -> (Plus, index + 1)
    | '{' -> (
        match String.index_from_opt pattern index '}' with
        | None -> (Once, index)
        | Some close ->
            let inner = String.sub pattern (index + 1) (close - index - 1) in
            let minimum =
              match String.index_opt inner ',' with
              | None -> int_of_string_opt inner
              | Some comma -> int_of_string_opt (String.sub inner 0 comma)
            in
            (match minimum with
            | Some minimum -> (At_least minimum, close + 1)
            | None -> (Once, index)))
    | _ -> (Once, index)

let parse_class pattern index =
  match String.index_from_opt pattern index ']' with
  | None -> (Literal '[', index + 1)
  | Some close ->
      let body = String.sub pattern index (close - index) in
      let rec ranges at acc =
        if at >= String.length body then List.rev acc
        else if at + 2 < String.length body && body.[at + 1] = '-' then
          ranges (at + 3) ((body.[at], body.[at + 2]) :: acc)
        else ranges (at + 1) ((body.[at], body.[at]) :: acc)
      in
      (Char_class (ranges 0 []), close + 1)

let parse_atom pattern index =
  if index >= String.length pattern then None
  else
    match pattern.[index] with
    | '.' -> Some (Any, index + 1)
    | '[' ->
        let atom, next = parse_class pattern (index + 1) in
        Some (atom, next)
    | '\\' when index + 1 < String.length pattern -> (
        match pattern.[index + 1] with
        | 'd' -> Some (Digit, index + 2)
        | 'p'
          when index + 9 < String.length pattern
               && String.sub pattern (index + 2) 8 = "{Letter}" ->
            Some (Letter, index + 10)
        | ch -> Some (Literal ch, index + 2))
    | ch -> Some (Literal ch, index + 1)

let parse_tokens pattern =
  let anchored_start =
    String.length pattern > 0 && pattern.[0] = '^'
  in
  let anchored_end =
    String.length pattern > 0 && pattern.[String.length pattern - 1] = '$'
  in
  let first = if anchored_start then 1 else 0 in
  let last = if anchored_end then String.length pattern - 1 else String.length pattern in
  let rec loop index acc =
    if index >= last then List.rev acc
    else
      match parse_atom pattern index with
      | None -> List.rev acc
      | Some (atom, next) ->
          let quantifier, next = parse_quantifier pattern next in
          loop next ((atom, quantifier) :: acc)
  in
  (anchored_start, anchored_end, loop first [])

let consume_repeated atom minimum maximum chars =
  let rec take count remaining =
    match (maximum, remaining) with
    | Some max, _ when count >= max -> [ (count, remaining) ]
    | _, ch :: rest when atom_matches atom ch ->
        (count, remaining) :: take (count + 1) rest
    | _ -> [ (count, remaining) ]
  in
  take 0 chars
  |> List.filter (fun (count, _) -> count >= minimum)
  |> List.rev
  |> List.map snd

let rec match_tokens tokens chars =
  match tokens with
  | [] -> Some chars
  | (atom, quantifier) :: rest ->
      let candidates =
        match quantifier with
        | Once -> consume_repeated atom 1 (Some 1) chars
        | Star -> consume_repeated atom 0 None chars
        | Plus -> consume_repeated atom 1 None chars
        | At_least minimum -> consume_repeated atom minimum None chars
      in
      let rec try_candidates = function
        | [] -> None
        | remaining :: more -> (
            match match_tokens rest remaining with
            | Some _ as ok -> ok
            | None -> try_candidates more)
      in
      try_candidates candidates

let chars_of_string value =
  let rec loop index acc =
    if index < 0 then acc else loop (index - 1) (value.[index] :: acc)
  in
  loop (String.length value - 1) []

let suffixes chars =
  let rec loop current acc =
    match current with
    | [] -> List.rev ([] :: acc)
    | _ :: rest -> loop rest (current :: acc)
  in
  loop chars []

let matches ~pattern value =
  let anchored_start, anchored_end, tokens = parse_tokens pattern in
  let chars = chars_of_string value in
  let starts = if anchored_start then [ chars ] else suffixes chars in
  let rec try_starts = function
    | [] -> false
    | start :: rest -> (
        match match_tokens tokens start with
        | Some remaining when (not anchored_end) || remaining = [] -> true
        | _ -> try_starts rest)
  in
  try_starts starts
