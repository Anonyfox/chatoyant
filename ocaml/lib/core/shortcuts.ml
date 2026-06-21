module Make
    (Provider : Chatoyant_provider.Provider.CHAT)
    (Clock : Chatoyant_runtime.Effect.CLOCK) =
struct
  module Chat = Session.Make (Provider) (Clock)

  let build_chat ?system ?model prompt =
    let chat =
      match model with
      | None -> Chat.create ()
      | Some model -> Chat.create ~model ()
    in
    let chat =
      match system with
      | None -> chat
      | Some content -> Chat.system content chat
    in
    Chat.user prompt chat

  let gen_result ?system ?model ?options prompt =
    let chat = build_chat ?system ?model prompt in
    Chat.generate_with_result ?options chat

  let gen_text ?system ?model ?options prompt =
    match gen_result ?system ?model ?options prompt with
    | Error _ as err -> err
    | Ok result -> Ok result.Result.content

  let gen_stream_accumulate ?system ?model ?(options = Options.default) frames prompt =
    let chat = build_chat ?system ?model prompt in
    Chat.stream_accumulate ~options frames chat
end
