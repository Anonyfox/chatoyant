let table =
  [
    ("gpt-4o", 128_000);
    ("gpt-4o-mini", 128_000);
    ("gpt-5.4", 1_050_000);
    ("gpt-5.4-mini", 400_000);
    ("gpt-5.4-pro", 1_050_000);
    ("claude-opus-4-6", 1_000_000);
    ("claude-sonnet-4-6", 1_000_000);
    ("claude-haiku-4-5", 200_000);
    ("grok-4.20-0309-reasoning", 2_000_000);
    ("grok-4.20-0309-non-reasoning", 2_000_000);
    ("grok-4-1-fast-reasoning", 2_000_000);
    ("grok-4-1-fast-non-reasoning", 2_000_000);
  ]

let get ?fallback model =
  match List.assoc_opt model table with
  | Some value -> Some value
  | None -> fallback

let has model = Option.is_some (List.assoc_opt model table)
