module Chat = Chatoyant_native.Chat

let print_text = function
  | Ok text -> print_endline text
  | Error error -> prerr_endline (Chatoyant.Error.provider error)

let openai_call env =
  let chat = Chat.openai ~model:"gpt-6.1-sol" env () in
  Chat.ask_text ~max_tokens:128 "Explain Eio cancellation in one sentence." chat
  |> print_text

let anthropic_call env =
  let chat = Chat.anthropic ~model:"claude-sonnet-5-5" env () in
  Chat.ask_text ~max_tokens:128 "Explain Eio cancellation in one sentence." chat
  |> print_text

let xai_call env =
  let chat = Chat.xai ~model:"grok-4.7" env () in
  Chat.ask_text ~max_tokens:128 "Explain Eio cancellation in one sentence." chat
  |> print_text

let balanced_openai env =
  let model =
    Chatoyant.Core.Preset.resolve_model_preset
      ~provider:Chatoyant.Provider.Provider.Openai
      Chatoyant.Core.Preset.Balanced
    |> Option.get
  in
  Chat.openai ~model env ()

let summarize chat text =
  Chat.ask_text ~max_tokens:256 ("Summarize this text:\n" ^ text) chat

let switch_provider env provider text =
  let chat =
    match provider with
    | `Openai -> Chat.openai ~model:"gpt-6.1-sol" env ()
    | `Anthropic -> Chat.anthropic ~model:"claude-sonnet-5-5" env ()
    | `Xai -> Chat.xai ~model:"grok-4.7" env ()
  in
  summarize chat text

let accumulate_stream chat (frames : Chatoyant.Core.Stream.frame list) =
  List.iter
    (fun (frame : Chatoyant.Core.Stream.frame) ->
      Option.iter
        (fun text ->
          print_string text;
          flush stdout)
        frame.content_delta)
    frames;
  Chat.stream_accumulate frames chat

type square_args = { value : int }

let square_args_codec =
  let open Chatoyant.Schema.Codec in
  object1
    (field "value" (int ()) ~get:(fun args -> args.value))
    (fun value -> { value })

let square_tool =
  Chatoyant.Core.Tool.create_typed ~name:"square"
    ~description:"Square an integer." ~args:square_args_codec
    ~result:(Chatoyant.Schema.Codec.int ()) (fun _context args ->
      Ok (args.value * args.value))

let tool_call env =
  let chat = Chat.openai ~model:"gpt-6.1-sol" env () in
  Chat.ask_text ~tools:[ square_tool ] ~max_tokens:256
    "Use square to calculate the square of 12." chat

type project = { language : string; uses_eio : bool }

let project_codec =
  let open Chatoyant.Schema.Codec in
  object2
    (field "language" (string ()) ~get:(fun p -> p.language))
    (field "uses_eio" (bool ()) ~get:(fun p -> p.uses_eio))
    (fun language uses_eio -> { language; uses_eio })

let structured_output env =
  let client = Chatoyant.openai ~model:"gpt-6.1-sol" env in
  Chatoyant.gen_data ~name:"project" ~strict:true ~codec:project_codec
    ~max_tokens:256 client "Describe an OCaml project using Eio."

let request_accounting env =
  let chat = Chat.openai ~model:"gpt-6.1-sol" env () in
  match Chat.ask ~max_tokens:128 "What is an Eio switch?" chat with
  | Error error -> prerr_endline (Chatoyant.Error.provider error)
  | Ok result ->
      Printf.printf
        "%s\ninput=%d output=%d cached=%d source=%s estimated=$%.6f\n"
        result.content result.usage.input_tokens result.usage.output_tokens
        result.usage.cached_tokens
        (Chatoyant.Tokens.Cost.source_to_string result.usage_source)
        result.cost.estimated_usd;
      Option.iter (Printf.printf "provider cost=$%.6f\n") result.cost.actual_usd

let pinned_anthropic env =
  Chat.anthropic ~model:"claude-sonnet-5-5" ~anthropic_version:"2023-06-01" env
    ()

let handle_text_result = function
  | Ok text -> print_endline text
  | Error (Chatoyant.Provider.Provider.Missing_api_key { env_key; _ }) ->
      Printf.eprintf "Set %s before generating.\n" env_key
  | Error (Chatoyant.Provider.Provider.Http_error { status; _ }) ->
      Printf.eprintf "Provider returned HTTP %d.\n" status
  | Error error -> prerr_endline (Chatoyant.Error.provider error)
