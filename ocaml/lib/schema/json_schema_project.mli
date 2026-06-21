(** Deterministic provider-oriented schema projections.

    These helpers derive provider-safe artifacts from a master JSON Schema.
    They never mutate the caller's schema in place. Unsupported constructs are
    preserved unless a projection needs to tighten an object for a known provider
    contract. *)

type warning = {
  path : string;
  message : string;
}

type result = {
  schema : Json_schema_ast.t;
  warnings : warning list;
}

val identity : Json_schema_ast.t -> result

(** OpenAI strict tool/structured-output projection.

    The projection recursively sets [additionalProperties: false] on object
    schemas that define [properties] and makes every declared property required,
    preserving existing required order and appending missing property names. The
    typed authoring layer is responsible for representing optional values as
    nullable schemas before projection. *)
val openai_strict : Json_schema_ast.t -> result
