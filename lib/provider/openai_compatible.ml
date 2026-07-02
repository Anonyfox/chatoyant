type kind = Local | Openrouter
type profile = Full | Conservative_local

type config = {
  api_key : string;
  base_url : string;
  timeout_ms : int option;
  headers : (string * string) list;
  profile : profile;
  kind : kind;
}

type chat_response = Openai.chat_response
type responses_request = Openai.responses_request
type responses_response = Openai.responses_response
type image_request = Openai.image_request
type image_response = Openai.image_response
type embedding_request = Openai.embedding_request
type embedding_response = Openai.embedding_response

let local_config ?(api_key = "local") ?(headers = []) ?timeout_ms ~base_url () =
  {
    api_key;
    base_url;
    timeout_ms;
    headers;
    profile = Conservative_local;
    kind = Local;
  }

let openrouter_config ?http_referer ?title ?(headers = []) ?timeout_ms ~api_key
    () =
  let attribution =
    ( [] |> fun fields ->
      match http_referer with
      | None -> fields
      | Some value -> ("HTTP-Referer", value) :: fields )
    |> fun fields ->
    match title with
    | None -> fields
    | Some value -> ("X-Title", value) :: fields
  in
  {
    api_key;
    base_url = "https://openrouter.ai/api/v1";
    timeout_ms;
    headers = attribution @ headers;
    profile = Full;
    kind = Openrouter;
  }

let authorization_headers config =
  Openai.authorization_headers ~api_key:config.api_key @ config.headers

let normalize_chat_request config request =
  match config.profile with
  | Full -> request
  | Conservative_local ->
      {
        request with
        Openai.chat_user = None;
        chat_logprobs = None;
        chat_top_logprobs = None;
        chat_parallel_tool_calls = None;
      }

let chat_request_json config request =
  request |> normalize_chat_request config |> Openai.chat_request_json

let responses_request_json _config request =
  Openai.responses_request_json request

let image_request_json _config request = Openai.image_request_json request

let embedding_request_json _config request =
  Openai.embedding_request_json request

let usage_of_json config json =
  match Chatoyant_runtime.Json.field "usage" json with
  | None -> Chatoyant_tokens.Cost.empty_usage
  | Some usage -> (
      match config.kind with
      | Local -> Usage.openai_compatible usage
      | Openrouter -> Usage.openrouter usage)

let chat_response_of_json config json =
  let response = Openai.chat_response_of_json json in
  { response with Openai.chat_response_usage = usage_of_json config json }

let responses_response_of_json _config json =
  Openai.responses_response_of_json json

let generation_of_chat_response = Openai.generation_of_chat_response

let generation_of_chat_response_for_config config response =
  let generation = Openai.generation_of_chat_response response in
  match config.kind with
  | Local ->
      {
        generation with
        Provider.usage_source = Chatoyant_tokens.Cost.Unmetered;
        usage = Chatoyant_tokens.Cost.normalize_total generation.usage;
      }
  | Openrouter -> generation

type thinking_state = { in_thinking : bool; pending : string }

let empty_thinking = { in_thinking = false; pending = "" }
let think_open = "<think>"
let think_close = "</think>"

let prefix_of ~target value =
  let value_len = String.length value in
  value_len <= String.length target && String.sub target 0 value_len = value

let split_thinking delta state =
  match delta.Openai_stream.delta_reasoning_content with
  | Some reasoning ->
      ( delta.Openai_stream.delta_content,
        Some reasoning,
        { state with pending = "" } )
  | None ->
      let raw = Option.value delta.delta_content ~default:"" in
      let len = String.length raw in
      let rec loop index state content reasoning =
        if index >= len then (content, reasoning, state)
        else
          let char_text = String.make 1 raw.[index] in
          if not state.in_thinking then
            let candidate = state.pending ^ char_text in
            if prefix_of ~target:think_open candidate then
              if candidate = think_open then
                loop (index + 1)
                  { in_thinking = true; pending = "" }
                  content reasoning
              else
                loop (index + 1)
                  { state with pending = candidate }
                  content reasoning
            else if state.pending <> "" then
              loop (index + 1)
                { state with pending = "" }
                (content ^ candidate) reasoning
            else if char_text = "<" then
              loop (index + 1)
                { state with pending = char_text }
                content reasoning
            else loop (index + 1) state (content ^ char_text) reasoning
          else
            let candidate = state.pending ^ char_text in
            if prefix_of ~target:think_close candidate then
              if candidate = think_close then
                loop (index + 1)
                  { in_thinking = false; pending = "" }
                  content reasoning
              else
                loop (index + 1)
                  { state with pending = candidate }
                  content reasoning
            else if state.pending <> "" then
              loop (index + 1)
                { state with pending = "" }
                content (reasoning ^ candidate)
            else if char_text = "<" then
              loop (index + 1)
                { state with pending = char_text }
                content reasoning
            else loop (index + 1) state content (reasoning ^ char_text)
      in
      let content, reasoning, state = loop 0 state "" "" in
      ( (if content = "" then None else Some content),
        (if reasoning = "" then None else Some reasoning),
        state )

let smooth_delta config state delta =
  match config.kind with
  | Openrouter -> (delta, state)
  | Local ->
      let content, reasoning, state = split_thinking delta state in
      ( {
          delta with
          Openai_stream.delta_content = content;
          delta_reasoning_content = reasoning;
        },
        state )

let chat_response_of_stream_chunks config chunks =
  let rec feed sse_state thinking_state acc = function
    | [] ->
        let events = Chatoyant_runtime.Sse.finish sse_state in
        decode thinking_state acc events
    | chunk :: rest ->
        let sse_state, events = Chatoyant_runtime.Sse.feed sse_state chunk in
        let thinking_state, acc = decode thinking_state acc events in
        feed sse_state thinking_state acc rest
  and decode thinking_state acc events =
    match events with
    | [] -> (thinking_state, acc)
    | event :: rest -> (
        if Chatoyant_runtime.Sse.is_done event then
          decode thinking_state acc rest
        else
          match
            Chatoyant_runtime.Json.parse
              (Chatoyant_runtime.Sse.data_string event)
          with
          | Error _ -> decode thinking_state acc rest
          | Ok json ->
              let delta = Openai_stream.delta_of_json json in
              let delta, thinking_state =
                smooth_delta config thinking_state delta
              in
              decode thinking_state (Openai_stream.apply_delta acc delta) rest)
  in
  let _, accumulated =
    feed Chatoyant_runtime.Sse.empty empty_thinking Openai_stream.empty chunks
  in
  Ok
    {
      Openai.chat_response_id = None;
      chat_response_model = None;
      chat_response_content = accumulated.Openai_stream.accumulated_content;
      chat_response_refusal = None;
      chat_response_reasoning_content =
        accumulated.accumulated_reasoning_content;
      chat_response_usage =
        (match accumulated.accumulated_usage with
        | Some usage -> (
            match config.kind with
            | Local -> Usage.openai_compatible usage
            | Openrouter -> Usage.openrouter usage)
        | None -> Chatoyant_tokens.Cost.empty_usage);
      chat_response_raw = Chatoyant_runtime.Json.Null;
    }

let response_of_stream_chunks _config chunks =
  Openai.response_of_stream_chunks chunks

module Make_client (Http : Chatoyant_runtime.Effect.HTTP) = struct
  let endpoint config path =
    let base =
      if String.ends_with ~suffix:"/" config.base_url then
        String.sub config.base_url 0 (String.length config.base_url - 1)
      else config.base_url
    in
    base ^ path

  let request ?(method_ = "POST") config path body =
    {
      Http.method_;
      url = endpoint config path;
      headers = authorization_headers config;
      body;
      timeout_ms = config.timeout_ms;
    }

  let parse_response decode response =
    if response.Http.status < 200 || response.status >= 300 then
      match Chatoyant_runtime.Json.parse response.body with
      | Ok json -> Error (Openai.api_error_of_json json)
      | Error _ ->
          Error
            {
              Openai.error_type = Some "http_error";
              error_message =
                "OpenAI-compatible HTTP "
                ^ string_of_int response.status
                ^ ": " ^ response.body;
              error_code = None;
              error_param = None;
              error_raw = None;
            }
    else
      match Chatoyant_runtime.Json.parse response.body with
      | Error message ->
          Error
            {
              Openai.error_type = Some "decode_error";
              error_message = message;
              error_code = None;
              error_param = None;
              error_raw = None;
            }
      | Ok json -> Ok (decode json)

  let map_http_error = function
    | Http.Timeout ms ->
        {
          Openai.error_type = Some "timeout_error";
          error_message = "Request timed out after " ^ string_of_int ms ^ "ms";
          error_code = None;
          error_param = None;
          error_raw = None;
        }
    | Network message ->
        {
          Openai.error_type = Some "network_error";
          error_message = message;
          error_code = None;
          error_param = None;
          error_raw = None;
        }
    | Invalid_response message ->
        {
          Openai.error_type = Some "invalid_response";
          error_message = message;
          error_code = None;
          error_param = None;
          error_raw = None;
        }

  let send decode request =
    match Http.send request with
    | Error error -> Error (map_http_error error)
    | Ok response -> parse_response decode response

  let create_chat config request_body =
    send
      (chat_response_of_json config)
      (request config "/chat/completions"
         (Json (chat_request_json config request_body)))

  let create_response config request_body =
    send
      (responses_response_of_json config)
      (request config "/responses"
         (Json (responses_request_json config request_body)))

  let generate_image config request_body =
    send Openai.image_response_of_json
      (request config "/images/generations"
         (Json (image_request_json config request_body)))

  let create_embedding config request_body =
    send Openai.embedding_response_of_json
      (request config "/embeddings"
         (Json (embedding_request_json config request_body)))

  let list_models config =
    send Openai.model_list_of_json
      (request ~method_:"GET" config "/models" Empty)

  let retrieve_model config ~model_id =
    send Openai.model_of_json
      (request ~method_:"GET" config ("/models/" ^ model_id) Empty)
end

let compatible_message_of_provider_message (message : Provider.message) =
  let role =
    match message.role with
    | Provider.System -> Openai.System
    | Provider.User -> Openai.User
    | Provider.Assistant -> Openai.Assistant
    | Provider.Tool -> Openai.Tool
  in
  {
    Openai.message_role = role;
    message_content = message.content;
    message_name = message.name;
    message_tool_call_id = message.tool_call_id;
    message_tool_calls = message.tool_calls;
  }

let openai_function_tool_of_provider_tool (tool : Provider.tool_definition) =
  {
    Openai.tool_name = tool.tool_name;
    tool_description = tool.tool_description;
    tool_parameters = tool.tool_parameters;
    tool_strict = tool.tool_strict;
  }

let extra_fields (options : Provider.options) =
  let fields =
    match options.extra with
    | Some (Chatoyant_runtime.Json.Object fields) -> fields
    | _ -> []
  in
  let add name value fields =
    if List.mem_assoc name fields then fields else (name, value) :: fields
  in
  ( ( ( ( fields |> fun fields ->
          match options.frequency_penalty with
          | None -> fields
          | Some value ->
              add "frequency_penalty" (Chatoyant_runtime.Json.Float value)
                fields )
      |> fun fields ->
        match options.presence_penalty with
        | None -> fields
        | Some value ->
            add "presence_penalty" (Chatoyant_runtime.Json.Float value) fields
      )
    |> fun fields ->
      match options.reasoning_effort with
      | None -> fields
      | Some value ->
          add "reasoning_effort" (Chatoyant_runtime.Json.String value) fields )
  |> fun fields ->
    match options.thinking_budget with
    | None -> fields
    | Some value ->
        add "thinking_budget"
          (Chatoyant_runtime.Json.Float (Float.of_int value))
          fields )
  |> fun fields ->
  match options.web_search with
  | Some true -> add "web_search" (Chatoyant_runtime.Json.Bool true) fields
  | Some false -> add "web_search" (Chatoyant_runtime.Json.Bool false) fields
  | None -> fields

module Make_provider
    (Http : Chatoyant_runtime.Effect.HTTP)
    (Config : sig
      val provider_id : Provider.id
      val config : config
    end) =
struct
  module Client = Make_client (Http)

  let id = Config.provider_id

  let generate messages (options : Provider.options) =
    let request =
      {
        Openai.chat_model = options.model;
        chat_messages = List.map compatible_message_of_provider_message messages;
        chat_stream = false;
        chat_temperature = options.temperature;
        chat_max_tokens = options.max_tokens;
        chat_top_p = options.top_p;
        chat_stop = options.stop;
        chat_user = None;
        chat_seed = None;
        chat_logprobs = None;
        chat_top_logprobs = None;
        chat_n = None;
        chat_tools =
          List.map openai_function_tool_of_provider_tool options.tools;
        chat_tool_choice =
          Option.map (fun name -> Openai.Function_tool name) options.tool_choice;
        chat_parallel_tool_calls = None;
        chat_response_format = None;
        chat_extra = extra_fields options;
      }
    in
    match Client.create_chat Config.config request with
    | Ok response ->
        Ok (generation_of_chat_response_for_config Config.config response)
    | Error error -> Error (Provider.Runtime_error error.error_message)
end
