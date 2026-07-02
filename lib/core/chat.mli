(** Stateful provider-neutral chat container.

    This module owns conversation state only. Provider execution will be layered
    through functors/adapters so that raw provider clients remain independently
    testable. *)

type t

val create : ?model:string -> ?defaults:Options.t -> unit -> t
val model : t -> string
val messages : t -> Message.t list
val tools : t -> Tool.t list
val add_message : Message.t -> t -> t
val add_tool : Tool.t -> t -> t
val system : string -> t -> t
val user : string -> t -> t
val assistant : string -> t -> t
val clear_messages : t -> t
val clear_tools : t -> t
