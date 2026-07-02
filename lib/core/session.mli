(** Stateful Chat API mirroring the ergonomic JavaScript [Chat] class.

    This module is intentionally implemented in OCaml rather than JavaScript
    glue. Runtime effects still enter through provider and clock functors. *)

type t

module Make
    (Provider : Chatoyant_provider.Provider.CHAT)
    (Clock : Chatoyant_runtime.Effect.CLOCK) : sig
  val create : ?model:string -> ?defaults:Options.t -> unit -> t
  val model : t -> string
  val set_model : string -> t -> t
  val messages : t -> Message.t list
  val tools : t -> Tool.t list
  val last_result : t -> Result.generation option
  val system : string -> t -> t
  val user : string -> t -> t
  val assistant : string -> t -> t
  val add_message : Message.t -> t -> t
  val add_messages : Message.t list -> t -> t
  val clear_messages : t -> t
  val add_tool : Tool.t -> t -> t
  val add_tools : Tool.t list -> t -> t
  val clear_tools : t -> t

  val generate_with_result :
    ?options:Options.t ->
    t ->
    (Result.generation, Chatoyant_provider.Provider.error) result

  val generate :
    ?options:Options.t ->
    t ->
    (string, Chatoyant_provider.Provider.error) result

  val stream_accumulate :
    ?options:Options.t -> Stream.frame list -> t -> Result.generation

  val to_json : t -> Chatoyant_runtime.Json.t
  val stringify : ?pretty:bool -> t -> string
  val load_json : Chatoyant_runtime.Json.t -> t -> (t, string) result
  val of_json : Chatoyant_runtime.Json.t -> (t, string) result
  val clone : t -> t
  val fork : t -> t
end
