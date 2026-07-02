(** Provider-functor generation orchestration. *)

module Make
    (Provider : Chatoyant_provider.Provider.CHAT)
    (Clock : Chatoyant_runtime.Effect.CLOCK) : sig
  val generate :
    ?options:Options.t ->
    Chat.t ->
    (Result.generation, Chatoyant_provider.Provider.error) result
end
