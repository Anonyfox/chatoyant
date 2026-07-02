(** Schema-backed callable tools. *)

type context = { model : string; provider : Chatoyant_provider.Provider.id }
type call = { id : string; name : string; arguments : Chatoyant_runtime.Json.t }

type result = {
  id : string;
  ok : bool;
  value : Chatoyant_runtime.Json.t option;
  error : string option;
}

type t

val create :
  name:string ->
  description:string ->
  parameters:Chatoyant_schema.Schema.field ->
  ?result_schema:Chatoyant_schema.Schema.field ->
  (context ->
  Chatoyant_runtime.Json.t ->
  (Chatoyant_runtime.Json.t, string) Stdlib.result) ->
  t

val create_typed :
  name:string ->
  description:string ->
  args:'args Chatoyant_schema.Codec.t ->
  result:'result Chatoyant_schema.Codec.t ->
  (context -> 'args -> ('result, string) Stdlib.result) ->
  t
(** Create a schema-backed tool from typed argument/result codecs. *)

val name : t -> string
val description : t -> string
val parameters : t -> Chatoyant_schema.Schema.field
val json_schema : t -> Chatoyant_runtime.Json.t
val to_provider_definition : t -> Chatoyant_provider.Provider.tool_definition
val execute_call : context -> call -> t -> result
val call_to_json : call -> Chatoyant_runtime.Json.t
val result_to_json : result -> Chatoyant_runtime.Json.t

module Args : sig
  val ( let* ) :
    ('a, string) Stdlib.result ->
    ('a -> ('b, string) Stdlib.result) ->
    ('b, string) Stdlib.result
  (** Result bind for compact tool argument decoding. *)

  val field :
    string ->
    Chatoyant_runtime.Json.t ->
    (Chatoyant_runtime.Json.t, string) Stdlib.result

  val string :
    string -> Chatoyant_runtime.Json.t -> (string, string) Stdlib.result

  val float :
    string -> Chatoyant_runtime.Json.t -> (float, string) Stdlib.result

  val int : string -> Chatoyant_runtime.Json.t -> (int, string) Stdlib.result
  val bool : string -> Chatoyant_runtime.Json.t -> (bool, string) Stdlib.result

  val object_ :
    string ->
    Chatoyant_runtime.Json.t ->
    ((string * Chatoyant_runtime.Json.t) list, string) Stdlib.result

  val list :
    string ->
    Chatoyant_runtime.Json.t ->
    (Chatoyant_runtime.Json.t list, string) Stdlib.result

  val optional :
    (string -> Chatoyant_runtime.Json.t -> ('a, string) Stdlib.result) ->
    string ->
    Chatoyant_runtime.Json.t ->
    ('a option, string) Stdlib.result
  (** [optional decode name json] returns [Ok None] for missing or null fields.
  *)
end

(** Small constructors for tool results. *)
module Json : sig
  val null : Chatoyant_runtime.Json.t
  val string : string -> Chatoyant_runtime.Json.t
  val float : float -> Chatoyant_runtime.Json.t
  val int : int -> Chatoyant_runtime.Json.t
  val bool : bool -> Chatoyant_runtime.Json.t

  val object_ :
    (string * Chatoyant_runtime.Json.t) list -> Chatoyant_runtime.Json.t

  val array : Chatoyant_runtime.Json.t list -> Chatoyant_runtime.Json.t
end
