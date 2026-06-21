(** Portable regular-expression matcher.

    JSON Schema patterns are ECMAScript regular expressions. The core keeps this
    interface tiny so native and Melange backends can grow a stronger engine
    later. The current implementation handles the regular-expression forms used
    by the required test coverage and common tool schemas: anchors, literals,
    dot, simple character classes, \{m,\} repeats, [*], [+], and [\p{Letter}]. *)

val matches : pattern:string -> string -> bool
