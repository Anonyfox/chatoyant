open Guide_steps

module Check (Eio_main : sig
  val run : (Eio_unix.Stdenv.base -> 'a) -> 'a
end) =
struct
  let () =
    Eio_main.run (fun env ->
        openai_call env;
        anthropic_call env;
        xai_call env)
end
