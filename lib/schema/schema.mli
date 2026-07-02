(** Typed schema descriptors used for structured outputs and tool arguments.

    This first layer models schema metadata explicitly. Later increments can add
    richer typed builders and generated/proxied ergonomics without changing the
    provider-facing JSON Schema contract. *)

type string_format =
  | Date_time
  | Date
  | Time
  | Duration
  | Email
  | Hostname
  | Ipv4
  | Ipv6
  | Uri
  | Uuid
  | Regex
  | Custom of string

type field =
  | String of string_options
  | Number of number_options
  | Integer of number_options
  | Boolean of boolean_options
  | Null of base_options
  | Array of array_options
  | Object of object_options
  | Enum of enum_options
  | Literal of literal_options

and base_options = { description : string option; optional : bool }

and string_options = {
  string_base : base_options;
  string_default : string option;
  min_length : int option;
  max_length : int option;
  pattern : string option;
  format : string_format option;
}

and number_options = {
  number_base : base_options;
  number_default : float option;
  minimum : float option;
  maximum : float option;
  exclusive_minimum : float option;
  exclusive_maximum : float option;
  multiple_of : float option;
}

and boolean_options = {
  boolean_base : base_options;
  boolean_default : bool option;
}

and array_options = {
  array_base : base_options;
  items : field;
  min_items : int option;
  max_items : int option;
  unique_items : bool option;
}

and object_options = {
  object_base : base_options;
  fields : (string * field) list;
}

and enum_options = {
  enum_base : base_options;
  values : Chatoyant_runtime.Json.t list;
  enum_default : Chatoyant_runtime.Json.t option;
}

and literal_options = {
  literal_base : base_options;
  value : Chatoyant_runtime.Json.t;
}

val base : ?description:string -> ?optional:bool -> unit -> base_options

val string :
  ?description:string ->
  ?optional:bool ->
  ?default:string ->
  ?min_length:int ->
  ?max_length:int ->
  ?pattern:string ->
  ?format:string_format ->
  unit ->
  field

val number :
  ?description:string ->
  ?optional:bool ->
  ?default:float ->
  ?minimum:float ->
  ?maximum:float ->
  ?exclusive_minimum:float ->
  ?exclusive_maximum:float ->
  ?multiple_of:float ->
  unit ->
  field

val integer :
  ?description:string ->
  ?optional:bool ->
  ?default:int ->
  ?minimum:int ->
  ?maximum:int ->
  unit ->
  field

val boolean :
  ?description:string -> ?optional:bool -> ?default:bool -> unit -> field

val null : ?description:string -> ?optional:bool -> unit -> field
val array : ?description:string -> ?optional:bool -> field -> field

val object_ :
  ?description:string -> ?optional:bool -> (string * field) list -> field

val enum :
  ?description:string ->
  ?optional:bool ->
  Chatoyant_runtime.Json.t list ->
  field

val literal :
  ?description:string -> ?optional:bool -> Chatoyant_runtime.Json.t -> field

val with_description : string option -> field -> field
(** Replace the human-readable description on a schema field. *)

val with_array_constraints :
  ?min_items:int -> ?max_items:int -> ?unique_items:bool -> field -> field
(** Apply array-specific validation constraints when [field] is an array. *)

val with_string_constraints :
  ?min_length:int -> ?max_length:int -> ?pattern:string -> field -> field
(** Apply string-specific validation constraints when [field] is a string. *)

val with_number_constraints : ?minimum:float -> ?maximum:float -> field -> field
(** Apply numeric validation constraints when [field] is a number or integer. *)

val is_optional : field -> bool
(** Whether a field can be omitted or supplied as JSON null. *)

val to_json_schema : field -> Chatoyant_runtime.Json.t
(** Convert a field to JSON Schema draft-compatible JSON. *)
