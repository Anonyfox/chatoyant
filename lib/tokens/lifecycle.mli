(** First-party API lifecycle information for model ids. *)

type status = Active | Deprecated | Retired

type info = {
  status : status;
  deprecated_on : string option;
  retires_on : string option;
  replacement : string option;
  note : string option;
}

val lifecycle : string -> info option
(** Look up a model or its dated snapshot. Dates use YYYY-MM-DD. *)

val warning : string -> string option
(** Describe a recorded deprecation or retirement. *)

val set_warning_handler : (string -> unit) -> unit
(** Set the request warning handler. The default writes to stderr. Pass [ignore]
    to silence warnings. *)

val warn_once : string -> unit
(** Deliver at most one lifecycle warning per case-normalized model id. *)
