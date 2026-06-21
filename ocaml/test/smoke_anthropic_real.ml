module Curl_http = struct
  type multipart_part = {
    name : string;
    filename : string option;
    content_type : string option;
    body : string;
  }

  type body =
    | Empty
    | Text of string
    | Json of Chatoyant.Runtime.Json.t
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

  type error =
    | Timeout of int
    | Network of string
    | Invalid_response of string

  let shell_quote value =
    "'" ^ String.concat "'\\''" (String.split_on_char '\'' value) ^ "'"

  let write_file path content =
    let oc = open_out_bin path in
    Fun.protect
      ~finally:(fun () -> close_out_noerr oc)
      (fun () -> output_string oc content)

  let read_file path =
    let ic = open_in_bin path in
    Fun.protect
      ~finally:(fun () -> close_in_noerr ic)
      (fun () -> really_input_string ic (in_channel_length ic))

  let body_to_string = function
    | Empty -> ""
    | Text text -> text
    | Json json -> Chatoyant.Runtime.Json.to_string json
    | Multipart _ -> failwith "multipart body is not supported by this smoke transport"

  let config_for (request : request) body_path response_path =
    let timeout =
      match request.timeout_ms with
      | None -> []
      | Some ms -> [ Printf.sprintf "max-time = %S" (string_of_float (max 1.0 (float_of_int ms /. 1000.0))) ]
    in
    let headers =
      request.headers
      |> List.map (fun (name, value) -> Printf.sprintf "header = %S" (name ^ ": " ^ value))
    in
    String.concat "\n"
      ([
         Printf.sprintf "url = %S" request.url;
         Printf.sprintf "request = %S" request.method_;
         "silent";
         "show-error";
         Printf.sprintf "output = %S" response_path;
         "write-out = \"%{http_code}\"";
         Printf.sprintf "data-binary = @%s" body_path;
       ]
      @ timeout @ headers)

  let send (request : request) =
    let body_path = Filename.temp_file "chatoyant-anthropic-body" ".json" in
    let config_path = Filename.temp_file "chatoyant-anthropic-curl" ".conf" in
    let response_path = Filename.temp_file "chatoyant-anthropic-response" ".json" in
    let error_path = Filename.temp_file "chatoyant-anthropic-error" ".txt" in
    Fun.protect
      ~finally:(fun () ->
        List.iter
          (fun path -> try Sys.remove path with Sys_error _ -> ())
          [ body_path; config_path; response_path; error_path ])
      (fun () ->
        write_file body_path (body_to_string request.body);
        write_file config_path (config_for request body_path response_path);
        let command =
          "curl --config " ^ shell_quote config_path ^ " 2> " ^ shell_quote error_path
        in
        let ic = Unix.open_process_in command in
        let status_text =
          try input_line ic with End_of_file -> ""
        in
        match Unix.close_process_in ic with
        | Unix.WEXITED 0 -> (
            match int_of_string_opt status_text with
            | None -> Error (Invalid_response ("curl did not return HTTP status: " ^ status_text))
            | Some status -> Ok { status; headers = []; body = read_file response_path })
        | _ -> Error (Network (read_file error_path)))
end

module Client = Chatoyant.Provider.Anthropic.Make_client (Curl_http)

let () =
  let api_key =
    match Sys.getenv_opt "ANTHROPIC_API_KEY" with
    | Some value when value <> "" -> value
    | _ -> failwith "ANTHROPIC_API_KEY is required for real Anthropic smoke test"
  in
  let request =
    Chatoyant.Provider.Anthropic.
      {
        model = "claude-haiku-4-5-20251001";
        system = None;
        messages =
          [
            {
              message_role = User;
              message_content =
                [ Text "Respond with the exact text OCAML_SMOKE_OK and nothing else." ];
            };
          ];
        max_tokens = 32;
        stream = false;
        temperature = Some 0.0;
        top_p = None;
        top_k = None;
        stop_sequences = [];
        metadata_user_id = None;
        tools = [];
        tool_choice = None;
        thinking = None;
        extra = [];
      }
  in
  let config =
    Client.
      {
        api_key;
        base_url = default_base_url;
        timeout_ms = Some 30_000;
        beta_headers = [];
      }
  in
  match Client.create_message config request with
  | Error error -> failwith error.error_message
  | Ok response ->
      let text = Chatoyant.Provider.Anthropic.text_of_response response in
      if not (String.contains text 'O') || not (String.contains text 'K') then
        failwith ("unexpected Anthropic smoke response: " ^ text);
      if not (String.equal (String.trim text) "OCAML_SMOKE_OK") then
        failwith ("unexpected Anthropic smoke response: " ^ text);
      (match Client.list_models config with
      | Error error -> failwith error.error_message
      | Ok models ->
          if List.length models.models = 0 then
            failwith "Anthropic models smoke returned no models");
      print_endline "ocaml anthropic smoke ok"
