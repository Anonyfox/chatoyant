(** Schema resource registry and [$ref] resolution.

    The resolver scans schema positions, registers resources introduced by
    [$id], and records [$anchor]/[$dynamicAnchor] names. It intentionally does
    no validation; it only answers where a reference points. *)

type target = {
  uri : string;
  base_uri : string;
  schema : Chatoyant_runtime.Json.t;
}

type resource = {
  uri : string;
  schema : Chatoyant_runtime.Json.t;
}

type t

val create : ?base_uri:string -> ?resources:resource list -> Chatoyant_runtime.Json.t -> t
val root : t -> Chatoyant_runtime.Json.t
val root_base_uri : t -> string
val child_base_uri : t -> base_uri:string -> Chatoyant_runtime.Json.t -> string
val resolve_uri : base_uri:string -> string -> string
val resolve : t -> base_uri:string -> string -> target option
val dynamic_anchors_for_resource : t -> string -> (string * target) list
val resolve_dynamic :
  t ->
  base_uri:string ->
  dynamic_scope:(string * target) list ->
  string ->
  target option
