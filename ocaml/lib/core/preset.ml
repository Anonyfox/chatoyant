type model_preset =
  | Fast
  | Cheap
  | Best
  | Balanced
  | Reasoning

type reasoning =
  | Off
  | Low
  | Medium
  | High

type creativity =
  | Precise
  | Balanced_creativity
  | Creative
  | Wild

type reasoning_config = {
  openai_effort : string;
  anthropic_budget_tokens : int option;
  xai_prefer_reasoning_model : bool;
}

open Chatoyant_provider.Provider

let model_preset_of_string = function
  | "fast" -> Some Fast
  | "cheap" -> Some Cheap
  | "best" -> Some Best
  | "balanced" -> Some Balanced
  | "reasoning" -> Some Reasoning
  | _ -> None

let string_of_model_preset = function
  | Fast -> "fast"
  | Cheap -> "cheap"
  | Best -> "best"
  | Balanced -> "balanced"
  | Reasoning -> "reasoning"

let resolve_model_preset ~provider preset =
  match (preset, provider) with
  | Fast, Openai -> Some "gpt-4o-mini"
  | Fast, Anthropic -> Some "claude-haiku-4-5"
  | Fast, Xai -> Some "grok-4-1-fast-non-reasoning"
  | Cheap, Openai -> Some "gpt-5.4-mini"
  | Cheap, Anthropic -> Some "claude-haiku-4-5"
  | Cheap, Xai -> Some "grok-4-1-fast-non-reasoning"
  | Best, Openai -> Some "gpt-5.4"
  | Best, Anthropic -> Some "claude-opus-4-6"
  | Best, Xai -> Some "grok-4.20-0309-reasoning"
  | Balanced, Openai -> Some "gpt-5.4-mini"
  | Balanced, Anthropic -> Some "claude-sonnet-4-6"
  | Balanced, Xai -> Some "grok-4-1-fast-reasoning"
  | Reasoning, Openai -> Some "gpt-5.4-pro"
  | Reasoning, Anthropic -> Some "claude-opus-4-6"
  | Reasoning, Xai -> Some "grok-4.20-0309-reasoning"
  | _, (Local | Openrouter) -> None

let temperature_of_creativity = function
  | Precise -> 0.0
  | Balanced_creativity -> 0.7
  | Creative -> 1.0
  | Wild -> 1.5

let reasoning_config = function
  | Off ->
      { openai_effort = "none"; anthropic_budget_tokens = None; xai_prefer_reasoning_model = false }
  | Low ->
      {
        openai_effort = "low";
        anthropic_budget_tokens = Some 2_048;
        xai_prefer_reasoning_model = false;
      }
  | Medium ->
      {
        openai_effort = "medium";
        anthropic_budget_tokens = Some 8_192;
        xai_prefer_reasoning_model = true;
      }
  | High ->
      {
        openai_effort = "high";
        anthropic_budget_tokens = Some 32_768;
        xai_prefer_reasoning_model = true;
      }

let starts_with ~prefix value =
  let prefix_len = String.length prefix in
  String.length value >= prefix_len && String.sub value 0 prefix_len = prefix

let supports_openai_reasoning model =
  List.exists
    (fun prefix -> starts_with ~prefix model)
    [ "gpt-5"; "o1"; "o3"; "o4" ]

let adjust_xai_model_for_reasoning ~prefer_reasoning model =
  match (model, prefer_reasoning) with
  | "grok-4.20-0309-reasoning", false -> "grok-4.20-0309-non-reasoning"
  | "grok-4.20-0309-non-reasoning", true -> "grok-4.20-0309-reasoning"
  | "grok-4-1-fast-reasoning", false -> "grok-4-1-fast-non-reasoning"
  | "grok-4-1-fast-non-reasoning", true -> "grok-4-1-fast-reasoning"
  | "grok-4-fast-reasoning", false -> "grok-4-fast-non-reasoning"
  | "grok-4-fast-non-reasoning", true -> "grok-4-fast-reasoning"
  | _ -> model
