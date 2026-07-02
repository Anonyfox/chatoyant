(** Effect signatures used to keep pure SDK logic independent from runtime IO.

    Native OCaml, Node.js through Melange, browsers, and tests should provide
    modules matching these signatures. Core/provider modules should depend on
    signatures through functors instead of reaching directly for global
    primitives. *)

module type ENV = sig
  val get : string -> string option
end

module type CLOCK = sig
  val now_ms : unit -> int
end

module type HTTP = sig
  type multipart_part = {
    name : string;
    filename : string option;
    content_type : string option;
    body : string;
  }

  type body =
    | Empty
    | Text of string
    | Json of Json.t
    | Multipart of multipart_part list

  type request = {
    method_ : string;
    url : string;
    headers : (string * string) list;
    body : body;
    timeout_ms : int option;
  }

  type response = {
    status : int;
    headers : (string * string) list;
    body : string;
  }

  type error = Timeout of int | Network of string | Invalid_response of string

  val send : request -> (response, error) result
end

module type WEBSOCKET = sig
  type message = Text of string | Binary of string
  type close = { code : int; reason : string }

  type request = {
    url : string;
    headers : (string * string) list;
    protocols : string list;
    timeout_ms : int option;
  }

  type error =
    | Timeout of int
    | Network of string
    | Invalid_response of string
    | Closed of close option

  type connection

  val with_connection : request -> (connection -> 'a) -> ('a, error) result
  (** Open a WebSocket, run the callback while the connection is alive, then
      close the socket. The callback style keeps runtime resources scoped to
      their Eio switch while provider modules remain functorized and testable.
  *)

  val send : connection -> message -> (unit, error) result
  val recv : connection -> (message, error) result
  val close : ?code:int -> ?reason:string -> connection -> (unit, error) result
end
