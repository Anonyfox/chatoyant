let p ?cached ?cache_write_5m ?cache_write_1h ?per_image ?per_second ~input
    ~output () =
  Cost.pricing ?cached_per_million:cached
    ?cache_write_per_million:cache_write_5m
    ?cache_write_1h_per_million:cache_write_1h ?per_image ?per_second
    ~input_per_million:input ~output_per_million:output ()

let all =
  [
    ("gpt-5.6-sol", p ~input:5.0 ~output:30.0 ~cached:0.5 ());
    ("gpt-5.6-terra", p ~input:2.5 ~output:15.0 ~cached:0.25 ());
    ("gpt-5.6-luna", p ~input:1.0 ~output:6.0 ~cached:0.1 ());
    ("gpt-5.5", p ~input:5.0 ~output:30.0 ~cached:0.5 ());
    ("gpt-5.5-pro", p ~input:30.0 ~output:180.0 ());
    ("gpt-5.4", p ~input:2.5 ~output:15.0 ~cached:0.25 ());
    ("gpt-5.4-mini", p ~input:0.75 ~output:4.5 ~cached:0.075 ());
    ("gpt-5.4-nano", p ~input:0.2 ~output:1.25 ~cached:0.02 ());
    ("gpt-5.4-pro", p ~input:30.0 ~output:180.0 ());
    ("gpt-5.2", p ~input:1.75 ~output:14.0 ~cached:0.175 ());
    ("gpt-5.2-pro", p ~input:21.0 ~output:168.0 ());
    ("gpt-5.2-codex", p ~input:1.75 ~output:14.0 ~cached:0.175 ());
    ("gpt-5.1", p ~input:1.25 ~output:10.0 ~cached:0.125 ());
    ("gpt-5.1-codex", p ~input:1.25 ~output:10.0 ~cached:0.125 ());
    ("gpt-5.1-codex-max", p ~input:1.25 ~output:10.0 ~cached:0.125 ());
    ("gpt-5.1-codex-mini", p ~input:0.25 ~output:2.0 ~cached:0.025 ());
    ("gpt-5", p ~input:1.25 ~output:10.0 ~cached:0.125 ());
    ("gpt-5-pro", p ~input:15.0 ~output:120.0 ());
    ("gpt-5-mini", p ~input:0.25 ~output:2.0 ~cached:0.025 ());
    ("gpt-5-nano", p ~input:0.05 ~output:0.4 ~cached:0.005 ());
    ("gpt-5-codex", p ~input:1.25 ~output:10.0 ~cached:0.125 ());
    ("gpt-5-image", p ~input:10.0 ~output:10.0 ~cached:1.25 ());
    ("gpt-5-image-mini", p ~input:2.5 ~output:2.0 ~cached:0.25 ());
    ("gpt-4o", p ~input:2.5 ~output:10.0 ~cached:1.25 ());
    ("gpt-4o-2024-11-20", p ~input:2.5 ~output:10.0 ~cached:1.25 ());
    ("gpt-4o-2024-08-06", p ~input:2.5 ~output:10.0 ~cached:1.25 ());
    ("gpt-4o-2024-05-13", p ~input:5.0 ~output:15.0 ());
    ("gpt-4o-mini", p ~input:0.15 ~output:0.6 ~cached:0.075 ());
    ("gpt-4o-mini-2024-07-18", p ~input:0.15 ~output:0.6 ~cached:0.075 ());
    ("gpt-4.1", p ~input:2.0 ~output:8.0 ~cached:0.5 ());
    ("gpt-4.1-mini", p ~input:0.4 ~output:1.6 ~cached:0.1 ());
    ("gpt-4.1-nano", p ~input:0.1 ~output:0.4 ~cached:0.025 ());
    ("gpt-4-turbo", p ~input:5.0 ~output:15.0 ());
    ("gpt-4-turbo-2024-04-09", p ~input:5.0 ~output:15.0 ());
    ("gpt-4-turbo-preview", p ~input:5.0 ~output:15.0 ());
    ("gpt-4", p ~input:30.0 ~output:60.0 ());
    ("gpt-4-0613", p ~input:30.0 ~output:60.0 ());
    ("gpt-4-32k", p ~input:60.0 ~output:120.0 ());
    ("gpt-3.5-turbo", p ~input:0.5 ~output:1.5 ());
    ("gpt-3.5-turbo-0125", p ~input:0.5 ~output:1.5 ());
    ("gpt-3.5-turbo-16k", p ~input:3.0 ~output:4.0 ());
    ("o1", p ~input:15.0 ~output:60.0 ~cached:7.5 ());
    ("o1-2024-12-17", p ~input:15.0 ~output:60.0 ~cached:7.5 ());
    ("o1-preview", p ~input:15.0 ~output:60.0 ());
    ("o1-mini", p ~input:3.0 ~output:12.0 ());
    ("o1-pro", p ~input:150.0 ~output:600.0 ());
    ("o3", p ~input:2.0 ~output:8.0 ~cached:0.5 ());
    ("o3-2025-04-16", p ~input:2.0 ~output:8.0 ~cached:0.5 ());
    ("o3-mini", p ~input:1.1 ~output:4.4 ~cached:0.55 ());
    ("o3-mini-2025-01-31", p ~input:1.1 ~output:4.4 ~cached:0.55 ());
    ("o3-pro", p ~input:20.0 ~output:80.0 ());
    ("o3-deep-research", p ~input:10.0 ~output:40.0 ~cached:2.5 ());
    ("o4-mini", p ~input:1.1 ~output:4.4 ~cached:0.275 ());
    ("o4-mini-deep-research", p ~input:2.0 ~output:8.0 ());
    ("gpt-oss-120b", p ~input:0.039 ~output:0.19 ());
    ("gpt-oss-20b", p ~input:0.03 ~output:0.14 ());
    ("text-embedding-3-small", p ~input:0.02 ~output:0.0 ());
    ("text-embedding-3-large", p ~input:0.13 ~output:0.0 ());
    ("text-embedding-ada-002", p ~input:0.1 ~output:0.0 ());
    ( "claude-fable-5",
      p ~input:10.0 ~output:50.0 ~cached:1.0 ~cache_write_5m:12.5
        ~cache_write_1h:20.0 () );
    ( "claude-opus-4-8",
      p ~input:5.0 ~output:25.0 ~cached:0.5 ~cache_write_5m:6.25
        ~cache_write_1h:10.0 () );
    ( "claude-opus-4-7",
      p ~input:5.0 ~output:25.0 ~cached:0.5 ~cache_write_5m:6.25
        ~cache_write_1h:10.0 () );
    (* List price; an introductory $2/$10 per MTok applies through 2026-08-31. *)
    ( "claude-sonnet-5",
      p ~input:3.0 ~output:15.0 ~cached:0.3 ~cache_write_5m:3.75
        ~cache_write_1h:6.0 () );
    ( "claude-opus-4-6",
      p ~input:5.0 ~output:25.0 ~cached:0.5 ~cache_write_5m:6.25
        ~cache_write_1h:10.0 () );
    ( "claude-sonnet-4-6",
      p ~input:3.0 ~output:15.0 ~cached:0.3 ~cache_write_5m:3.75
        ~cache_write_1h:6.0 () );
    ( "claude-opus-4-5-20251101",
      p ~input:5.0 ~output:25.0 ~cached:0.5 ~cache_write_5m:6.25
        ~cache_write_1h:10.0 () );
    ( "claude-opus-4-5",
      p ~input:5.0 ~output:25.0 ~cached:0.5 ~cache_write_5m:6.25
        ~cache_write_1h:10.0 () );
    ( "claude-sonnet-4-5-20250929",
      p ~input:3.0 ~output:15.0 ~cached:0.3 ~cache_write_5m:3.75
        ~cache_write_1h:6.0 () );
    ( "claude-sonnet-4-5",
      p ~input:3.0 ~output:15.0 ~cached:0.3 ~cache_write_5m:3.75
        ~cache_write_1h:6.0 () );
    ( "claude-haiku-4-5-20251001",
      p ~input:1.0 ~output:5.0 ~cached:0.1 ~cache_write_5m:1.25
        ~cache_write_1h:2.0 () );
    ( "claude-haiku-4-5",
      p ~input:1.0 ~output:5.0 ~cached:0.1 ~cache_write_5m:1.25
        ~cache_write_1h:2.0 () );
    ( "claude-opus-4-1-20250805",
      p ~input:15.0 ~output:75.0 ~cached:1.5 ~cache_write_5m:18.75
        ~cache_write_1h:30.0 () );
    ( "claude-opus-4-1",
      p ~input:15.0 ~output:75.0 ~cached:1.5 ~cache_write_5m:18.75
        ~cache_write_1h:30.0 () );
    ( "claude-sonnet-4-20250514",
      p ~input:3.0 ~output:15.0 ~cached:0.3 ~cache_write_5m:3.75
        ~cache_write_1h:6.0 () );
    ( "claude-sonnet-4-0",
      p ~input:3.0 ~output:15.0 ~cached:0.3 ~cache_write_5m:3.75
        ~cache_write_1h:6.0 () );
    ( "claude-opus-4-20250514",
      p ~input:15.0 ~output:75.0 ~cached:1.5 ~cache_write_5m:18.75
        ~cache_write_1h:30.0 () );
    ( "claude-opus-4-0",
      p ~input:15.0 ~output:75.0 ~cached:1.5 ~cache_write_5m:18.75
        ~cache_write_1h:30.0 () );
    ( "claude-3-5-sonnet-20241022",
      p ~input:3.0 ~output:15.0 ~cached:0.3 ~cache_write_5m:3.75
        ~cache_write_1h:6.0 () );
    ( "claude-3-5-sonnet-20240620",
      p ~input:3.0 ~output:15.0 ~cached:0.3 ~cache_write_5m:3.75
        ~cache_write_1h:6.0 () );
    ( "claude-3-5-haiku-20241022",
      p ~input:0.8 ~output:4.0 ~cached:0.08 ~cache_write_5m:1.0
        ~cache_write_1h:1.6 () );
    ( "claude-3-opus-20240229",
      p ~input:15.0 ~output:75.0 ~cached:1.5 ~cache_write_5m:18.75
        ~cache_write_1h:30.0 () );
    ( "claude-3-haiku-20240307",
      p ~input:0.25 ~output:1.25 ~cached:0.03 ~cache_write_5m:0.3
        ~cache_write_1h:0.5 () );
    ("grok-4.5", p ~input:2.0 ~output:6.0 ~cached:0.5 ());
    ("grok-4.3", p ~input:1.25 ~output:2.5 ~cached:0.2 ());
    ("grok-4.20-0309-reasoning", p ~input:1.25 ~output:2.5 ~cached:0.2 ());
    ("grok-4.20-0309-non-reasoning", p ~input:1.25 ~output:2.5 ~cached:0.2 ());
    ("grok-4.20-multi-agent-0309", p ~input:1.25 ~output:2.5 ~cached:0.2 ());
    ("grok-4-1-fast-reasoning", p ~input:0.2 ~output:0.5 ~cached:0.05 ());
    ("grok-4-1-fast-non-reasoning", p ~input:0.2 ~output:0.5 ~cached:0.05 ());
    ("grok-4-fast-reasoning", p ~input:0.2 ~output:0.5 ~cached:0.05 ());
    ("grok-4-fast-non-reasoning", p ~input:0.2 ~output:0.5 ~cached:0.05 ());
    ("grok-4-0709", p ~input:3.0 ~output:15.0 ~cached:0.75 ());
    ("grok-4", p ~input:3.0 ~output:15.0 ~cached:0.75 ());
    ("grok-code-fast-1", p ~input:0.2 ~output:1.5 ~cached:0.02 ());
    ("grok-3", p ~input:3.0 ~output:15.0 ~cached:0.75 ());
    ("grok-3-mini", p ~input:0.3 ~output:0.5 ~cached:0.07 ());
    ("grok-2-vision-1212", p ~input:2.0 ~output:10.0 ());
    ("grok-imagine-image", p ~input:0.0 ~output:0.0 ~per_image:0.02 ());
    ("grok-imagine-image-pro", p ~input:0.0 ~output:0.0 ~per_image:0.07 ());
    ("grok-imagine-video", p ~input:0.0 ~output:0.0 ~per_second:0.05 ());
    ("grok-embedding-1", p ~input:0.0 ~output:0.0 ());
  ]

let starts_with ~prefix value =
  let prefix_len = String.length prefix in
  String.length value >= prefix_len && String.sub value 0 prefix_len = prefix

let contains text needle =
  let needle_len = String.length needle in
  let text_len = String.length text in
  let rec loop index =
    if needle_len = 0 then true
    else if index + needle_len > text_len then false
    else if String.sub text index needle_len = needle then true
    else loop (index + 1)
  in
  loop 0

let family_model model =
  let lower = String.lowercase_ascii model in
  if
    starts_with ~prefix:"claude" lower
    && (contains lower "fable" || contains lower "mythos")
  then Some "claude-fable-5"
  else if starts_with ~prefix:"claude" lower && contains lower "opus" then
    Some "claude-opus-4-8"
  else if starts_with ~prefix:"claude" lower && contains lower "sonnet" then
    Some "claude-sonnet-5"
  else if starts_with ~prefix:"claude" lower && contains lower "haiku" then
    Some "claude-haiku-4-5"
  else if starts_with ~prefix:"gpt-" lower && contains lower "-nano" then
    Some "gpt-5.4-nano"
  else if starts_with ~prefix:"gpt-" lower && contains lower "-mini" then
    Some "gpt-5.4-mini"
  else if starts_with ~prefix:"gpt-" lower && contains lower "-pro" then
    Some "gpt-5.4-pro"
  else if starts_with ~prefix:"gpt-" lower && contains lower "-codex" then
    Some "gpt-5.2-codex"
  else if starts_with ~prefix:"gpt-" lower && contains lower "o" then
    Some "gpt-4o"
  else if starts_with ~prefix:"gpt-" lower then Some "gpt-5.4"
  else if starts_with ~prefix:"o" lower && contains lower "-mini" then
    Some "o4-mini"
  else if starts_with ~prefix:"o" lower && contains lower "-pro" then
    Some "o3-pro"
  else if starts_with ~prefix:"o" lower then Some "o3"
  else if starts_with ~prefix:"grok-4.20" lower then
    Some "grok-4.20-0309-reasoning"
  else if starts_with ~prefix:"grok-" lower && contains lower "fast-reasoning"
  then Some "grok-4-1-fast-reasoning"
  else if
    starts_with ~prefix:"grok-" lower && contains lower "fast-non-reasoning"
  then Some "grok-4-1-fast-non-reasoning"
  else if starts_with ~prefix:"grok-" lower && contains lower "mini" then
    Some "grok-3-mini"
  else if starts_with ~prefix:"grok-" lower && contains lower "code" then
    Some "grok-code-fast-1"
  else if starts_with ~prefix:"grok-imagine-image-pro" lower then
    Some "grok-imagine-image-pro"
  else if starts_with ~prefix:"grok-imagine-image" lower then
    Some "grok-imagine-image"
  else if starts_with ~prefix:"grok-imagine-video" lower then
    Some "grok-imagine-video"
  else if starts_with ~prefix:"grok-" lower then Some "grok-4.5"
  else if starts_with ~prefix:"chatgpt" lower then Some "o1-pro"
  else None

let provider_max_model model =
  let lower = String.lowercase_ascii model in
  if starts_with ~prefix:"claude" lower then Some "claude-opus-4-1"
  else if
    starts_with ~prefix:"gpt-" lower
    || starts_with ~prefix:"chatgpt" lower
    || starts_with ~prefix:"o" lower
  then Some "o1-pro"
  else if starts_with ~prefix:"grok" lower then Some "grok-4-0709"
  else None

let get ?fallback model =
  match List.assoc_opt model all with
  | Some pricing -> Some pricing
  | None -> (
      match
        Option.bind (family_model model) (fun model -> List.assoc_opt model all)
      with
      | Some _ as pricing -> pricing
      | None -> (
          match
            Option.bind (provider_max_model model) (fun model ->
                List.assoc_opt model all)
          with
          | Some _ as pricing -> pricing
          | None -> fallback))

let has model = Option.is_some (List.assoc_opt model all)
