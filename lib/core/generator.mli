(** Provider-functor generation orchestration. *)

module Make
    (Provider : Chatoyant_provider.Provider.CHAT)
    (Clock : Chatoyant_runtime.Effect.CLOCK) : sig
  val generate :
    ?options:Options.t ->
    Chat.t ->
    (Result.generation, Chatoyant_provider.Provider.error) result
end

(** Generation with the original provider response alongside its projection. *)
module Make_with_raw
    (Provider : Chatoyant_provider.Provider.CHAT)
    (Clock : Chatoyant_runtime.Effect.CLOCK) : sig
  val generate_with_raw :
    ?options:Options.t ->
    Chat.t ->
    ( Result.generation * Chatoyant_runtime.Json.t option,
      Chatoyant_provider.Provider.error )
    result
  (** Generate while retaining the provider response for faithful assistant
      replay. The ordinary result remains the provider-neutral projection. *)
end
