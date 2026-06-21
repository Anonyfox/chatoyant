type reasoning =
  | Off
  | Low
  | Medium
  | High

type creativity =
  | Precise
  | Balanced
  | Creative
  | Wild

type model_preset =
  | Fast
  | Cheap
  | Best
  | Balanced_model
  | Reasoning

type t = {
  provider : Chatoyant_provider.Provider.id option;
  model : string option;
  timeout_ms : int option;
  retries : int;
  temperature : float option;
  creativity : creativity option;
  max_tokens : int option;
  reasoning : reasoning option;
  extra : Chatoyant_runtime.Json.t option;
}

let default =
  {
    provider = None;
    model = None;
    timeout_ms = Some 120_000;
    retries = 3;
    temperature = None;
    creativity = None;
    max_tokens = None;
    reasoning = None;
    extra = None;
  }

let first_some right left =
  match right with
  | Some _ -> right
  | None -> left

let merge defaults overrides =
  {
    provider = first_some overrides.provider defaults.provider;
    model = first_some overrides.model defaults.model;
    timeout_ms = first_some overrides.timeout_ms defaults.timeout_ms;
    retries = overrides.retries;
    temperature = first_some overrides.temperature defaults.temperature;
    creativity = first_some overrides.creativity defaults.creativity;
    max_tokens = first_some overrides.max_tokens defaults.max_tokens;
    reasoning = first_some overrides.reasoning defaults.reasoning;
    extra = first_some overrides.extra defaults.extra;
  }

let temperature_of_creativity = function
  | Precise -> 0.0
  | Balanced -> 0.7
  | Creative -> 1.0
  | Wild -> 1.5
