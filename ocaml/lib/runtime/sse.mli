(** Server-sent events parsing for provider streams.

    The parser is incremental and keeps incomplete frames in [state]. It returns
    only complete events. Provider modules decode event data according to their
    own stream schemas. *)

type event = {
  event : string option;
  data : string list;
}

type state

val empty : state
val feed : state -> string -> state * event list
val finish : state -> event list
val is_done : event -> bool
val data_string : event -> string
