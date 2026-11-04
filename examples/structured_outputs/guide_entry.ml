open Guide_steps

module Check (Eio_main : sig
  val run : (Eio_unix.Stdenv.base -> 'a) -> 'a
end) =
struct
  let () = Eio_main.run extract_invoice
end
