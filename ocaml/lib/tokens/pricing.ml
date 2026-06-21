let table =
  [
    ("gpt-4o", { Cost.input_per_million = 2.5; output_per_million = 10.0; cached_per_million = Some 1.25; cache_write_per_million = None });
    ("gpt-4o-mini", { Cost.input_per_million = 0.15; output_per_million = 0.6; cached_per_million = Some 0.075; cache_write_per_million = None });
    ("gpt-5.4", { Cost.input_per_million = 2.5; output_per_million = 15.0; cached_per_million = Some 0.25; cache_write_per_million = None });
    ("gpt-5.4-mini", { Cost.input_per_million = 0.75; output_per_million = 4.5; cached_per_million = Some 0.075; cache_write_per_million = None });
    ("gpt-5.4-pro", { Cost.input_per_million = 30.0; output_per_million = 180.0; cached_per_million = None; cache_write_per_million = None });
    ("claude-opus-4-6", { Cost.input_per_million = 5.0; output_per_million = 25.0; cached_per_million = Some 0.5; cache_write_per_million = Some 6.25 });
    ("claude-sonnet-4-6", { Cost.input_per_million = 3.0; output_per_million = 15.0; cached_per_million = Some 0.3; cache_write_per_million = Some 3.75 });
    ("claude-haiku-4-5", { Cost.input_per_million = 1.0; output_per_million = 5.0; cached_per_million = Some 0.1; cache_write_per_million = Some 1.25 });
    ("grok-4.20-0309-reasoning", { Cost.input_per_million = 2.0; output_per_million = 6.0; cached_per_million = Some 0.2; cache_write_per_million = None });
    ("grok-4.20-0309-non-reasoning", { Cost.input_per_million = 2.0; output_per_million = 6.0; cached_per_million = Some 0.2; cache_write_per_million = None });
    ("grok-4-1-fast-reasoning", { Cost.input_per_million = 0.2; output_per_million = 0.5; cached_per_million = Some 0.05; cache_write_per_million = None });
    ("grok-4-1-fast-non-reasoning", { Cost.input_per_million = 0.2; output_per_million = 0.5; cached_per_million = Some 0.05; cache_write_per_million = None });
  ]

let starts_with ~prefix value =
  let prefix_len = String.length prefix in
  String.length value >= prefix_len && String.sub value 0 prefix_len = prefix

let family_model model =
  let lower = String.lowercase_ascii model in
  if starts_with ~prefix:"claude" lower && String.contains lower 'o' && String.contains lower 'p'
  then Some "claude-opus-4-6"
  else if starts_with ~prefix:"claude" lower && String.contains lower 's' then
    Some "claude-sonnet-4-6"
  else if starts_with ~prefix:"claude" lower && String.contains lower 'h' then
    Some "claude-haiku-4-5"
  else if starts_with ~prefix:"gpt-" lower && String.contains lower 'm' then Some "gpt-5.4-mini"
  else if starts_with ~prefix:"gpt-" lower && String.contains lower 'p' then Some "gpt-5.4-pro"
  else if starts_with ~prefix:"gpt-" lower then Some "gpt-5.4"
  else if starts_with ~prefix:"grok-4-1-fast" lower then Some "grok-4-1-fast-reasoning"
  else if starts_with ~prefix:"grok-4.20" lower then Some "grok-4.20-0309-reasoning"
  else None

let get model =
  match List.assoc_opt model table with
  | Some pricing -> Some pricing
  | None -> Option.bind (family_model model) (fun model -> List.assoc_opt model table)

let has model = Option.is_some (get model)
