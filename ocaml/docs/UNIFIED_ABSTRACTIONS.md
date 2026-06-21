# Unified Abstractions

This layer sits above raw provider mirrors. Raw providers stay faithful to their
official APIs; unified abstractions make application code deterministic,
JSON-serializable, and safe across providers.

## Result Invariants

- `Chatoyant_core.Result.generation` is the high-level result type.
- Every generation is JSON-serializable through `generation_to_json`.
- `usage_source` is explicit:
  - `provider_reported`: authoritative provider token/cost values.
  - `estimated`: local fallback when no provider values exist.
  - `unmetered`: local inference; counts may exist, but cost is not billable.
  - `unknown`: no trustworthy usage data.
- `actual_usd` from provider usage wins over pricing-table estimates.
- Token totals are normalized only when providers omit `total_tokens`.
- Token speeds are derived only from elapsed milliseconds and usage counts; no
  speed is emitted when counts or elapsed time are zero.

## Streaming Invariants

- Raw provider stream decoders map events into `Chatoyant_core.Stream.frame`.
- The stream accumulator concatenates content and reasoning deltas in order.
- Tool-call deltas are merged by stable provider index.
- Fragmented tool arguments keep both `arguments_json` and best-effort parsed
  JSON. Invalid/partial JSON becomes `Null` until complete.
- The latest usage frame replaces previous usage, preserving the frame's
  `usage_source`.
- `time_to_first_token_ms` is recorded once through `note_first_token`.

## Tool Invariants

- Core `Message`, `Tool.call`, `Tool.result`, provider `tool_call`, and final
  `Result.generation` all have stable JSON encoders.
- Tool argument validation happens before execution.
- Tool result validation happens when a result schema is provided.
- Provider-specific tool blocks are normalized before reaching the unified core.
- `Session.generate_with_result` owns the generic multi-iteration tool loop:
  provider tool calls are recorded as assistant messages, OCaml executes matching
  registered tools, tool results are appended with explicit success/error state,
  and the model is called again until no tool calls remain.
- Tool loops are bounded. If a model keeps requesting tools after the internal
  limit, generation fails instead of spinning indefinitely.
- Assistant tool calls remain in message history so the next provider turn can
  serialize the exact transcript required by Responses, Chat Completions,
  Anthropic Messages, OpenRouter, xAI, or local OpenAI-compatible providers.

## Accounting Rules

- OpenAI/OpenRouter/xAI hosted generations are `provider_reported` when usage is
  returned.
- Anthropic streamed `message_delta.usage` is cumulative and treated as
  authoritative.
- xAI `cost_in_usd_ticks` is converted to exact USD when present.
- OpenRouter `usage.cost` is converted from credits to USD when present.
- Local OpenAI-compatible inference is `unmetered` by design.
