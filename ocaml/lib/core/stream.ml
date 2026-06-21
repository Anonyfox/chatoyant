type tool_call_delta = {
  index : int;
  id : string option;
  name : string option;
  arguments_delta : string;
  raw : Chatoyant_runtime.Json.t option;
}

type frame = {
  content_delta : string option;
  reasoning_delta : string option;
  tool_call_deltas : tool_call_delta list;
  usage : Chatoyant_tokens.Cost.usage option;
  usage_source : Chatoyant_tokens.Cost.source;
  finish_reason : string option;
  raw : Chatoyant_runtime.Json.t option;
}

type partial_tool_call = {
  index : int;
  id : string option;
  name : string option;
  arguments_buffer : string;
  raw : Chatoyant_runtime.Json.t option;
}

type state = {
  stream_content : string;
  stream_reasoning_content : string;
  stream_tool_calls : partial_tool_call list;
  stream_usage : Chatoyant_tokens.Cost.usage;
  stream_usage_source : Chatoyant_tokens.Cost.source;
  stream_finish_reason : string option;
  first_token_ms : int option;
  raw_frames : Chatoyant_runtime.Json.t list;
}

let empty =
  {
    stream_content = "";
    stream_reasoning_content = "";
    stream_tool_calls = [];
    stream_usage = Chatoyant_tokens.Cost.empty_usage;
    stream_usage_source = Chatoyant_tokens.Cost.Unknown;
    stream_finish_reason = None;
    first_token_ms = None;
    raw_frames = [];
  }

let merge_opt incoming current =
  match incoming with
  | Some _ -> incoming
  | None -> current

let apply_tool_delta tools (delta : tool_call_delta) =
  let rec loop acc = function
    | [] ->
        List.rev
          ({
             index = delta.index;
             id = delta.id;
             name = delta.name;
             arguments_buffer = delta.arguments_delta;
             raw = delta.raw;
           }
          :: acc)
    | tool :: rest when tool.index = delta.index ->
        List.rev_append acc
          ({
             index = tool.index;
             id = merge_opt delta.id tool.id;
             name = merge_opt delta.name tool.name;
             arguments_buffer = tool.arguments_buffer ^ delta.arguments_delta;
             raw = merge_opt delta.raw tool.raw;
           }
          :: rest)
    | tool :: rest -> loop (tool :: acc) rest
  in
  loop [] tools

let apply state (frame : frame) =
  let state =
    {
      state with
      stream_content = state.stream_content ^ Option.value frame.content_delta ~default:"";
      stream_reasoning_content =
        state.stream_reasoning_content ^ Option.value frame.reasoning_delta ~default:"";
      stream_tool_calls =
        List.fold_left apply_tool_delta state.stream_tool_calls frame.tool_call_deltas;
      stream_finish_reason = merge_opt frame.finish_reason state.stream_finish_reason;
      raw_frames =
        (match frame.raw with
        | None -> state.raw_frames
        | Some raw -> raw :: state.raw_frames);
    }
  in
  match frame.usage with
  | None -> state
  | Some usage ->
      {
        state with
        stream_usage = Chatoyant_tokens.Cost.normalize_total usage;
        stream_usage_source = frame.usage_source;
      }

let note_first_token ~now_ms state =
  match state.first_token_ms with
  | Some _ -> state
  | None -> { state with first_token_ms = Some now_ms }

let content state = state.stream_content
let reasoning_content state = state.stream_reasoning_content
let usage state = state.stream_usage
let usage_source state = state.stream_usage_source
let finish_reason state = state.stream_finish_reason

let provider_tool_call_of_partial tool =
  let arguments =
    match Chatoyant_runtime.Json.parse tool.arguments_buffer with
    | Ok json -> json
    | Error _ -> Chatoyant_runtime.Json.Null
  in
  {
    Chatoyant_provider.Provider.id = Option.value tool.id ~default:("");
    name = Option.value tool.name ~default:"";
    arguments;
    arguments_json = tool.arguments_buffer;
    raw = tool.raw;
  }

let tool_calls state =
  state.stream_tool_calls
  |> List.sort (fun left right -> compare left.index right.index)
  |> List.map provider_tool_call_of_partial

let to_generation ~provider ~model ~started_ms ~finished_ms state =
  let latency_ms = max 0 (finished_ms - started_ms) in
  let timing =
    {
      Result.latency_ms;
      time_to_first_token_ms =
        Option.map (fun first -> max 0 (first - started_ms)) state.first_token_ms;
    }
  in
  let usage = Chatoyant_tokens.Cost.normalize_total state.stream_usage in
  let cost_result =
    Chatoyant_tokens.Cost.calculate ~pricing:(Chatoyant_tokens.Pricing.get model) usage
  in
  {
    Result.content = state.stream_content;
    reasoning_content = state.stream_reasoning_content;
    usage;
    usage_source = state.stream_usage_source;
    timing;
    token_speed = Result.token_speed ~latency_ms usage;
    cost = { estimated_usd = cost_result.total; actual_usd = cost_result.actual_usd };
    provider;
    model;
    tool_calls = tool_calls state;
    finish_reason = state.stream_finish_reason;
    cached = usage.cached_tokens > 0;
    iterations = 1;
  }

let string value = Chatoyant_runtime.Json.String value
let int value = Chatoyant_runtime.Json.Float (Float.of_int value)

let add_opt name value fields =
  match value with
  | None -> fields
  | Some value -> (name, value) :: fields

let tool_call_delta_to_json (delta : tool_call_delta) =
  [
    ("index", int delta.index);
    ("arguments_delta", string delta.arguments_delta);
  ]
  |> add_opt "id" (Option.map string delta.id)
  |> add_opt "name" (Option.map string delta.name)
  |> add_opt "raw" delta.raw
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let frame_to_json (frame : frame) =
  [
    ( "tool_call_deltas",
      Chatoyant_runtime.Json.Array (List.map tool_call_delta_to_json frame.tool_call_deltas) );
    ( "usage_source",
      string (Chatoyant_tokens.Cost.source_to_string frame.usage_source) );
  ]
  |> add_opt "content_delta" (Option.map string frame.content_delta)
  |> add_opt "reasoning_delta" (Option.map string frame.reasoning_delta)
  |> add_opt "usage" (Option.map Chatoyant_tokens.Cost.usage_to_json frame.usage)
  |> add_opt "finish_reason" (Option.map string frame.finish_reason)
  |> add_opt "raw" frame.raw
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let state_to_json (state : state) =
  [
    ("content", string state.stream_content);
    ("reasoning_content", string state.stream_reasoning_content);
    ( "tool_calls",
      Chatoyant_runtime.Json.Array
        (List.map Chatoyant_provider.Provider.tool_call_to_json (tool_calls state)) );
    ("usage", Chatoyant_tokens.Cost.usage_to_json state.stream_usage);
    ( "usage_source",
      string (Chatoyant_tokens.Cost.source_to_string state.stream_usage_source) );
    ("raw_frames", Chatoyant_runtime.Json.Array (List.rev state.raw_frames));
  ]
  |> add_opt "finish_reason" (Option.map string state.stream_finish_reason)
  |> add_opt "first_token_ms" (Option.map int state.first_token_ms)
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields
