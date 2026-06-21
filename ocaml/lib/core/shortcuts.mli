(** One-shot convenience functions built on {!Session}.

    These mirror the helpful JavaScript shortcuts while staying runtime-effect
    independent through provider and clock functors. *)

module Make
    (Provider : Chatoyant_provider.Provider.CHAT)
    (Clock : Chatoyant_runtime.Effect.CLOCK) : sig
  val gen_result :
    ?system:string ->
    ?model:string ->
    ?options:Options.t ->
    string ->
    (Result.generation, Chatoyant_provider.Provider.error) result

  val gen_text :
    ?system:string ->
    ?model:string ->
    ?options:Options.t ->
    string ->
    (string, Chatoyant_provider.Provider.error) result

  val gen_stream_accumulate :
    ?system:string ->
    ?model:string ->
    ?options:Options.t ->
    Stream.frame list ->
    string ->
    Result.generation
end
