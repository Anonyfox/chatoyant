type content_kind = English | Code | Cjk | Mixed
type prompt_estimate = { input : int; output : int; total : int }

let chars_per_token = function
  | English -> 4.0
  | Code -> 3.5
  | Cjk -> 1.5
  | Mixed -> 3.8

let utf8_stats text =
  let len = String.length text in
  let cjk = ref 0 in
  let count = ref 0 in
  let add code =
    incr count;
    if
      (code >= 0x4E00 && code <= 0x9FFF)
      || (code >= 0x3400 && code <= 0x4DBF)
      || (code >= 0x3040 && code <= 0x30FF)
      || (code >= 0xAC00 && code <= 0xD7AF)
    then incr cjk
  in
  let rec loop index =
    if index >= len then (!count, !cjk)
    else
      let byte = Char.code text.[index] in
      if byte land 0x80 = 0 then (
        add byte;
        loop (index + 1))
      else if index + 1 < len && byte land 0xE0 = 0xC0 then (
        let b1 = Char.code text.[index + 1] land 0x3F in
        add (((byte land 0x1F) lsl 6) lor b1);
        loop (index + 2))
      else if index + 2 < len && byte land 0xF0 = 0xE0 then (
        let b1 = Char.code text.[index + 1] land 0x3F in
        let b2 = Char.code text.[index + 2] land 0x3F in
        add (((byte land 0x0F) lsl 12) lor (b1 lsl 6) lor b2);
        loop (index + 3))
      else if index + 3 < len && byte land 0xF8 = 0xF0 then (
        let b1 = Char.code text.[index + 1] land 0x3F in
        let b2 = Char.code text.[index + 2] land 0x3F in
        let b3 = Char.code text.[index + 3] land 0x3F in
        add (((byte land 0x07) lsl 18) lor (b1 lsl 12) lor (b2 lsl 6) lor b3);
        loop (index + 4))
      else (
        add byte;
        loop (index + 1))
  in
  loop 0

let contains_substring needle text =
  let needle_len = String.length needle in
  let text_len = String.length text in
  let rec loop index =
    if needle_len = 0 then true
    else if index + needle_len > text_len then false
    else if String.sub text index needle_len = needle then true
    else loop (index + 1)
  in
  loop 0

let looks_like_code text =
  let indicators =
    [
      "{";
      "}";
      "[";
      "]";
      "(";
      ");";
      "=>";
      "==";
      "!=";
      "<=";
      ">=";
      "function";
      "const ";
      "let ";
      "var ";
      "class ";
      "import ";
      "export ";
      "def ";
      "fn ";
      "pub ";
    ]
  in
  let matches =
    List.fold_left
      (fun count indicator ->
        if contains_substring indicator text then count + 1 else count)
      0 indicators
  in
  matches >= 2

let classify text =
  if text = "" then English
  else
    let _, cjk = utf8_stats text in
    if cjk > 0 then Cjk else if looks_like_code text then Code else English

let estimate_with_ratio ~chars_per_token text =
  if text = "" || chars_per_token <= 0.0 then 0
  else
    int_of_float (ceil (Float.of_int (String.length text) /. chars_per_token))

let estimate text =
  if text = "" then 0
  else
    let chars, cjk = utf8_stats text in
    let chars = if chars = 0 then String.length text else chars in
    let ratio =
      if cjk > 0 then
        let cjk_ratio = Float.of_int cjk /. Float.of_int chars in
        (chars_per_token Cjk *. cjk_ratio)
        +. (chars_per_token Mixed *. (1.0 -. cjk_ratio))
      else chars_per_token (classify text)
    in
    int_of_float (ceil (Float.of_int chars /. ratio))

let estimate_prompt ?response prompt =
  let input = estimate prompt in
  let output = Option.value (Option.map estimate response) ~default:0 in
  { input; output; total = input + output }

let estimate_many texts =
  List.fold_left (fun total text -> total + estimate text) 0 texts
