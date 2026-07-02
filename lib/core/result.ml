type timing = { latency_ms : int; time_to_first_token_ms : int option }

type token_speed = {
  output_tokens_per_second : float option;
  total_tokens_per_second : float option;
  measured_output_tokens : int;
  measured_total_tokens : int;
}

type cost = { estimated_usd : float; actual_usd : float option }

type generation = {
  content : string;
  reasoning_content : string;
  usage : Chatoyant_tokens.Cost.usage;
  usage_source : Chatoyant_tokens.Cost.source;
  timing : timing;
  token_speed : token_speed;
  cost : cost;
  provider : Chatoyant_provider.Provider.id;
  model : string;
  tool_calls : Chatoyant_provider.Provider.tool_call list;
  finish_reason : string option;
  cached : bool;
  iterations : int;
}

let empty_timing = { latency_ms = 0; time_to_first_token_ms = None }

let empty_token_speed =
  {
    output_tokens_per_second = None;
    total_tokens_per_second = None;
    measured_output_tokens = 0;
    measured_total_tokens = 0;
  }

let empty_cost = { estimated_usd = 0.0; actual_usd = None }

let rate ~latency_ms tokens =
  if latency_ms <= 0 || tokens <= 0 then None
  else Some (Float.of_int tokens /. (Float.of_int latency_ms /. 1000.0))

let token_speed ~latency_ms usage =
  let usage = Chatoyant_tokens.Cost.normalize_total usage in
  {
    output_tokens_per_second = rate ~latency_ms usage.output_tokens;
    total_tokens_per_second = rate ~latency_ms usage.total_tokens;
    measured_output_tokens = usage.output_tokens;
    measured_total_tokens = usage.total_tokens;
  }

let string value = Chatoyant_runtime.Json.String value
let int value = Chatoyant_runtime.Json.Float (Float.of_int value)
let float value = Chatoyant_runtime.Json.Float value

let add_opt name value fields =
  match value with None -> fields | Some value -> (name, value) :: fields

let timing_to_json timing =
  [ ("latency_ms", int timing.latency_ms) ]
  |> add_opt "time_to_first_token_ms"
       (Option.map int timing.time_to_first_token_ms)
  |> List.rev
  |> fun fields -> Chatoyant_runtime.Json.Object fields

let token_speed_to_json speed =
  [
    ("measured_output_tokens", int speed.measured_output_tokens);
    ("measured_total_tokens", int speed.measured_total_tokens);
  ]
  |> add_opt "output_tokens_per_second"
       (Option.map float speed.output_tokens_per_second)
  |> add_opt "total_tokens_per_second"
       (Option.map float speed.total_tokens_per_second)
  |> List.rev
  |> fun fields -> Chatoyant_runtime.Json.Object fields

let cost_to_json cost =
  [ ("estimated_usd", float cost.estimated_usd) ]
  |> add_opt "actual_usd" (Option.map float cost.actual_usd)
  |> List.rev
  |> fun fields -> Chatoyant_runtime.Json.Object fields

let generation_to_json generation =
  [
    ("content", string generation.content);
    ("reasoning_content", string generation.reasoning_content);
    ("usage", Chatoyant_tokens.Cost.usage_to_json generation.usage);
    ( "usage_source",
      string (Chatoyant_tokens.Cost.source_to_string generation.usage_source) );
    ("timing", timing_to_json generation.timing);
    ("token_speed", token_speed_to_json generation.token_speed);
    ("cost", cost_to_json generation.cost);
    ( "provider",
      string (Chatoyant_provider.Provider.string_of_id generation.provider) );
    ("model", string generation.model);
    ( "tool_calls",
      Chatoyant_runtime.Json.Array
        (List.map Chatoyant_provider.Provider.tool_call_to_json
           generation.tool_calls) );
    ("cached", Chatoyant_runtime.Json.Bool generation.cached);
    ("iterations", int generation.iterations);
  ]
  |> add_opt "finish_reason" (Option.map string generation.finish_reason)
  |> List.rev
  |> fun fields -> Chatoyant_runtime.Json.Object fields
