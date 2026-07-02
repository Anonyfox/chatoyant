type options = { max_tokens : int; overlap : int; separator : string option }

let trim = String.trim

let split_on_substring ~separator text =
  if separator = "" then [ text ]
  else
    let separator_len = String.length separator in
    let text_len = String.length text in
    let rec find_from index =
      if index + separator_len > text_len then None
      else if String.sub text index separator_len = separator then Some index
      else find_from (index + 1)
    in
    let rec loop start acc =
      match find_from start with
      | None -> List.rev (String.sub text start (text_len - start) :: acc)
      | Some index ->
          let part = String.sub text start (index - start) in
          loop (index + separator_len) (part :: acc)
    in
    loop 0 []

let words text =
  text |> String.split_on_char ' ' |> List.map trim |> List.filter (( <> ) "")

let default_segments text =
  text |> String.split_on_char '\n' |> List.concat_map words

let segments ?separator text =
  match separator with
  | Some separator ->
      split_on_substring ~separator text
      |> List.map trim
      |> List.filter (( <> ) "")
  | None -> default_segments text

let overlap_text text overlap_tokens =
  if overlap_tokens <= 0 then ""
  else
    let words = words text in
    let rec loop tokens acc = function
      | [] -> String.concat " " acc
      | word :: rest ->
          if tokens >= overlap_tokens then String.concat " " acc
          else
            let word_tokens = Token_estimate.estimate word in
            loop (tokens + word_tokens) (word :: acc) rest
    in
    loop 0 [] (List.rev words)

let split_large_segment ~max_tokens ~overlap segment =
  let rec loop current current_tokens chunks = function
    | [] ->
        if trim current = "" then List.rev chunks
        else List.rev (trim current :: chunks)
    | word :: rest ->
        let token_count = Token_estimate.estimate (word ^ " ") in
        if current <> "" && current_tokens + token_count > max_tokens then
          let overlap = overlap_text current overlap in
          let next = if overlap = "" then word else overlap ^ " " ^ word in
          loop next (Token_estimate.estimate next) (trim current :: chunks) rest
        else
          let next = if current = "" then word else current ^ " " ^ word in
          loop next (current_tokens + token_count) chunks rest
  in
  loop "" 0 [] (words segment)

let split_text ?(overlap = 0) ?separator ~max_tokens text =
  if text = "" then []
  else if max_tokens <= 0 then [ text ]
  else if Token_estimate.estimate text <= max_tokens then [ text ]
  else
    let rec loop current current_tokens chunks = function
      | [] ->
          if trim current = "" then List.rev chunks
          else List.rev (trim current :: chunks)
      | segment :: rest ->
          let segment_tokens = Token_estimate.estimate segment in
          if segment_tokens > max_tokens then
            let flushed =
              if trim current = "" then chunks else trim current :: chunks
            in
            let large_chunks =
              split_large_segment ~max_tokens ~overlap segment
            in
            loop "" 0 (List.rev_append large_chunks flushed) rest
          else
            let added_tokens =
              current_tokens + segment_tokens + if current = "" then 0 else 1
            in
            if current <> "" && added_tokens > max_tokens then
              let overlap_text = overlap_text current overlap in
              let next =
                if overlap_text = "" then segment
                else overlap_text ^ " " ^ segment
              in
              loop next
                (Token_estimate.estimate next)
                (trim current :: chunks) rest
            else
              let next =
                if current = "" then segment else current ^ " " ^ segment
              in
              loop next added_tokens chunks rest
    in
    loop "" 0 [] (segments ?separator text)

let truncate_content ?(ellipsis = "...") ~max_tokens content =
  if content = "" then content
  else
    let tokens = Token_estimate.estimate content in
    if tokens <= max_tokens then content
    else
      let target_chars =
        int_of_float
          (floor
             (Float.of_int (String.length content)
             *. (Float.of_int (max 0 max_tokens) /. Float.of_int (max 1 tokens))
             ))
        - String.length ellipsis
      in
      if target_chars <= 0 then ellipsis
      else
        let truncated =
          String.sub content 0 (min target_chars (String.length content))
        in
        let last_space =
          try Some (String.rindex truncated ' ') with Not_found -> None
        in
        let truncated =
          match last_space with
          | Some index
            when Float.of_int index > Float.of_int target_chars *. 0.8 ->
              String.sub truncated 0 index
          | _ -> truncated
        in
        trim truncated ^ ellipsis

let fit_messages ?(provider = Message_budget.Openai) ~max_tokens
    ?(reserve_for_response = 0) messages =
  Message_budget.fit ~provider ~max_tokens ~reserve_for_response messages

let paginate_messages ?(provider = Message_budget.Openai) ~tokens_per_page
    messages =
  let rec loop current current_tokens pages = function
    | [] ->
        if current = [] then List.rev pages
        else List.rev (List.rev current :: pages)
    | message :: rest ->
        let message_tokens =
          Message_budget.estimate_message ~provider message
        in
        if current <> [] && current_tokens + message_tokens > tokens_per_page
        then loop [ message ] message_tokens (List.rev current :: pages) rest
        else
          loop (message :: current) (current_tokens + message_tokens) pages rest
  in
  loop [] 0 [] messages

let estimate_chunk_count ~chunk_size text =
  if text = "" || chunk_size <= 0 then 0
  else
    int_of_float
      (ceil
         (Float.of_int (Token_estimate.estimate text) /. Float.of_int chunk_size))
