module Clock = struct
  let make ~clock =
    (module struct
      let now_ms () = Eio.Time.now clock *. 1000. |> Float.round |> int_of_float
    end : Chatoyant_runtime.Effect.CLOCK)
end

module Env = struct
  let get = Sys.getenv_opt
end

module Http = struct
  type multipart_part = {
    name : string;
    filename : string option;
    content_type : string option;
    body : string;
  }

  type body =
    | Empty
    | Text of string
    | Json of Chatoyant_runtime.Json.t
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

  let error_to_string = function
    | Timeout ms -> Printf.sprintf "timeout after %d ms" ms
    | Network message -> "network error: " ^ message
    | Invalid_response message -> "invalid response: " ^ message

  module type EFFECT =
    Chatoyant_runtime.Effect.HTTP
      with type multipart_part = multipart_part
       and type body = body
       and type request = request
       and type response = response
       and type error = error

  type client_certificate = {
    certificate_pem : string;
    private_key_pem : string;
    authenticator : X509.Authenticator.t option;
  }

  type https =
    | System
    | Authenticator of X509.Authenticator.t
    | Mutual_tls of client_certificate
    | Tls_config of Tls.Config.client
    | Disabled

  let default_max_response_size = 100 * 1024 * 1024

  let tls_config ?authenticator () =
    let authenticator =
      match authenticator with
      | Some authenticator -> Ok authenticator
      | None -> Ca_certs.authenticator ()
    in
    match authenticator with
    | Error (`Msg message) -> Error message
    | Ok authenticator -> (
        match Tls.Config.client ~authenticator () with
        | Ok config -> Ok config
        | Error (`Msg message) -> Error message)

  let mtls_config ?authenticator ~certificate_pem ~private_key_pem () =
    let authenticator =
      match authenticator with
      | Some authenticator -> Ok authenticator
      | None -> Ca_certs.authenticator ()
    in
    match authenticator with
    | Error (`Msg message) -> Error message
    | Ok authenticator -> (
        match
          ( X509.Certificate.decode_pem_multiple certificate_pem,
            X509.Private_key.decode_pem private_key_pem )
        with
        | Error (`Msg message), _ | _, Error (`Msg message) -> Error message
        | Ok certificates, Ok private_key -> (
            match
              Tls.Config.client ~authenticator
                ~certificates:(`Single (certificates, private_key))
                ()
            with
            | Ok config -> Ok config
            | Error (`Msg message) -> Error message))

  let tls_config_exn mode =
    match mode with
    | Disabled -> None
    | Tls_config config -> Some config
    | Mutual_tls cert -> (
        match
          mtls_config ?authenticator:cert.authenticator
            ~certificate_pem:cert.certificate_pem
            ~private_key_pem:cert.private_key_pem ()
        with
        | Ok config -> Some config
        | Error message -> invalid_arg ("Chatoyant.Http: " ^ message))
    | Authenticator authenticator -> (
        match tls_config ~authenticator () with
        | Ok config -> Some config
        | Error message -> invalid_arg ("Chatoyant.Http: " ^ message))
    | System -> (
        match tls_config () with
        | Ok config -> Some config
        | Error message -> invalid_arg ("Chatoyant.Http: " ^ message))

  let https_wrapper config uri raw =
    let host =
      Uri.host uri
      |> Option.map (fun value -> Domain_name.(host_exn (of_string_exn value)))
    in
    Tls_eio.client_of_flow config ?host raw

  let lower_ascii value = value |> String.lowercase_ascii

  let has_header name headers =
    let expected = lower_ascii name in
    List.exists (fun (key, _) -> lower_ascii key = expected) headers

  let add_header_unless_exists name value headers =
    if has_header name headers then headers else (name, value) :: headers

  let multipart_boundary () =
    "chatoyant-eio-"
    ^ Int.to_string (Random.bits ())
    ^ Int.to_string (Random.bits ())

  let escape_disposition_value value =
    let buffer = Buffer.create (String.length value) in
    String.iter
      (function
        | '"' -> Buffer.add_string buffer "\\\""
        | '\\' -> Buffer.add_string buffer "\\\\"
        | '\r' | '\n' -> Buffer.add_char buffer '_'
        | char -> Buffer.add_char buffer char)
      value;
    Buffer.contents buffer

  let make ?(https = System) ?(max_response_size = default_max_response_size)
      ~net ~clock () =
    Mirage_crypto_rng_unix.use_default ();
    let https =
      tls_config_exn https |> Option.map (fun config -> https_wrapper config)
    in
    (module struct
      type nonrec multipart_part = multipart_part = {
        name : string;
        filename : string option;
        content_type : string option;
        body : string;
      }

      type nonrec body = body =
        | Empty
        | Text of string
        | Json of Chatoyant_runtime.Json.t
        | Multipart of multipart_part list

      type nonrec request = request = {
        method_ : string;
        url : string;
        headers : (string * string) list;
        body : body;
        timeout_ms : int option;
      }

      type nonrec response = response = {
        status : int;
        headers : (string * string) list;
        body : string;
      }

      type nonrec error = error =
        | Timeout of int
        | Network of string
        | Invalid_response of string

      let client = Cohttp_eio.Client.make ~https net

      let encode_multipart parts =
        let boundary = multipart_boundary () in
        let buffer = Buffer.create 1024 in
        let add = Buffer.add_string buffer in
        let add_header name value =
          add name;
          add ": ";
          add value;
          add "\r\n"
        in
        let add_part part =
          add "--";
          add boundary;
          add "\r\n";
          let disposition =
            match part.filename with
            | None ->
                "form-data; name=\"" ^ escape_disposition_value part.name ^ "\""
            | Some filename ->
                "form-data; name=\""
                ^ escape_disposition_value part.name
                ^ "\"; filename=\""
                ^ escape_disposition_value filename
                ^ "\""
          in
          add_header "Content-Disposition" disposition;
          (match part.content_type with
          | None -> ()
          | Some content_type -> add_header "Content-Type" content_type);
          add "\r\n";
          add part.body;
          add "\r\n"
        in
        List.iter add_part parts;
        add "--";
        add boundary;
        add "--\r\n";
        (boundary, Buffer.contents buffer)

      let prepare_body headers body =
        match body with
        | Empty -> (headers, None)
        | Text text -> (headers, Some (Cohttp_eio.Body.of_string text))
        | Json json ->
            let headers =
              add_header_unless_exists "content-type" "application/json" headers
            in
            ( headers,
              Some
                (json |> Chatoyant_runtime.Json.to_string
               |> Cohttp_eio.Body.of_string) )
        | Multipart parts ->
            let boundary, body = encode_multipart parts in
            let headers =
              add_header_unless_exists "content-type"
                ("multipart/form-data; boundary=" ^ boundary)
                headers
            in
            (headers, Some (Cohttp_eio.Body.of_string body))

      let perform request =
        try
          let uri = Uri.of_string request.url in
          let headers, body = prepare_body request.headers request.body in
          let headers = Http.Header.of_list headers in
          Eio.Switch.run @@ fun sw ->
          let response, body =
            Cohttp_eio.Client.call client ~sw ~headers ?body
              (Http.Method.of_string request.method_)
              uri
          in
          let body =
            body
            |> Eio.Buf_read.of_flow ~max_size:max_response_size
            |> Eio.Buf_read.take_all
          in
          Ok
            {
              status = response |> Http.Response.status |> Http.Status.to_int;
              headers = response |> Http.Response.headers |> Http.Header.to_list;
              body;
            }
        with
        | Eio.Time.Timeout -> raise Eio.Time.Timeout
        | Failure message | Invalid_argument message ->
            Error (Invalid_response message)
        | exn -> Error (Network (Printexc.to_string exn))

      let send request =
        match request.timeout_ms with
        | Some timeout_ms when timeout_ms > 0 -> (
            let seconds = float_of_int timeout_ms /. 1000. in
            try
              Eio.Time.with_timeout_exn clock seconds (fun () ->
                  perform request)
            with Eio.Time.Timeout -> Error (Timeout timeout_ms))
        | _ -> perform request
    end : EFFECT)

  let send ?https ?max_response_size ~net ~clock request =
    let module Http = (val make ?https ?max_response_size ~net ~clock ()) in
    Http.send request

  let get ?https ?max_response_size ?(headers = []) ?timeout_ms ~net ~clock url
      =
    send ?https ?max_response_size ~net ~clock
      { method_ = "GET"; url; headers; body = Empty; timeout_ms }

  let get_json ?https ?max_response_size ?headers ?timeout_ms ~net ~clock url =
    match
      get ?https ?max_response_size ?headers ?timeout_ms ~net ~clock url
    with
    | Error _ as err -> err
    | Ok response when response.status < 200 || response.status >= 300 ->
        Error
          (Invalid_response
             (Printf.sprintf "HTTP %d: %s" response.status response.body))
    | Ok response -> (
        match Chatoyant_runtime.Json.parse response.body with
        | Ok json -> Ok json
        | Error message -> Error (Invalid_response message))

  let post_json ?https ?max_response_size ?(headers = []) ?timeout_ms ~net
      ~clock url json =
    send ?https ?max_response_size ~net ~clock
      { method_ = "POST"; url; headers; body = Json json; timeout_ms }
end

module Websocket = struct
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

  type connection =
    | Connection : {
        flow : 'flow Eio.Flow.two_way;
        reader : Eio.Buf_read.t;
        max_frame_size : int;
        mutable closed : close option;
      }
        -> connection

  let error_to_string = function
    | Timeout ms -> Printf.sprintf "timeout after %d ms" ms
    | Network message -> "network error: " ^ message
    | Invalid_response message -> "invalid response: " ^ message
    | Closed None -> "websocket closed"
    | Closed (Some close) ->
        Printf.sprintf "websocket closed with code %d: %s" close.code
          close.reason

  module type EFFECT =
    Chatoyant_runtime.Effect.WEBSOCKET
      with type message = message
       and type close = close
       and type request = request
       and type error = error

  let default_max_frame_size = 64 * 1024 * 1024
  let websocket_guid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
  let lower_ascii = String.lowercase_ascii

  let header name headers =
    let expected = lower_ascii name in
    headers
    |> List.find_opt (fun (key, _) -> lower_ascii key = expected)
    |> Option.map snd

  let contains_token token value =
    value |> String.split_on_char ','
    |> List.exists (fun item -> lower_ascii (String.trim item) = token)

  let random_key () =
    Mirage_crypto_rng_unix.use_default ();
    Mirage_crypto_rng.generate 16 |> Base64.encode_string

  let expected_accept key =
    Digestif.SHA1.digest_string (key ^ websocket_guid)
    |> Digestif.SHA1.to_raw_string |> Base64.encode_string

  let host_header uri =
    let host = Option.value (Uri.host uri) ~default:"" in
    match Uri.port uri with
    | None -> host
    | Some port -> host ^ ":" ^ string_of_int port

  let endpoint uri =
    let path = Uri.path_and_query uri in
    if path = "" then "/" else path

  let write_flow flow data = Eio.Flow.copy_string data flow

  let handshake flow reader request uri key =
    let host = host_header uri in
    let protocol_headers =
      match request.protocols with
      | [] -> []
      | protocols ->
          [ ("Sec-WebSocket-Protocol", String.concat ", " protocols) ]
    in
    let headers =
      [
        ("Host", host);
        ("Upgrade", "websocket");
        ("Connection", "Upgrade");
        ("Sec-WebSocket-Key", key);
        ("Sec-WebSocket-Version", "13");
      ]
      @ protocol_headers @ request.headers
    in
    let request_text =
      "GET " ^ endpoint uri ^ " HTTP/1.1\r\n"
      ^ (headers
        |> List.map (fun (name, value) -> name ^ ": " ^ value ^ "\r\n")
        |> String.concat "")
      ^ "\r\n"
    in
    write_flow flow request_text;
    let status = Eio.Buf_read.line reader in
    let rec read_headers acc =
      match Eio.Buf_read.line reader with
      | "" -> List.rev acc
      | line -> (
          match String.index_opt line ':' with
          | None -> read_headers acc
          | Some index ->
              let name = String.sub line 0 index |> String.trim in
              let value =
                String.sub line (index + 1) (String.length line - index - 1)
                |> String.trim
              in
              read_headers ((name, value) :: acc))
    in
    let response_headers = read_headers [] in
    if
      not
        (String.starts_with ~prefix:"HTTP/" status && String.contains status '1')
    then Error (Invalid_response ("invalid websocket status line: " ^ status))
    else if not (String.contains status ' ') then
      Error (Invalid_response ("invalid websocket status line: " ^ status))
    else if not (String.contains status '1' && String.contains status '0') then
      Error (Invalid_response ("websocket upgrade failed: " ^ status))
    else
      let status_code =
        match String.split_on_char ' ' status with
        | _http :: code :: _ -> code
        | _ -> ""
      in
      if status_code <> "101" then
        Error (Invalid_response ("websocket upgrade failed: " ^ status))
      else
        match
          ( header "upgrade" response_headers,
            header "connection" response_headers,
            header "sec-websocket-accept" response_headers )
        with
        | Some upgrade, Some connection, Some accept
          when lower_ascii upgrade = "websocket"
               && contains_token "upgrade" connection
               && String.trim accept = expected_accept key ->
            Ok ()
        | _ -> Error (Invalid_response "invalid websocket upgrade response")

  let byte value = String.make 1 (Char.chr (value land 0xff))
  let uint16 value = byte (value lsr 8) ^ byte value

  let uint64 value =
    let buffer = Bytes.create 8 in
    for index = 0 to 7 do
      let shift = (7 - index) * 8 in
      Bytes.set buffer index
        (Char.chr
           (Int64.to_int (Int64.shift_right_logical value shift) land 0xff))
    done;
    Bytes.unsafe_to_string buffer

  let mask_payload mask payload =
    let bytes = Bytes.of_string payload in
    for index = 0 to Bytes.length bytes - 1 do
      let masked =
        Char.code (Bytes.get bytes index) lxor Char.code mask.[index mod 4]
      in
      Bytes.set bytes index (Char.chr masked)
    done;
    Bytes.unsafe_to_string bytes

  let frame ?(mask = true) opcode payload =
    let len = String.length payload in
    let length_header =
      if len < 126 then byte ((if mask then 0x80 else 0) lor len)
      else if len <= 0xffff then
        byte ((if mask then 0x80 else 0) lor 126) ^ uint16 len
      else byte ((if mask then 0x80 else 0) lor 127) ^ uint64 (Int64.of_int len)
    in
    let first = byte (0x80 lor opcode) in
    if mask then
      let mask_key = Mirage_crypto_rng.generate 4 in
      first ^ length_header ^ mask_key ^ mask_payload mask_key payload
    else first ^ length_header ^ payload

  let close_payload code reason = uint16 code ^ reason

  let send_frame (Connection connection) opcode payload =
    if Option.is_some connection.closed then Error (Closed connection.closed)
    else
      try
        write_flow connection.flow (frame opcode payload);
        Ok ()
      with exn -> Error (Network (Printexc.to_string exn))

  let send connection = function
    | Text text -> send_frame connection 0x1 text
    | Binary bytes -> send_frame connection 0x2 bytes

  let parse_close payload =
    if String.length payload < 2 then { code = 1005; reason = "" }
    else
      let code = (Char.code payload.[0] lsl 8) lor Char.code payload.[1] in
      let reason = String.sub payload 2 (String.length payload - 2) in
      { code; reason }

  let rec read_frame (Connection connection as conn) =
    try
      let first = Eio.Buf_read.uint8 connection.reader in
      let second = Eio.Buf_read.uint8 connection.reader in
      let fin = first land 0x80 <> 0 in
      let opcode = first land 0x0f in
      let masked = second land 0x80 <> 0 in
      let length_code = second land 0x7f in
      let length =
        match length_code with
        | value when value < 126 -> Int64.of_int value
        | 126 -> Int64.of_int (Eio.Buf_read.BE.uint16 connection.reader)
        | 127 -> Eio.Buf_read.BE.uint64 connection.reader
        | _ -> 0L
      in
      if length > Int64.of_int connection.max_frame_size then
        Error (Invalid_response "websocket frame exceeds max_frame_size")
      else
        let mask =
          if masked then Some (Eio.Buf_read.take 4 connection.reader) else None
        in
        let payload =
          Eio.Buf_read.take (Int64.to_int length) connection.reader
        in
        let payload =
          match mask with
          | None -> payload
          | Some mask -> mask_payload mask payload
        in
        match opcode with
        | 0x8 ->
            let close = parse_close payload in
            connection.closed <- Some close;
            Error (Closed (Some close))
        | 0x9 ->
            ignore (send_frame conn 0xA payload);
            read_frame conn
        | 0xA -> read_frame conn
        | _ -> Ok (fin, opcode, payload)
    with
    | End_of_file -> Error (Closed None)
    | Failure message | Invalid_argument message ->
        Error (Invalid_response message)
    | exn -> Error (Network (Printexc.to_string exn))

  let recv connection =
    let rec collect opcode parts =
      match read_frame connection with
      | Error _ as err -> err
      | Ok (fin, frame_opcode, payload) ->
          let opcode = if frame_opcode = 0x0 then opcode else frame_opcode in
          let parts = payload :: parts in
          if fin then
            let payload = parts |> List.rev |> String.concat "" in
            match opcode with
            | 0x1 -> Ok (Text payload)
            | 0x2 -> Ok (Binary payload)
            | _ -> Error (Invalid_response "unsupported websocket frame opcode")
          else collect opcode parts
    in
    collect 0 []

  let close ?(code = 1000) ?(reason = "") (Connection connection as conn) =
    match connection.closed with
    | Some _ as close -> Error (Closed close)
    | None ->
        connection.closed <- Some { code; reason };
        send_frame conn 0x8 (close_payload code reason)

  let with_connection ?(https = Http.System)
      ?(max_frame_size = default_max_frame_size) ~net ~clock request fn =
    let perform () =
      Mirage_crypto_rng_unix.use_default ();
      let uri = Uri.of_string request.url in
      let scheme = uri |> Uri.scheme |> Option.map lower_ascii in
      let host =
        match Uri.host uri with
        | Some host -> host
        | None -> invalid_arg "websocket URL must include a host"
      in
      let service =
        match (Uri.port uri, scheme) with
        | Some port, _ -> string_of_int port
        | None, Some "ws" -> "80"
        | None, Some "wss" -> "443"
        | _ -> invalid_arg "websocket URL must use ws:// or wss://"
      in
      Eio.Net.with_tcp_connect ~host ~service net @@ fun raw ->
      let with_flow flow =
        let reader = Eio.Buf_read.of_flow ~max_size:max_frame_size flow in
        let key = random_key () in
        match handshake flow reader request uri key with
        | Error error -> Error error
        | Ok () ->
            let connection =
              Connection { flow; reader; max_frame_size; closed = None }
            in
            let result =
              try Ok (fn connection)
              with exn -> Error (Network (Printexc.to_string exn))
            in
            ignore (close connection);
            result
      in
      match scheme with
      | Some "ws" -> with_flow raw
      | Some "wss" -> (
          match Http.tls_config_exn https with
          | None -> invalid_arg "HTTPS is disabled for wss:// URL"
          | Some config -> with_flow (Http.https_wrapper config uri raw))
      | _ -> invalid_arg "websocket URL must use ws:// or wss://"
    in
    match request.timeout_ms with
    | Some timeout_ms when timeout_ms > 0 -> (
        let seconds = float_of_int timeout_ms /. 1000. in
        try Eio.Time.with_timeout_exn clock seconds perform with
        | Eio.Time.Timeout -> Error (Timeout timeout_ms)
        | Failure message | Invalid_argument message ->
            Error (Invalid_response message)
        | exn -> Error (Network (Printexc.to_string exn)))
    | _ -> (
        try perform () with
        | Failure message | Invalid_argument message ->
            Error (Invalid_response message)
        | exn -> Error (Network (Printexc.to_string exn)))

  let make ?https ?max_frame_size ~net ~clock () =
    (module struct
      type nonrec message = message = Text of string | Binary of string
      type nonrec close = close = { code : int; reason : string }

      type nonrec request = request = {
        url : string;
        headers : (string * string) list;
        protocols : string list;
        timeout_ms : int option;
      }

      type nonrec error = error =
        | Timeout of int
        | Network of string
        | Invalid_response of string
        | Closed of close option

      type nonrec connection = connection

      let with_connection request fn =
        with_connection ?https ?max_frame_size ~net ~clock request fn

      let send = send
      let recv = recv
      let close = close
    end : EFFECT)
end

module Error = struct
  let provider = Chatoyant_provider.Provider.error_to_string
  let http = Http.error_to_string
  let websocket = Websocket.error_to_string
end

module Noop_http : Chatoyant_runtime.Effect.HTTP = struct
  type multipart_part = {
    name : string;
    filename : string option;
    content_type : string option;
    body : string;
  }

  type body =
    | Empty
    | Text of string
    | Json of Chatoyant_runtime.Json.t
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

  let send _ =
    Error (Network "noop HTTP module is only used for provider defaults")
end

module Openai_defaults = Chatoyant_provider.Openai.Make_client (Noop_http)
module Anthropic_defaults = Chatoyant_provider.Anthropic.Make_client (Noop_http)
module Xai_defaults = Chatoyant_provider.Xai.Make_client (Noop_http)

module Provider = struct
  let http ?https ?max_response_size ~net ~clock () =
    Http.make ?https ?max_response_size ~net ~clock ()

  let openai ?https ?max_response_size
      ?(base_url = Openai_defaults.default_base_url) ?timeout_ms ~net ~clock
      ~api_key () =
    let module Http = (val http ?https ?max_response_size ~net ~clock ()) in
    let module Provider =
      Chatoyant_provider.Openai.Make_provider
        (Http)
        (struct
          let api_key = api_key
          let base_url = base_url
          let timeout_ms = timeout_ms
        end) in
    (module Provider : Chatoyant_provider.Provider.CHAT)

  let anthropic ?https ?max_response_size
      ?(base_url = Anthropic_defaults.default_base_url) ?timeout_ms
      ?(beta_headers = []) ~net ~clock ~api_key () =
    let module Http = (val http ?https ?max_response_size ~net ~clock ()) in
    let module Provider =
      Chatoyant_provider.Anthropic.Make_provider
        (Http)
        (struct
          let api_key = api_key
          let base_url = base_url
          let timeout_ms = timeout_ms
          let beta_headers = beta_headers
        end) in
    (module Provider : Chatoyant_provider.Provider.CHAT)

  let xai ?https ?max_response_size ?(base_url = Xai_defaults.default_base_url)
      ?timeout_ms ~net ~clock ~api_key () =
    let module Http = (val http ?https ?max_response_size ~net ~clock ()) in
    let module Provider =
      Chatoyant_provider.Xai.Make_provider
        (Http)
        (struct
          let api_key = api_key
          let base_url = base_url
          let timeout_ms = timeout_ms
        end) in
    (module Provider : Chatoyant_provider.Provider.CHAT)

  let openrouter ?https ?max_response_size ?timeout_ms ?http_referer ?title
      ?(headers = []) ~net ~clock ~api_key () =
    let module Http = (val http ?https ?max_response_size ~net ~clock ()) in
    let module Provider =
      Chatoyant_provider.Openrouter.Make_provider
        (Http)
        (struct
          let api_key = api_key
          let timeout_ms = timeout_ms
          let http_referer = http_referer
          let title = title
          let headers = headers
        end) in
    (module Provider : Chatoyant_provider.Provider.CHAT)

  let local ?https ?max_response_size ?api_key ?timeout_ms ?(headers = []) ~net
      ~clock ~base_url () =
    let module Http = (val http ?https ?max_response_size ~net ~clock ()) in
    let module Provider =
      Chatoyant_provider.Local.Make_provider
        (Http)
        (struct
          let base_url = base_url
          let api_key = api_key
          let timeout_ms = timeout_ms
          let headers = headers
        end) in
    (module Provider : Chatoyant_provider.Provider.CHAT)
end

let nonempty = function Some value when value <> "" -> Some value | _ -> None

let api_key_or_env env_key api_key =
  match nonempty api_key with
  | Some _ as key -> key
  | None -> Env.get env_key |> nonempty

let missing_api_key_provider provider env_key =
  (module struct
    let id = provider

    let generate _messages _options =
      Error (Chatoyant_provider.Provider.Missing_api_key { provider; env_key })
  end : Chatoyant_provider.Provider.CHAT)

module Chat = struct
  module type SESSION = sig
    type t

    val create :
      ?model:string -> ?defaults:Chatoyant_core.Options.t -> unit -> t

    val model : t -> string
    val set_model : string -> t -> t
    val messages : t -> Chatoyant_core.Message.t list
    val tools : t -> Chatoyant_core.Tool.t list
    val last_result : t -> Chatoyant_core.Result.generation option
    val system : string -> t -> t
    val user : string -> t -> t
    val assistant : string -> t -> t
    val add_message : Chatoyant_core.Message.t -> t -> t
    val add_messages : Chatoyant_core.Message.t list -> t -> t
    val clear_messages : t -> t
    val add_tool : Chatoyant_core.Tool.t -> t -> t
    val add_tools : Chatoyant_core.Tool.t list -> t -> t
    val clear_tools : t -> t

    val generate_with_result :
      ?options:Chatoyant_core.Options.t ->
      t ->
      ( Chatoyant_core.Result.generation,
        Chatoyant_provider.Provider.error )
      result

    val generate :
      ?options:Chatoyant_core.Options.t ->
      t ->
      (string, Chatoyant_provider.Provider.error) result

    val stream_accumulate :
      ?options:Chatoyant_core.Options.t ->
      Chatoyant_core.Stream.frame list ->
      t ->
      Chatoyant_core.Result.generation

    val to_json : t -> Chatoyant_runtime.Json.t
    val stringify : ?pretty:bool -> t -> string
    val load_json : Chatoyant_runtime.Json.t -> t -> (t, string) result
    val clone : t -> t
    val fork : t -> t
  end

  type t = {
    provider_ : unit -> Chatoyant_provider.Provider.id;
    model_ : unit -> string;
    set_model_ : string -> t;
    messages_ : unit -> Chatoyant_core.Message.t list;
    tools_ : unit -> Chatoyant_core.Tool.t list;
    last_result_ : unit -> Chatoyant_core.Result.generation option;
    system_ : string -> t;
    user_ : string -> t;
    assistant_ : string -> t;
    add_message_ : Chatoyant_core.Message.t -> t;
    add_messages_ : Chatoyant_core.Message.t list -> t;
    clear_messages_ : unit -> t;
    add_tool_ : Chatoyant_core.Tool.t -> t;
    add_tools_ : Chatoyant_core.Tool.t list -> t;
    clear_tools_ : unit -> t;
    generate_with_result_ :
      ?options:Chatoyant_core.Options.t ->
      unit ->
      ( Chatoyant_core.Result.generation,
        Chatoyant_provider.Provider.error )
      result;
    generate_ :
      ?options:Chatoyant_core.Options.t ->
      unit ->
      (string, Chatoyant_provider.Provider.error) result;
    stream_accumulate_ :
      ?options:Chatoyant_core.Options.t ->
      Chatoyant_core.Stream.frame list ->
      Chatoyant_core.Result.generation;
    to_json_ : unit -> Chatoyant_runtime.Json.t;
    stringify_ : ?pretty:bool -> unit -> string;
    load_json_ : Chatoyant_runtime.Json.t -> (t, string) result;
    clone_ : unit -> t;
    fork_ : unit -> t;
  }

  let rec pack_session : type session.
      provider_id:Chatoyant_provider.Provider.id ->
      (module SESSION with type t = session) ->
      session ->
      t =
   fun ~provider_id (module Session) session ->
    let rec chat =
      {
        provider_ = (fun () -> provider_id);
        model_ = (fun () -> Session.model session);
        set_model_ =
          (fun model ->
            ignore (Session.set_model model session);
            chat);
        messages_ = (fun () -> Session.messages session);
        tools_ = (fun () -> Session.tools session);
        last_result_ = (fun () -> Session.last_result session);
        system_ =
          (fun content ->
            ignore (Session.system content session);
            chat);
        user_ =
          (fun content ->
            ignore (Session.user content session);
            chat);
        assistant_ =
          (fun content ->
            ignore (Session.assistant content session);
            chat);
        add_message_ =
          (fun message ->
            ignore (Session.add_message message session);
            chat);
        add_messages_ =
          (fun messages ->
            ignore (Session.add_messages messages session);
            chat);
        clear_messages_ =
          (fun () ->
            ignore (Session.clear_messages session);
            chat);
        add_tool_ =
          (fun tool ->
            ignore (Session.add_tool tool session);
            chat);
        add_tools_ =
          (fun tools ->
            ignore (Session.add_tools tools session);
            chat);
        clear_tools_ =
          (fun () ->
            ignore (Session.clear_tools session);
            chat);
        generate_with_result_ =
          (fun ?options () -> Session.generate_with_result ?options session);
        generate_ = (fun ?options () -> Session.generate ?options session);
        stream_accumulate_ =
          (fun ?options frames ->
            Session.stream_accumulate ?options frames session);
        to_json_ = (fun () -> Session.to_json session);
        stringify_ = (fun ?pretty () -> Session.stringify ?pretty session);
        load_json_ =
          (fun json ->
            match Session.load_json json session with
            | Ok _ -> Ok chat
            | Error _ as err -> err);
        clone_ =
          (fun () ->
            pack_session ~provider_id (module Session) (Session.clone session));
        fork_ =
          (fun () ->
            pack_session ~provider_id (module Session) (Session.fork session));
      }
    in
    chat

  let with_provider ?model ?defaults ~clock provider =
    let module Provider = (val provider : Chatoyant_provider.Provider.CHAT) in
    let module Clock = (val Clock.make ~clock) in
    let module Session_impl = Chatoyant_core.Session.Make (Provider) (Clock) in
    let module Session = struct
      type t = Chatoyant_core.Session.t

      include Session_impl
    end in
    pack_session ~provider_id:Provider.id
      (module Session)
      (Session.create ?model ?defaults ())

  let openai ?https ?max_response_size ?base_url ?timeout_ms ?model ?defaults
      env ?api_key () =
    let net = env#net in
    let clock = env#clock in
    let provider =
      match api_key_or_env "OPENAI_API_KEY" api_key with
      | Some api_key ->
          Provider.openai ?https ?max_response_size ?base_url ?timeout_ms ~net
            ~clock ~api_key ()
      | None -> missing_api_key_provider Openai "OPENAI_API_KEY"
    in
    with_provider ?model ?defaults ~clock provider

  let anthropic ?https ?max_response_size ?base_url ?timeout_ms ?beta_headers
      ?model ?defaults env ?api_key () =
    let net = env#net in
    let clock = env#clock in
    let provider =
      match api_key_or_env "ANTHROPIC_API_KEY" api_key with
      | Some api_key ->
          Provider.anthropic ?https ?max_response_size ?base_url ?timeout_ms
            ?beta_headers ~net ~clock ~api_key ()
      | None -> missing_api_key_provider Anthropic "ANTHROPIC_API_KEY"
    in
    with_provider ?model ?defaults ~clock provider

  let xai ?https ?max_response_size ?base_url ?timeout_ms ?model ?defaults env
      ?api_key () =
    let net = env#net in
    let clock = env#clock in
    let provider =
      match api_key_or_env "XAI_API_KEY" api_key with
      | Some api_key ->
          Provider.xai ?https ?max_response_size ?base_url ?timeout_ms ~net
            ~clock ~api_key ()
      | None -> missing_api_key_provider Xai "XAI_API_KEY"
    in
    with_provider ?model ?defaults ~clock provider

  let openrouter ?https ?max_response_size ?timeout_ms ?http_referer ?title
      ?headers ?model ?defaults env ?api_key () =
    let net = env#net in
    let clock = env#clock in
    let provider =
      match api_key_or_env "OPENROUTER_API_KEY" api_key with
      | Some api_key ->
          Provider.openrouter ?https ?max_response_size ?timeout_ms
            ?http_referer ?title ?headers ~net ~clock ~api_key ()
      | None -> missing_api_key_provider Openrouter "OPENROUTER_API_KEY"
    in
    with_provider ?model ?defaults ~clock provider

  let local ?https ?max_response_size ?api_key ?timeout_ms ?headers ?model
      ?defaults env ~base_url () =
    let net = env#net in
    let clock = env#clock in
    Provider.local ?https ?max_response_size ?api_key ?timeout_ms ?headers ~net
      ~clock ~base_url ()
    |> with_provider ?model ?defaults ~clock

  let provider chat = chat.provider_ ()
  let model chat = chat.model_ ()
  let set_model model chat = chat.set_model_ model
  let messages chat = chat.messages_ ()
  let tools chat = chat.tools_ ()
  let last_result chat = chat.last_result_ ()
  let system content chat = chat.system_ content
  let user content chat = chat.user_ content
  let assistant content chat = chat.assistant_ content
  let add_message message chat = chat.add_message_ message
  let add_messages messages chat = chat.add_messages_ messages
  let clear_messages chat = chat.clear_messages_ ()
  let add_tool tool chat = chat.add_tool_ tool
  let add_tools tools chat = chat.add_tools_ tools
  let with_tool = add_tool
  let with_tools = add_tools
  let clear_tools chat = chat.clear_tools_ ()

  let options_override ?options ?timeout_ms ?temperature ?max_tokens ?extra () =
    let options =
      Option.value options ~default:Chatoyant_core.Options.default
    in
    {
      options with
      timeout_ms =
        (match timeout_ms with
        | Some _ -> timeout_ms
        | None -> options.timeout_ms);
      temperature =
        (match temperature with
        | Some _ -> temperature
        | None -> options.temperature);
      max_tokens =
        (match max_tokens with
        | Some _ -> max_tokens
        | None -> options.max_tokens);
      extra = (match extra with Some _ -> extra | None -> options.extra);
    }

  let generate_with_result ?options ?timeout_ms ?temperature ?max_tokens ?extra
      chat =
    let options =
      options_override ?options ?timeout_ms ?temperature ?max_tokens ?extra ()
    in
    chat.generate_with_result_ ~options ()

  let generate ?options ?timeout_ms ?temperature ?max_tokens ?extra chat =
    let options =
      options_override ?options ?timeout_ms ?temperature ?max_tokens ?extra ()
    in
    chat.generate_ ~options ()

  let prepare_ask ?system:system_prompt ?tools prompt chat =
    let chat =
      match system_prompt with
      | None -> chat
      | Some content -> chat.system_ content
    in
    let chat =
      match tools with None -> chat | Some tools -> with_tools tools chat
    in
    user prompt chat

  let ask ?system ?tools ?options ?timeout_ms ?temperature ?max_tokens ?extra
      prompt chat =
    chat
    |> prepare_ask ?system ?tools prompt
    |> generate_with_result ?options ?timeout_ms ?temperature ?max_tokens ?extra

  let ask_text ?system ?tools ?options ?timeout_ms ?temperature ?max_tokens
      ?extra prompt chat =
    chat
    |> prepare_ask ?system ?tools prompt
    |> generate ?options ?timeout_ms ?temperature ?max_tokens ?extra

  let stream_accumulate ?options frames chat =
    chat.stream_accumulate_ ?options frames

  let to_json chat = chat.to_json_ ()
  let stringify ?pretty chat = chat.stringify_ ?pretty ()
  let load_json json chat = chat.load_json_ json
  let clone chat = chat.clone_ ()
  let fork chat = chat.fork_ ()
end

type client = Chat.t

let add_default_messages ?system ?tools chat =
  let chat =
    match system with None -> chat | Some content -> Chat.system content chat
  in
  match tools with None -> chat | Some tools -> Chat.with_tools tools chat

let openai ?https ?max_response_size ?base_url ?timeout_ms ?model ?defaults
    ?api_key ?system ?tools env =
  Chat.openai ?https ?max_response_size ?base_url ?timeout_ms ?model ?defaults
    env ?api_key ()
  |> add_default_messages ?system ?tools

let anthropic ?https ?max_response_size ?base_url ?timeout_ms ?beta_headers
    ?model ?defaults ?api_key ?system ?tools env =
  Chat.anthropic ?https ?max_response_size ?base_url ?timeout_ms ?beta_headers
    ?model ?defaults env ?api_key ()
  |> add_default_messages ?system ?tools

let xai ?https ?max_response_size ?base_url ?timeout_ms ?model ?defaults
    ?api_key ?system ?tools env =
  Chat.xai ?https ?max_response_size ?base_url ?timeout_ms ?model ?defaults env
    ?api_key ()
  |> add_default_messages ?system ?tools

let openrouter ?https ?max_response_size ?timeout_ms ?http_referer ?title
    ?headers ?model ?defaults ?api_key ?system ?tools env =
  Chat.openrouter ?https ?max_response_size ?timeout_ms ?http_referer ?title
    ?headers ?model ?defaults env ?api_key ()
  |> add_default_messages ?system ?tools

let local ?https ?max_response_size ?api_key ?timeout_ms ?headers ?model
    ?defaults ?system ?tools env ~base_url =
  Chat.local ?https ?max_response_size ?api_key ?timeout_ms ?headers ?model
    ?defaults env ~base_url ()
  |> add_default_messages ?system ?tools

let gen_result ?system ?tools ?options ?timeout_ms ?temperature ?max_tokens
    ?extra client prompt =
  client |> Chat.fork
  |> Chat.ask ?system ?tools ?options ?timeout_ms ?temperature ?max_tokens
       ?extra prompt

let gen_text ?system ?tools ?options ?timeout_ms ?temperature ?max_tokens ?extra
    client prompt =
  client |> Chat.fork
  |> Chat.ask_text ?system ?tools ?options ?timeout_ms ?temperature ?max_tokens
       ?extra prompt

let json_string value = Chatoyant_runtime.Json.String value
let json_bool value = Chatoyant_runtime.Json.Bool value

let object_fields = function
  | Some (Chatoyant_runtime.Json.Object fields) -> fields
  | _ -> []

let remove_json_field name fields =
  List.filter (fun (field_name, _) -> field_name <> name) fields

let strict_schema_json schema =
  let json = Chatoyant_schema.Schema.to_json_schema schema in
  match Chatoyant_schema.Json_schema.Ast.of_json json with
  | Error _ -> json
  | Ok ast ->
      (Chatoyant_schema.Json_schema.Project.openai_strict ast).schema
      |> Chatoyant_schema.Json_schema.Ast.to_json

let structured_schema_json ~strict schema =
  if strict then strict_schema_json schema
  else Chatoyant_schema.Schema.to_json_schema schema

let json_schema_envelope ~name ?description ~strict schema_json =
  [
    ("name", json_string name);
    ("schema", schema_json);
    ("strict", json_bool strict);
  ]
  |> (fun fields ->
  match description with
  | None -> fields
  | Some description -> ("description", json_string description) :: fields)
  |> List.rev

let openai_text_format ~name ?description ~strict schema_json =
  Chatoyant_runtime.Json.Object
    [
      ( "format",
        Chatoyant_runtime.Json.Object
          ([
             ("type", json_string "json_schema");
             ("name", json_string name);
             ("schema", schema_json);
             ("strict", json_bool strict);
           ]
          |> (fun fields ->
          match description with
          | None -> fields
          | Some description ->
              ("description", json_string description) :: fields)
          |> List.rev) );
    ]

let chat_response_format ~name ?description ~strict schema_json =
  Chatoyant_runtime.Json.Object
    [
      ("type", json_string "json_schema");
      ( "json_schema",
        Chatoyant_runtime.Json.Object
          (json_schema_envelope ~name ?description ~strict schema_json) );
    ]

let structured_extra provider ?name ?description ~strict schema extra =
  let name = Option.value name ~default:"data" in
  let schema_json = structured_schema_json ~strict schema in
  match provider with
  | Chatoyant_provider.Provider.Openai ->
      let fields = extra |> object_fields |> remove_json_field "text" in
      Some
        (Chatoyant_runtime.Json.Object
           (("text", openai_text_format ~name ?description ~strict schema_json)
           :: fields))
  | Xai | Local | Openrouter ->
      let fields =
        extra |> object_fields |> remove_json_field "response_format"
      in
      Some
        (Chatoyant_runtime.Json.Object
           (( "response_format",
              chat_response_format ~name ?description ~strict schema_json )
           :: fields))
  | Anthropic -> extra

let structured_instruction schema =
  let schema_json = Chatoyant_schema.Schema.to_json_schema schema in
  "Return only valid JSON matching this JSON Schema. Do not wrap it in Markdown.\n"
  ^ Chatoyant_runtime.Json.to_string schema_json

let append_system base addition =
  match base with
  | None -> Some addition
  | Some base when String.trim base = "" -> Some addition
  | Some base -> Some (base ^ "\n\n" ^ addition)

let parse_json_text text =
  let trimmed = String.trim text in
  match Chatoyant_runtime.Json.parse trimmed with
  | Ok _ as ok -> ok
  | Error first_error ->
      let len = String.length trimmed in
      if
        len >= 6
        && String.sub trimmed 0 3 = "```"
        && String.sub trimmed (len - 3) 3 = "```"
      then
        match String.index_opt trimmed '\n' with
        | Some start when len > start + 4 ->
            let body =
              String.sub trimmed (start + 1) (len - start - 4) |> String.trim
            in
            Chatoyant_runtime.Json.parse body
        | _ -> Error first_error
      else Error first_error

let gen_data ?name ?description ?(strict = true) ~codec ?system ?tools ?options
    ?timeout_ms ?temperature ?max_tokens ?extra client prompt =
  let schema = Chatoyant_schema.Codec.schema codec in
  let provider = Chat.provider client in
  let extra =
    structured_extra provider ?name ?description ~strict schema extra
  in
  let system =
    match provider with
    | Chatoyant_provider.Provider.Anthropic | Local ->
        append_system system (structured_instruction schema)
    | Openai | Xai | Openrouter -> system
  in
  match
    gen_text ?system ?tools ?options ?timeout_ms ?temperature ?max_tokens ?extra
      client prompt
  with
  | Error _ as err -> err
  | Ok text -> (
      match parse_json_text text with
      | Error message ->
          Error (Chatoyant_provider.Provider.Decode_error message)
      | Ok json -> (
          match Chatoyant_schema.Value.validate schema json with
          | Error error ->
              Error
                (Chatoyant_provider.Provider.Decode_error
                   (Chatoyant_schema.Value.error_to_string error))
          | Ok () -> (
              match Chatoyant_schema.Codec.decode codec json with
              | Ok value -> Ok value
              | Error message ->
                  Error (Chatoyant_provider.Provider.Decode_error message))))

module Generate = struct
  let with_provider ?(options = Chatoyant_core.Options.default) ~clock ~provider
      chat =
    let module Provider = (val provider : Chatoyant_provider.Provider.CHAT) in
    let module Clock = (val Clock.make ~clock) in
    let module Generator = Chatoyant_core.Generator.Make (Provider) (Clock) in
    Generator.generate ~options chat
end
