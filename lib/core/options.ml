type reasoning = Off | Low | Medium | High
type creativity = Precise | Balanced | Creative | Wild
type model_preset = Fast | Cheap | Best | Balanced_model | Reasoning

type t = {
  provider : Chatoyant_provider.Provider.id option;
  model : string option;
  timeout_ms : int option;
  retries : int;
  local_base_url : string option;
  local_api_key : string option;
  local_timeout_ms : int option;
  temperature : float option;
  creativity : creativity option;
  max_tokens : int option;
  top_p : float option;
  stop : string list;
  frequency_penalty : float option;
  presence_penalty : float option;
  reasoning : reasoning option;
  web_search : bool option;
  thinking_budget : int option;
  max_tool_iterations : int;
  tool_timeout_ms : int option;
  extra : Chatoyant_runtime.Json.t option;
}

let default_timeout_ms = 120_000
let default_retries = 3
let default_max_tool_iterations = 50
let default_tool_timeout_ms = 10_000

let default =
  {
    provider = None;
    model = None;
    timeout_ms = Some default_timeout_ms;
    retries = default_retries;
    local_base_url = None;
    local_api_key = None;
    local_timeout_ms = Some 60_000;
    temperature = None;
    creativity = None;
    max_tokens = None;
    top_p = None;
    stop = [];
    frequency_penalty = None;
    presence_penalty = None;
    reasoning = None;
    web_search = None;
    thinking_budget = None;
    max_tool_iterations = default_max_tool_iterations;
    tool_timeout_ms = Some default_tool_timeout_ms;
    extra = None;
  }

let first_some right left = match right with Some _ -> right | None -> left
let first_non_empty right left = match right with [] -> left | _ -> right

let merge_extra left right =
  match (left, right) with
  | ( Some (Chatoyant_runtime.Json.Object left_fields),
      Some (Chatoyant_runtime.Json.Object right_fields) ) ->
      let without_overridden =
        List.filter
          (fun (name, _) -> not (List.mem_assoc name right_fields))
          left_fields
      in
      Some (Chatoyant_runtime.Json.Object (without_overridden @ right_fields))
  | Some _, Some _ -> right
  | None, Some _ -> right
  | Some _, None -> left
  | None, None -> None

let merge defaults overrides =
  {
    provider = first_some overrides.provider defaults.provider;
    model = first_some overrides.model defaults.model;
    timeout_ms = first_some overrides.timeout_ms defaults.timeout_ms;
    local_base_url = first_some overrides.local_base_url defaults.local_base_url;
    local_api_key = first_some overrides.local_api_key defaults.local_api_key;
    local_timeout_ms =
      first_some overrides.local_timeout_ms defaults.local_timeout_ms;
    retries = overrides.retries;
    temperature = first_some overrides.temperature defaults.temperature;
    creativity = first_some overrides.creativity defaults.creativity;
    max_tokens = first_some overrides.max_tokens defaults.max_tokens;
    top_p = first_some overrides.top_p defaults.top_p;
    stop = first_non_empty overrides.stop defaults.stop;
    frequency_penalty =
      first_some overrides.frequency_penalty defaults.frequency_penalty;
    presence_penalty =
      first_some overrides.presence_penalty defaults.presence_penalty;
    reasoning = first_some overrides.reasoning defaults.reasoning;
    web_search = first_some overrides.web_search defaults.web_search;
    thinking_budget =
      first_some overrides.thinking_budget defaults.thinking_budget;
    max_tool_iterations = overrides.max_tool_iterations;
    tool_timeout_ms =
      first_some overrides.tool_timeout_ms defaults.tool_timeout_ms;
    extra = merge_extra defaults.extra overrides.extra;
  }

let temperature_of_creativity = function
  | Precise -> 0.0
  | Balanced -> 0.7
  | Creative -> 1.0
  | Wild -> 1.5

let reasoning_effort = function
  | Off -> "none"
  | Low -> "low"
  | Medium -> "medium"
  | High -> "high"

let anthropic_thinking_budget = function
  | Off -> None
  | Low -> Some 2_048
  | Medium -> Some 8_192
  | High -> Some 32_768
