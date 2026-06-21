type content_kind =
  | English
  | Code
  | Cjk
  | Mixed

let chars_per_token = function
  | English -> 4.0
  | Code -> 3.5
  | Cjk -> 1.5
  | Mixed -> 3.8

let has_cjk text =
  let rec loop index =
    if index >= String.length text then false
    else
      let code = Char.code text.[index] in
      (* Byte-level UTF-8 prefilter. Full Unicode classification belongs in the
         native/JS tokenizer backends; this preserves a dependency-free core. *)
      if code >= 0xE3 then true else loop (index + 1)
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
  let indicators = [ "{"; "}"; "=>"; "function"; "const "; "let "; "class "; "import " ] in
  let matches =
    List.fold_left
      (fun count indicator -> if contains_substring indicator text then count + 1 else count)
      0 indicators
  in
  matches >= 2

let classify text =
  if text = "" then English
  else if has_cjk text then Cjk
  else if looks_like_code text then Code
  else English

let estimate_with_ratio ~chars_per_token text =
  if text = "" || chars_per_token <= 0.0 then 0
  else int_of_float (ceil (Float.of_int (String.length text) /. chars_per_token))

let estimate text = estimate_with_ratio ~chars_per_token:(chars_per_token (classify text)) text

let estimate_many texts = List.fold_left (fun total text -> total + estimate text) 0 texts
