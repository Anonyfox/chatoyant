let field = Chatoyant_runtime.Json.field

let int_field name json =
  match Option.bind (field name json) Chatoyant_runtime.Json.as_int with
  | Some value -> value
  | None -> 0

let nested_int parent name json =
  match field parent json with
  | None -> 0
  | Some nested -> int_field name nested

let float_field name json =
  match Option.bind (field name json) Chatoyant_runtime.Json.as_float with
  | Some value -> value
  | None -> 0.0

let openai_compatible json =
  {
    Chatoyant_tokens.Cost.input_tokens = int_field "prompt_tokens" json;
    output_tokens = int_field "completion_tokens" json;
    reasoning_tokens =
      nested_int "completion_tokens_details" "reasoning_tokens" json;
    cached_tokens = nested_int "prompt_tokens_details" "cached_tokens" json;
    cache_write_tokens =
      nested_int "prompt_tokens_details" "cache_write_tokens" json;
    total_tokens = int_field "total_tokens" json;
    actual_cost_usd = None;
  }

let anthropic json =
  {
    Chatoyant_tokens.Cost.input_tokens = int_field "input_tokens" json;
    output_tokens = int_field "output_tokens" json;
    reasoning_tokens = 0;
    cached_tokens = int_field "cache_read_input_tokens" json;
    cache_write_tokens = int_field "cache_creation_input_tokens" json;
    total_tokens =
      int_field "input_tokens" json + int_field "output_tokens" json;
    actual_cost_usd = None;
  }

let xai json =
  let base = openai_compatible json in
  let ticks = float_field "cost_in_usd_ticks" json in
  {
    base with
    actual_cost_usd =
      (if ticks > 0.0 then Some (ticks /. 10_000_000_000.0) else None);
  }

let openrouter json =
  let base = openai_compatible json in
  let credits = float_field "cost" json in
  {
    base with
    actual_cost_usd =
      (if credits > 0.0 then Some (credits *. 0.000001) else None);
  }
