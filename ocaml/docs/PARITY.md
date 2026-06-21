# Parity Map

This file tracks the current TypeScript surface against the OCaml replacement
target. Each area is classified as:

- `parity`: behavior intentionally matches TypeScript.
- `updated`: behavior intentionally follows newer official provider docs.
- `removed`: behavior was obsolete, unsafe, or accidental.

## Current TypeScript Surface

| Area | TS source | OCaml target | Status |
| --- | --- | --- | --- |
| Root exports | `src/index.ts` plus former package subpaths | `chatoyant` | Root package parity is closed for the intentionally exported JavaScript surface: the latest old-vs-new export comparison has `oldOnly: []`, and former subpath capabilities now appear as direct root exports plus namespace objects (`Core`, `Schemas`, `Generate`/`Shortcuts`, `Tokens`, `Providers`, `OpenAI`, `Anthropic`, `XAI`, `OpenRouter`, `Local`, `Defaults`, `Chatoyant`). Raw implementation helpers remain internal and `test/js/root-surface.test.mjs` snapshots the curated root list. The accepted break is that consumers import from `chatoyant`, not package subpaths. |
| Core chat | `src/core/chat.ts` | `chatoyant.core` | immutable state plus stateful `Session` API with fluent mutation, bounded tool orchestration, generation, last result, JSON roundtrip, clone/fork; npm-facing `Chat` is emitted as a real ES class shell with Node `fetch`, provider detection, JS callback tools, OpenAI-compatible/Anthropic chat calls, and SSE streaming |
| Messages | `src/core/message.ts` | `Chatoyant_core.Message` | parity: typed roles, content/tool-call fields, JSON roundtrip, provider conversion helpers, and tests |
| Options/presets | `src/core/options.ts`, `src/core/presets.ts` | `Chatoyant_core.Options`, `Chatoyant_core.Preset` | parity: defaults, merge semantics, creativity/reasoning presets, local settings, provider option threading, tool loop limits, and JSON session roundtrip |
| Tools | `src/core/tool.ts` | `Chatoyant_core.Tool` plus Melange `Tool` class | schema validation, result validation, JSON encoders, provider-neutral tool definitions, OCaml session-owned execute/append/retry loop, and JS callback tool execution from the emitted ES `Chat` class |
| Schema descriptors | `src/schema/descriptors/*` | `chatoyant.schema` | legacy descriptor builders plus generated JS `Schema` class/root export for `String`, `Number`, `Integer`, `Boolean`, `Null`, `Array`, `Object`, `Enum`, `Literal`, validation, parse, stringify, clone, and class-based shape authoring |
| Schema parse/validate | `src/schema/functions/*` | `Chatoyant_schema.Json_schema`, `Chatoyant_schema.Value` | standalone draft 2020-12 parser/validator with JSON Pointer refs, anchors, external resource registry, `$dynamicRef` dynamic scope, dialect vocabulary toggles, applicators, conditionals, object/array/string/number assertions, dependent schemas, unevaluated tracking, annotation-only format/content behavior, OpenAI strict projection, OCaml tests, generated JS `JsonSchema`, and official JSON Schema Test Suite pass through generated JS |
| Token estimates | `src/tokens/estimate.ts` | `chatoyant.tokens` | parity: text/prompt estimates, chat overheads, available-token math, truncation, chunking, pagination, and CJK/code-aware heuristics |
| Cost math | `src/tokens/cost.ts` | `chatoyant.tokens` | parity plus provider updates: cached reads/writes, actual-cost passthrough, batch discounting, media units, custom pricing, and per-token reporting |
| Pricing/context tables | `src/tokens/pricing.ts`, `context-windows.ts` | `chatoyant.tokens` | updated model/provider fallback tables with exact entries and family fallbacks |
| Provider detection | `src/providers/detection.ts` | `Chatoyant_provider.Registry` | parity: deterministic provider ids, model-pattern detection, unknown-model fallback, and explicit local/OpenRouter routing |
| OpenAI raw client | `src/providers/openai/*` | `Chatoyant_provider.Openai`, `Openai_decode`, `Openai_stream` | standalone Responses/chat/images/audio/embeddings/models/files/vector stores/batches/moderation/fine-tuning/realtime client, WebSocket helper, WebRTC/client-secret bootstrap helpers, stream decode, typed errors, tests |
| Anthropic raw client | `src/providers/anthropic/*` | `Chatoyant_provider.Anthropic` | Messages, Models, Message Batches, Files, streams, cache-control, hosted tool blocks, admin/usage/cost helpers, typed errors, client/provider, tests |
| xAI raw client | `src/providers/xai/*` | `Chatoyant_provider.Xai` | standalone Responses/chat/image/edit/video/models/files/collections/batches/voice/custom voice/client-secret/WebSocket/mTLS-ready client, stream decode, typed errors, tests |
| Local client | `src/providers/local/*` | `Chatoyant_provider.Local` over internal `Openai_compatible` | conservative OpenAI-compatible chat client, default local auth, local fallback detection, `<think>` stream smoothing, opt-in Responses/Images/Embeddings, tests |
| OpenRouter client | `src/providers/openrouter/*` | `Chatoyant_provider.Openrouter` over internal `Openai_compatible` | OpenAI-compatible chat/models plus OpenRouter responses/credits/providers/generations/rerank/video client, attribution headers, credit usage, provider adapter, real smoke |

## Test Strategy

- `docs/PROVIDER_FEATURE_MATRIX.md` is the current-docs audit target for raw
  provider parity. Rows are marked `done`, `opt-in`, or `skip` only after being
  checked against current official docs.
- Pure OCaml unit tests for token, cost, schema, message, and option behavior.
- Fixture parity tests comparing TypeScript-generated request JSON with
  OCaml-generated request JSON.
- Stream fixture tests with deliberately fragmented SSE chunks.
- Provider decoding tests that tolerate unknown fields and missing optional
  fields.
- End-to-end smoke tests only after deterministic fixture parity is stable.
- Melange/Node tests must import generated ESM and call exported functions with
  normal JavaScript values. Compilation alone is not enough.
- `node_root_exports.mjs` snapshots the exact public root export list so
  internal fixture helpers cannot leak back into the package surface unnoticed.

## Current Verification

Run from `ocaml/`:

```bash
npm test
npm run pack:dry-run
```

`npm test` runs the full replacement pipeline: OCaml native tests, Melange ESM
generation, esbuild minified npm dist generation, native Node package tests
against `dist/index.js`, TypeScript checks against `dist/index.d.ts`, and the
pinned official JSON Schema draft 2020-12 suite against the bundled package.

The older generated-artifact smoke tests remain useful while the raw provider
fixtures are still being evolved:

```bash
node test/node_root_exports.mjs
node test/node_json_schema.mjs
node test/node_json_schema_official_suite.mjs
node test/node_adjacent_usage_patterns.mjs
node test/node_anthropic.mjs
node test/node_openai.mjs
node test/node_openai_compatible.mjs
node test/node_xai.mjs
```

Real provider smoke tests are opt-in and require provider API keys:

```bash
dune build @runtest
dune build @melange
ANTHROPIC_API_KEY=... dune exec test/smoke_anthropic_real.exe
ANTHROPIC_API_KEY=... node test/node_anthropic_real.mjs
OPENAI_API_KEY=... dune exec test/smoke_openai_real.exe
OPENAI_API_KEY=... node test/node_openai_real.mjs
OPENROUTER_API_KEY=... dune exec test/smoke_openrouter_real.exe
OPENROUTER_API_KEY=... node test/node_openrouter_real.mjs
XAI_API_KEY=... dune exec test/smoke_xai_real.exe
XAI_API_KEY=... node test/node_xai_real.mjs
LOCAL_BASE_URL=http://127.0.0.1:11434/v1 LOCAL_MODEL=... dune exec test/smoke_local_real.exe
LOCAL_BASE_URL=http://127.0.0.1:11434/v1 LOCAL_MODEL=... node test/node_local_real.mjs
```

## Ongoing Regression Inputs

- Keep the root-only export snapshot and TypeScript declaration checks in sync
  as new public helpers are added.
- More production-derived adjacent usage fixtures as sibling repositories adopt
  the root-only import surface.
- Any newly introduced Anthropic server-tool block names beyond the current
  closed variants and raw fallback.
- Re-run local live smoke when an OpenAI-compatible server is available through
  `LOCAL_BASE_URL` and `LOCAL_MODEL`.
- OpenAI-compatible per-server profiles when production fixture evidence shows
  a stable need beyond the current opt-in local Responses/Images/Embeddings
  methods.
