type t = {
  mutable session_model : string;
  mutable defaults : Options.t;
  mutable session_messages : Message.t list;
  mutable session_tools : Tool.t list;
  mutable session_last_result : Result.generation option;
}

let field = Chatoyant_runtime.Json.field
let string value = Chatoyant_runtime.Json.String value
let string_field name json = Option.bind (field name json) Chatoyant_runtime.Json.as_string

let add_opt name value fields =
  match value with
  | None -> fields
  | Some value -> (name, value) :: fields

let messages_of_json json =
  match field "messages" json with
  | Some (Chatoyant_runtime.Json.Array values) ->
      let rec loop acc = function
        | [] -> Ok (List.rev acc)
        | value :: rest -> (
            match Message.of_json value with
            | Ok message -> loop (message :: acc) rest
            | Error _ as err -> err)
      in
      loop [] values
  | _ -> Ok []

let options_to_json (options : Options.t) =
  let int value = Chatoyant_runtime.Json.Float (Float.of_int value) in
  let float value = Chatoyant_runtime.Json.Float value in
  [
    ("retries", int options.retries);
  ]
  |> add_opt "provider"
       (Option.map
          (fun provider -> string (Chatoyant_provider.Provider.string_of_id provider))
          options.provider)
  |> add_opt "model" (Option.map string options.model)
  |> add_opt "timeout_ms" (Option.map int options.timeout_ms)
  |> add_opt "temperature" (Option.map float options.temperature)
  |> add_opt "max_tokens" (Option.map int options.max_tokens)
  |> add_opt "extra" options.extra
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let int_field name json = Option.bind (field name json) Chatoyant_runtime.Json.as_int
let float_field name json = Option.bind (field name json) Chatoyant_runtime.Json.as_float

let options_of_json json =
  let provider =
    Option.bind (string_field "provider" json) Chatoyant_provider.Provider.id_of_string
  in
  {
    Options.default with
    provider;
    model = string_field "model" json;
    timeout_ms = int_field "timeout_ms" json;
    retries = Option.value (int_field "retries" json) ~default:Options.default.retries;
    temperature = float_field "temperature" json;
    max_tokens = int_field "max_tokens" json;
    extra = field "extra" json;
  }

module Make
    (Provider : Chatoyant_provider.Provider.CHAT)
    (Clock : Chatoyant_runtime.Effect.CLOCK) =
struct
  module Generator = Generator.Make (Provider) (Clock)

  let create ?(model = "gpt-4o") ?(defaults = Options.default) () =
    {
      session_model = model;
      defaults;
      session_messages = [];
      session_tools = [];
      session_last_result = None;
    }

  let model session = session.session_model

  let set_model model session =
    session.session_model <- model;
    session

  let messages session = session.session_messages
  let tools session = session.session_tools
  let last_result session = session.session_last_result

  let add_message message session =
    session.session_messages <- session.session_messages @ [ message ];
    session

  let add_messages messages session =
    session.session_messages <- session.session_messages @ messages;
    session

  let system content session = add_message (Message.system content) session
  let user content session = add_message (Message.user content) session
  let assistant content session = add_message (Message.assistant content) session

  let clear_messages session =
    session.session_messages <- [];
    session

  let add_tool tool session =
    session.session_tools <- session.session_tools @ [ tool ];
    session

  let add_tools tools session =
    session.session_tools <- session.session_tools @ tools;
    session

  let clear_tools session =
    session.session_tools <- [];
    session

  let immutable_chat_with messages session =
    let chat = Chat.create ~model:session.session_model ~defaults:session.defaults () in
    let chat = List.fold_left (fun chat message -> Chat.add_message message chat) chat messages in
    List.fold_left (fun chat tool -> Chat.add_tool tool chat) chat session.session_tools

  let merged_options session options = Options.merge session.defaults options

  let add_usage left right =
    {
      Chatoyant_tokens.Cost.input_tokens = left.Chatoyant_tokens.Cost.input_tokens + right.Chatoyant_tokens.Cost.input_tokens;
      output_tokens = left.output_tokens + right.output_tokens;
      reasoning_tokens = left.reasoning_tokens + right.reasoning_tokens;
      cached_tokens = left.cached_tokens + right.cached_tokens;
      cache_write_tokens = left.cache_write_tokens + right.cache_write_tokens;
      total_tokens = left.total_tokens + right.total_tokens;
      actual_cost_usd =
        (match (left.actual_cost_usd, right.actual_cost_usd) with
        | Some left, Some right -> Some (left +. right)
        | Some value, None | None, Some value -> Some value
        | None, None -> None);
    }
    |> Chatoyant_tokens.Cost.normalize_total

  let combine_usage_source left right =
    match (left, right) with
    | Chatoyant_tokens.Cost.Unknown, _ | _, Chatoyant_tokens.Cost.Unknown -> Chatoyant_tokens.Cost.Unknown
    | Chatoyant_tokens.Cost.Estimated, _ | _, Chatoyant_tokens.Cost.Estimated -> Chatoyant_tokens.Cost.Estimated
    | Chatoyant_tokens.Cost.Provider_reported, Chatoyant_tokens.Cost.Provider_reported ->
        Chatoyant_tokens.Cost.Provider_reported
    | Chatoyant_tokens.Cost.Unmetered, Chatoyant_tokens.Cost.Unmetered -> Chatoyant_tokens.Cost.Unmetered
    | Chatoyant_tokens.Cost.Provider_reported, Chatoyant_tokens.Cost.Unmetered
    | Chatoyant_tokens.Cost.Unmetered, Chatoyant_tokens.Cost.Provider_reported ->
        Chatoyant_tokens.Cost.Provider_reported

  let add_actual_cost left right =
    match (left, right) with
    | Some left, Some right -> Some (left +. right)
    | Some value, None | None, Some value -> Some value
    | None, None -> None

  let join_reasoning left right =
    match (left, right) with
    | "", value | value, "" -> value
    | left, right -> left ^ "\n" ^ right

  let combine_results left right =
    let usage = add_usage left.Result.usage right.Result.usage in
    let latency_ms = left.timing.latency_ms + right.timing.latency_ms in
    {
      right with
      Result.reasoning_content = join_reasoning left.reasoning_content right.reasoning_content;
      usage;
      usage_source = combine_usage_source left.usage_source right.usage_source;
      timing =
        {
          Result.latency_ms;
          time_to_first_token_ms =
            (match left.timing.time_to_first_token_ms with
            | Some _ as value -> value
            | None -> right.timing.time_to_first_token_ms);
        };
      token_speed = Result.token_speed ~latency_ms usage;
      cost =
        {
          Result.estimated_usd = left.cost.estimated_usd +. right.cost.estimated_usd;
          actual_usd = add_actual_cost left.cost.actual_usd right.cost.actual_usd;
        };
      tool_calls = left.tool_calls @ right.tool_calls;
      cached = left.cached || right.cached;
      iterations = left.iterations + right.iterations;
    }

  let provider_call_to_tool_call (call : Chatoyant_provider.Provider.tool_call) : Tool.call =
    { Tool.id = call.id; name = call.name; arguments = call.arguments }

  let unknown_tool_result (call : Chatoyant_provider.Provider.tool_call) : Tool.result =
    {
      Tool.id = call.id;
      ok = false;
      value = None;
      error = Some ("Unknown tool: " ^ call.name);
    }

  let execute_tool_call context tools (call : Chatoyant_provider.Provider.tool_call) =
    match List.find_opt (fun tool -> Tool.name tool = call.name) tools with
    | None -> unknown_tool_result call
    | Some tool -> Tool.execute_call context (provider_call_to_tool_call call) tool

  let message_of_tool_result (result : Tool.result) =
    let content = Tool.result_to_json result |> Chatoyant_runtime.Json.to_string in
    Message.tool ~is_error:(not result.ok) ~tool_call_id:result.id content

  let assistant_message_of_result result =
    if result.Result.tool_calls = [] then Message.assistant result.content
    else Message.assistant_with_tool_calls ~content:result.content result.tool_calls

  let generate_with_result ?(options = Options.default) session =
    let options = merged_options session options in
    let model = Option.value options.model ~default:session.session_model in
    let context = { Tool.model; provider = Provider.id } in
    let max_tool_iterations = 8 in
    let rec loop iteration messages accumulated =
      if iteration > max_tool_iterations then
        Error
          (Chatoyant_provider.Provider.Runtime_error
             ("tool iteration limit exceeded after " ^ string_of_int max_tool_iterations ^ " turns"))
      else
        match Generator.generate ~options (immutable_chat_with messages session) with
        | Error _ as err -> err
        | Ok result ->
            let accumulated =
              match accumulated with
              | None -> result
              | Some previous -> combine_results previous result
            in
            let messages = messages @ [ assistant_message_of_result result ] in
            if result.tool_calls = [] then (
              session.session_messages <- messages;
              session.session_last_result <- Some accumulated;
              Ok accumulated)
            else
              let tool_messages =
                result.tool_calls
                |> List.map (execute_tool_call context session.session_tools)
                |> List.map message_of_tool_result
              in
              loop (iteration + 1) (messages @ tool_messages) (Some accumulated)
    in
    loop 1 session.session_messages None

  let generate ?options session =
    match generate_with_result ?options session with
    | Error _ as err -> err
    | Ok result -> Ok result.content

  let stream_accumulate ?(options = Options.default) frames session =
    let options = merged_options session options in
    let started_ms = Clock.now_ms () in
    let state =
      List.fold_left
        (fun state frame ->
          let state =
            if Stream.content state = "" && Stream.reasoning_content state = "" then
              Stream.note_first_token ~now_ms:(Clock.now_ms ()) state
            else state
          in
          Stream.apply state frame)
        Stream.empty frames
    in
    let finished_ms = Clock.now_ms () in
    let model = Option.value options.model ~default:session.session_model in
    let result =
      Stream.to_generation ~provider:Provider.id ~model ~started_ms ~finished_ms state
    in
    session.session_last_result <- Some result;
    session.session_messages <- session.session_messages @ [ Message.assistant result.content ];
    result

  let to_json session =
    [
      ("model", string session.session_model);
      ("messages", Chatoyant_runtime.Json.Array (List.map Message.to_json session.session_messages));
      ("config", Chatoyant_runtime.Json.Object [ ("defaults", options_to_json session.defaults) ]);
    ]
    |> add_opt "lastResult" (Option.map Result.generation_to_json session.session_last_result)
    |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

  let stringify ?(pretty = false) session =
    let json = to_json session |> Chatoyant_runtime.Json.to_string in
    if pretty then json else json

  let load_json json session =
    match messages_of_json json with
    | Error _ as err -> err
    | Ok messages ->
        session.session_model <- Option.value (string_field "model" json) ~default:session.session_model;
        session.session_messages <- messages;
        session.defaults <-
          (match field "config" json with
          | Some config -> (
              match field "defaults" config with
              | Some defaults -> options_of_json defaults
              | None -> session.defaults)
          | None -> session.defaults);
        session.session_last_result <- None;
        Ok session

  let of_json json =
    let session = create () in
    load_json json session

  let clone session =
    {
      session_model = session.session_model;
      defaults = session.defaults;
      session_messages = session.session_messages;
      session_tools = session.session_tools;
      session_last_result = session.session_last_result;
    }

  let fork session =
    {
      session_model = session.session_model;
      defaults = session.defaults;
      session_messages = session.session_messages;
      session_tools = session.session_tools;
      session_last_result = None;
    }
end
