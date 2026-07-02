type provider = Openai | Anthropic | Xai
type message = { role : string; content : string option; name : string option }
type overhead = { per_message : int; conversation : int }

let overhead = function Openai -> (4, 3) | Anthropic -> (3, 3) | Xai -> (4, 3)

let get_overhead ?(provider = Openai) () =
  let per_message, conversation = overhead provider in
  { per_message; conversation }

let estimate_message ?(provider = Openai) message =
  let per_message, _ = overhead provider in
  let content_tokens =
    match message.content with
    | None -> 0
    | Some content -> Token_estimate.estimate content
  in
  let name_tokens =
    match message.name with
    | None -> 0
    | Some name -> Token_estimate.estimate name + 1
  in
  per_message + content_tokens + name_tokens

let estimate_chat ?(provider = Openai) messages =
  if messages = [] then 0
  else
    let _, conversation = overhead provider in
    List.fold_left
      (fun total message -> total + estimate_message ~provider message)
      conversation messages

let estimate_system_prompt ?(provider = Openai) system_prompt =
  estimate_message ~provider
    { role = "system"; content = Some system_prompt; name = None }

let available_tokens ~context_window ?(system_prompt_tokens = 0)
    ?(reserve_for_response = 0) ?(history_tokens = 0) () =
  max 0
    (context_window - system_prompt_tokens - reserve_for_response
   - history_tokens)

let fits ?(provider = Openai) ~max_tokens messages =
  estimate_chat ~provider messages <= max_tokens

let fit ?(provider = Openai) ~max_tokens ~reserve_for_response messages =
  let budget = max 0 (max_tokens - reserve_for_response) in
  let system, rest =
    match messages with
    | message :: rest when message.role = "system" -> (Some message, rest)
    | _ -> (None, messages)
  in
  let system_tokens =
    match system with
    | None -> 0
    | Some message -> estimate_message ~provider message
  in
  let remaining = budget - system_tokens in
  if remaining <= 0 then Option.to_list system
  else
    let rec take_recent used kept = function
      | [] -> kept
      | message :: older ->
          let tokens = estimate_message ~provider message in
          if used + tokens > remaining then kept
          else take_recent (used + tokens) (message :: kept) older
    in
    let recent = take_recent 0 [] (List.rev rest) in
    Option.to_list system @ recent
