type usage = {
  input_tokens : int;
  output_tokens : int;
  reasoning_tokens : int;
  cached_tokens : int;
  cache_write_tokens : int;
  total_tokens : int;
  actual_cost_usd : float option;
}

type source =
  | Provider_reported
  | Estimated
  | Unmetered
  | Unknown

type pricing = {
  input_per_million : float;
  output_per_million : float;
  cached_per_million : float option;
  cache_write_per_million : float option;
  cache_write_1h_per_million : float option;
  per_image : float option;
  per_second : float option;
}

type result = {
  input : float;
  output : float;
  cached : float;
  cache_write : float;
  actual_usd : float option;
  total : float;
}

type cost_per_token = {
  per_token_input : float;
  per_token_output : float;
  per_token_cached : float;
  per_token_cache_write : float;
}

let empty_usage =
  {
    input_tokens = 0;
    output_tokens = 0;
    reasoning_tokens = 0;
    cached_tokens = 0;
    cache_write_tokens = 0;
    total_tokens = 0;
    actual_cost_usd = None;
  }

let pricing ?cached_per_million ?cache_write_per_million ?cache_write_1h_per_million ?per_image
    ?per_second ~input_per_million ~output_per_million () =
  {
    input_per_million;
    output_per_million;
    cached_per_million;
    cache_write_per_million;
    cache_write_1h_per_million;
    per_image;
    per_second;
  }

let per_million tokens price = (Float.of_int tokens /. 1_000_000.0) *. price

let normalize_total usage =
  let calculated_total = usage.input_tokens + usage.output_tokens in
  if usage.total_tokens > 0 then usage
  else { usage with total_tokens = calculated_total }

let zero actual_usd =
  {
    input = 0.0;
    output = 0.0;
    cached = 0.0;
    cache_write = 0.0;
    actual_usd;
    total = Option.value actual_usd ~default:0.0;
  }

let calculate ~pricing usage =
  let usage = normalize_total usage in
  match usage.actual_cost_usd with
  | Some actual when actual > 0.0 -> zero (Some actual)
  | _ -> (
      match pricing with
      | None -> zero None
      | Some pricing ->
          let billable_input =
            max 0 (usage.input_tokens - usage.cached_tokens - usage.cache_write_tokens)
          in
          let input = per_million billable_input pricing.input_per_million in
          let output = per_million usage.output_tokens pricing.output_per_million in
          let cached =
            match pricing.cached_per_million with
            | None -> 0.0
            | Some price -> per_million usage.cached_tokens price
          in
          let cache_write =
            match pricing.cache_write_per_million with
            | None -> 0.0
            | Some price -> per_million usage.cache_write_tokens price
          in
          { input; output; cached; cache_write; actual_usd = None; total = input +. output +. cached +. cache_write })

let estimate ~pricing ?input_tokens ?input_text ~expected_output_tokens () =
  let estimated_input =
    match input_tokens with
    | Some value -> value
    | None -> (
        match input_text with
        | Some text -> Token_estimate.estimate text
        | None -> 0)
  in
  calculate ~pricing { empty_usage with input_tokens = estimated_input; output_tokens = expected_output_tokens }

let calculate_batch ~pricing usages =
  let total =
    List.fold_left
      (fun acc usage ->
        let normalized_usage = normalize_total usage in
        {
          input_tokens = acc.input_tokens + usage.input_tokens;
          output_tokens = acc.output_tokens + usage.output_tokens;
          reasoning_tokens = acc.reasoning_tokens + usage.reasoning_tokens;
          cached_tokens = acc.cached_tokens + usage.cached_tokens;
          cache_write_tokens = acc.cache_write_tokens + usage.cache_write_tokens;
          total_tokens = acc.total_tokens + normalized_usage.total_tokens;
          actual_cost_usd =
            (match (acc.actual_cost_usd, usage.actual_cost_usd) with
            | Some left, Some right -> Some (left +. right)
            | Some value, None | None, Some value -> Some value
            | None, None -> None);
        })
      empty_usage usages
  in
  calculate ~pricing total

let calculate_image ~pricing ~count =
  match pricing with
  | Some { per_image = Some price; _ } -> price *. Float.of_int count
  | _ -> 0.0

let calculate_video ~pricing ~duration_seconds =
  match pricing with
  | Some { per_second = Some price; _ } -> price *. Float.of_int duration_seconds
  | _ -> 0.0

let cost_per_token pricing =
  {
    per_token_input = pricing.input_per_million /. 1_000_000.0;
    per_token_output = pricing.output_per_million /. 1_000_000.0;
    per_token_cached = Option.value pricing.cached_per_million ~default:0.0 /. 1_000_000.0;
    per_token_cache_write =
      Option.value pricing.cache_write_per_million ~default:0.0 /. 1_000_000.0;
  }

let source_to_string = function
  | Provider_reported -> "provider_reported"
  | Estimated -> "estimated"
  | Unmetered -> "unmetered"
  | Unknown -> "unknown"

let json_float value = Chatoyant_runtime.Json.Float value
let json_int value = Chatoyant_runtime.Json.Float (Float.of_int value)

let add_float_opt name value fields =
  match value with
  | None -> fields
  | Some value -> (name, json_float value) :: fields

let usage_to_json usage =
  let usage = normalize_total usage in
  [
    ("input_tokens", json_int usage.input_tokens);
    ("output_tokens", json_int usage.output_tokens);
    ("reasoning_tokens", json_int usage.reasoning_tokens);
    ("cached_tokens", json_int usage.cached_tokens);
    ("cache_write_tokens", json_int usage.cache_write_tokens);
    ("total_tokens", json_int usage.total_tokens);
  ]
  |> add_float_opt "actual_cost_usd" usage.actual_cost_usd
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let result_to_json result =
  [
    ("input", json_float result.input);
    ("output", json_float result.output);
    ("cached", json_float result.cached);
    ("cache_write", json_float result.cache_write);
    ("total", json_float result.total);
  ]
  |> add_float_opt "actual_usd" result.actual_usd
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields
