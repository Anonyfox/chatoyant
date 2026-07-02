(** Typed JSON codecs that carry JSON Schema.

    A codec is the small bridge Chatoyant needs for ergonomic tool definitions:
    one value knows how to describe JSON with schema, decode incoming JSON into
    an OCaml value, and encode an OCaml value back to JSON. *)

type 'a t
type ('record, 'value) field

val schema : 'a t -> Schema.field

val custom :
  schema:Schema.field ->
  encode:('a -> Chatoyant_runtime.Json.t) ->
  decode:(Chatoyant_runtime.Json.t -> ('a, string) result) ->
  'a t
(** Build a codec from explicit schema/encoder/decoder pieces.

    This is primarily the low-level hook used by generated code and custom
    integrations. Prefer the typed builders or [chatoyant.ppx] in application
    code. *)

val map_schema : (Schema.field -> Schema.field) -> 'a t -> 'a t
(** Return an equivalent codec with its schema transformed. *)

val to_json_schema : 'a t -> Chatoyant_runtime.Json.t
val encode : 'a t -> 'a -> Chatoyant_runtime.Json.t
val decode : 'a t -> Chatoyant_runtime.Json.t -> ('a, string) result

val decode_field :
  string -> 'a t -> Chatoyant_runtime.Json.t -> ('a, string) result
(** Decode a field from a JSON object, respecting optional codecs. *)

val json : ?description:string -> unit -> Chatoyant_runtime.Json.t t
val string : ?description:string -> unit -> string t
val float : ?description:string -> unit -> float t
val int : ?description:string -> unit -> int t
val bool : ?description:string -> unit -> bool t
val string_enum : ?description:string -> string list -> string t
val array : ?description:string -> 'a t -> 'a list t
val optional : 'a t -> 'a option t

val field :
  string -> 'value t -> get:('record -> 'value) -> ('record, 'value) field

val object1 :
  ?description:string -> ('record, 'a) field -> ('a -> 'record) -> 'record t

val object2 :
  ?description:string ->
  ('record, 'a) field ->
  ('record, 'b) field ->
  ('a -> 'b -> 'record) ->
  'record t

val object3 :
  ?description:string ->
  ('record, 'a) field ->
  ('record, 'b) field ->
  ('record, 'c) field ->
  ('a -> 'b -> 'c -> 'record) ->
  'record t

val object4 :
  ?description:string ->
  ('record, 'a) field ->
  ('record, 'b) field ->
  ('record, 'c) field ->
  ('record, 'd) field ->
  ('a -> 'b -> 'c -> 'd -> 'record) ->
  'record t

val object5 :
  ?description:string ->
  ('record, 'a) field ->
  ('record, 'b) field ->
  ('record, 'c) field ->
  ('record, 'd) field ->
  ('record, 'e) field ->
  ('a -> 'b -> 'c -> 'd -> 'e -> 'record) ->
  'record t
