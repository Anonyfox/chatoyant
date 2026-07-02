type event = { event : string option; data : string list }
type state = { buffer : string }

let empty = { buffer = "" }

let normalize_newlines input =
  input |> String.split_on_char '\r' |> String.concat ""

let split_complete_frames buffer =
  let normalized = normalize_newlines buffer in
  let rec scan acc start =
    let rec find_separator index =
      if index + 1 >= String.length normalized then None
      else if normalized.[index] = '\n' && normalized.[index + 1] = '\n' then
        Some index
      else find_separator (index + 1)
    in
    match find_separator start with
    | None ->
        ( List.rev acc,
          String.sub normalized start (String.length normalized - start) )
    | Some index ->
        let frame = String.sub normalized start (index - start) in
        scan (frame :: acc) (index + 2)
  in
  scan [] 0

let parse_line (event, data) line =
  if line = "" || line.[0] = ':' then (event, data)
  else
    match String.index_opt line ':' with
    | None -> if line = "event" then (Some "", data) else (event, data)
    | Some index ->
        let name = String.sub line 0 index in
        let value_start =
          if index + 1 < String.length line && line.[index + 1] = ' ' then
            index + 2
          else index + 1
        in
        let value =
          String.sub line value_start (String.length line - value_start)
        in
        if name = "event" then (Some value, data)
        else if name = "data" then (event, data @ [ value ])
        else (event, data)

let parse_frame frame =
  let event, data =
    frame |> String.split_on_char '\n' |> List.fold_left parse_line (None, [])
  in
  { event; data }

let feed state chunk =
  let frames, remaining = split_complete_frames (state.buffer ^ chunk) in
  ({ buffer = remaining }, List.map parse_frame frames)

let finish state =
  if state.buffer = "" then [] else [ parse_frame state.buffer ]

let data_string event = String.concat "\n" event.data
let is_done event = String.trim (data_string event) = "[DONE]"
