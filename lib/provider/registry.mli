(** Provider registry and model-name detection. *)

type meta = {
  id : Provider.id;
  name : string;
  signatures : string list;
  env_key : string;
  legacy_env_key : string option;
  base_url : string option;
}

val all : meta list
val find : Provider.id -> meta
val detect_by_model : string -> Provider.id option
val resolve_by_model : local_active:bool -> string -> Provider.id option
val env_keys : Provider.id -> string * string option
val base_url : Provider.id -> string option
