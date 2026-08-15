# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.14.0 — 2026-08-15
### Added

- **Image and file attachments on messages, across providers and both
  languages.** Messages carry provider-neutral attachments (`kind:
  "image" | "file"`, sourced from a URL, base64 data + media type, or a
  provider file id), and each adapter renders them into its native wire
  blocks: OpenAI/Meta Chat Completions content parts and Responses input
  items, Anthropic image/document blocks (typed `Image`/`Document`
  content-block variants in the OCaml client), and xAI image parts. In
  JavaScript, `chat.user(text, { images, files, attachments, metadata })`
  attaches media (a plain second argument keeps its legacy metadata
  meaning); in OCaml, `Message.user ~attachments` / `Chat.user
  ~attachments`. Attachments round-trip through session serialization.
  Combinations a wire cannot express fail with descriptive typed errors
  instead of provider 400s (image-by-file-id and file-by-URL on chat
  completions point at the Responses API; xAI is images-only).
- **Files APIs: upload once, reference forever.** `uploadFile`,
  `listFiles`, `getFile`, and `deleteFile` on the `OpenAI`, `Meta`, and
  `Anthropic` namespaces (multipart uploads from a Blob/File or `{ data,
  filename, mediaType }`; OpenAI/Meta default to the `user_data` purpose).
  Anthropic's `files-api-2025-04-14` beta header is applied automatically —
  on file operations and whenever a message references a file id. File-id
  attachments keep multi-turn conversations cheap: history re-sends only
  the id, never the bytes.
- **Typed Responses API surface.** `OpenAI.createResponse` and
  `Meta.createResponse` accept messages (attachments included) and return
  the normalized generation result with usage detail (cached and reasoning
  tokens); `responseStructured` does structured output through the
  Responses `text.format` with OpenAI-strict projection and schema
  validation — a returned object is a validated object. Replaces
  hand-rolled `request("/responses", ...)` calls.

### Fixed

- **Provider HTTP failures throw `ProviderError` everywhere.** Chat,
  streaming, and raw-request paths previously threw plain `Error`s despite
  the documented `ProviderError` contract. Failures now carry `status` and
  the provider envelope's `errorType`/`errorCode`/`errorParam` plus the
  parsed body in `raw`, with the message text unchanged, so existing
  `catch` logic keeps working. `ProviderError.unknownProvider` lists the
  current model signatures (including `muse`) instead of a stale
  hardcoded set.

## 0.13.0 — 2026-08-11
### Added

- **Meta Model API (Muse Spark) as a first-class provider.** Provider id
  `meta` with model detection for `muse-*`, served at
  `https://api.meta.ai/v1` (`META_API_KEY`, with Meta's own `MODEL_API_KEY`
  honored as a fallback). The native OCaml adapter
  (`Chatoyant_provider.Meta`, plus `Chatoyant.meta` / `Chat.meta` /
  `Provider.meta` in the Eio runtime) rides the OpenAI-compatible
  `/v1/responses` protocol and reuses the OpenAI serializers; the JavaScript
  package integrates through the shared OpenAI-compatible machinery,
  namespace (`Meta`, `MetaClient`, `createMetaClient`, `META_MODELS`),
  presets, pricing, and context windows included. Muse Spark's wire rules are
  applied automatically in both worlds: reasoning cannot be disabled
  (`reasoning: "off"` omits the field; `minimal`–`xhigh` pass through),
  `stop` sequences and non-`"auto"` tool choices are dropped instead of
  failing the request with the API's 400, `maxTokens` maps to
  `max_completion_tokens` on chat completions, sampling parameters pass
  through, structured output uses the strict schema paths, and
  `webSearch: true` runs the built-in `web_search` tool on `/v1/responses`.
  All three hosted models are priced ($1.25/$4.25 per MTok, cached $0.15;
  1,048,576-token context): `muse-spark-1.2`, `muse-spark-1.1`, and
  `muse-spark-1.2-contributor` — the discounted contributor tier permits
  Meta to train on request data, so presets always resolve to the standard
  `muse-spark-1.2` and never select it.

## 0.12.5 — 2026-07-10
### Fixed

- **Function tools no longer 400 under strict mode.** The JS package sent
  every tool with `strict: true` but left the parameters schema unprojected —
  any tool with an optional parameter (or a nested object) violated OpenAI's
  strict-schema rules (exhaustive `required`, `additionalProperties: false`
  at every level) and the request failed on every model. Tool parameter
  schemas are now OpenAI-strict-projected like the native OCaml provider has
  always done, on both `/v1/chat/completions` and `/v1/responses`; if a
  schema cannot be projected it is sent without `strict` instead of as a
  request the API rejects. Optional parameters declared via field descriptors
  (`Schema.String({ optional: true })`) or the plain shorthand
  (`{ type: "string", optional: true }`) reach the wire as nullable and stay
  legal for local argument validation — the executor sees the parameter as
  `null` or absent, as before. The shorthand's `optional` marker no longer
  leaks into wire schemas (it is not a JSON Schema keyword), and Anthropic
  tool schemas keep their partial `required` untouched.
- **Provider-client tool and structured surfaces restored to the 0.11.x
  contracts.** `chatWithTools`/`messageWithTools` accept plain tool
  definitions again (with or without `execute`, including wire-format
  `{ type: "function", function }`), send them projected, and return the
  model's tool calls to the caller from a single request instead of throwing
  (`Tool execute function is required`) or running the executing tool loop.
  `chat({ tools })` with definition-only tools makes a single request and
  returns the calls instead of throwing. `chatStructured` projects `{ name,
  schema }` wrappers before sending them strict (previously the wrapper's
  schema went raw with `strict: true` — the same rejection class as the tool
  bug). `Anthropic.messageStructured`/`chatStructured` use a forced tool
  again instead of sending an OpenAI `response_format` payload the Anthropic
  API rejects. `tool_choice` now also carries over (in flat form) when tool
  requests route through `/v1/responses`.

## 0.12.4 — 2026-07-10
### Fixed

- **`generateData`/`genData` enforce structured output again.** The JS
  compatibility path ignored the schema entirely — it sent a plain text
  request and silently returned prose when `JSON.parse` failed. With a schema
  it now requests strict structured output (OpenAI-strict-projected
  `response_format` for OpenAI-compatible providers, a forced tool for
  Anthropic — the 0.11.x contract), validates the parsed object against the
  schema, and throws on non-conforming output instead of degrading to text.
  Without a schema the legacy parse-or-passthrough behavior is unchanged.
- **Sampling parameters no longer 400 on locked OpenAI generations.** The
  gpt-5 (5.0), gpt-5.5, gpt-5.6, and o-series models reject `temperature`,
  `top_p`, `frequency_penalty`, and `presence_penalty` (only defaults are
  supported) on both `/v1/chat/completions` and `/v1/responses`; the 5.1–5.4
  generations accept them. Both the JS package and the native OCaml provider
  now omit these parameters for locked models, so `creativity` presets and
  streaming defaults work across the whole model range.

## 0.12.3 — 2026-07-10
### Fixed

- **gpt-5.6 function tools no longer 400.** OpenAI applies a server-side
  reasoning default to the gpt-5.6 family that `/v1/chat/completions` rejects
  in combination with function tools. The JS package now sends an explicit
  `reasoning_effort: "none"` on tool requests when no reasoning is asked for
  (OpenAI's documented remedy), and routes tool requests with active
  reasoning (`reasoning: "low" | "medium" | "high"`) through `/v1/responses`,
  which supports the combination — matching the native OCaml provider, which
  already lived on that endpoint. Verified live against the API.
- **`maxTokens` works on gpt-5.x / o-series chat requests.** These models
  reject the legacy `max_tokens` parameter; the JS package now sends
  `max_completion_tokens` for them (older models keep `max_tokens`).

## 0.12.2 — 2026-07-09
### Added

- **New models (July 2026 launches):** OpenAI GPT-5.6 family (`gpt-5.6-sol`,
  `gpt-5.6-terra`, `gpt-5.6-luna`) plus `gpt-5.5`/`gpt-5.5-pro`; Anthropic
  `claude-fable-5`, `claude-opus-4-8`, `claude-opus-4-7`, and `claude-sonnet-5`;
  xAI `grok-4.5` and `grok-4.3` — with pricing, context windows, and model
  registry entries.
- **Anthropic request shaping per model generation.** Claude 4.7+/Sonnet 5
  requests use adaptive thinking (`{type: "adaptive", display: "summarized"}`)
  with `output_config.effort`, and drop `temperature`/`top_p` (rejected with a
  400 upstream); Fable 5 never sends a disabled thinking config. Older models
  keep the legacy `budget_tokens` surface unchanged.

### Changed

- **Presets track the current generation:** `best`/`balanced`/`reasoning` now
  resolve to `gpt-5.6-sol`/`gpt-5.6-terra`/`gpt-5.5-pro` (OpenAI),
  `claude-fable-5`/`claude-sonnet-5`/`claude-fable-5` (Anthropic), and
  `grok-4.5`/`grok-4.3`/`grok-4.5` (xAI); OpenAI `fast` is `gpt-5.6-luna`.
- **Pricing corrections:** grok-4.20 dropped to $1.25/$2.50 per MTok
  (cached $0.20) and its context window is 1M, matching xAI's current sheet.

## 0.12.1 — 2026-07-03
### Fixed

- **opam lower-bounds:** constrain the TLS/crypto/HTTP stack (`tls`, `tls-eio`,
  `x509`, `ca-certs`, `mirage-crypto-rng` to `>= 1.0.0`; `cohttp-eio` and `http`
  to `>= 6.0.0`). The native runtime uses the result-returning `Tls.Config.client`
  introduced in tls 1.0, so pre-1.0 versions no longer resolve.
- **opam sandbox:** the Eio HTTP transport test (`test_eio`) moves from `@runtest`
  to a dedicated `@integration` alias. It binds a local socket, which the
  network-less opam sandbox rejects (`bind: EPERM`); CI and `make test` still run
  it via `dune build @integration`.

## 0.12.0 — 2026-07-02
### Changed

- **Rewrote Chatoyant as an OCaml-first SDK.** The library now exposes a native
  Eio API with result-returning calls and `.mli` contracts. The npm package is
  generated from the OCaml implementation with Melange and bundled with esbuild,
  and has no runtime npm dependencies.
- **JavaScript imports move to the package root.** The former subpath entry
  points (`chatoyant/core`, `chatoyant/schema`, `chatoyant/tokens`,
  `chatoyant/providers/*`) are collapsed into root exports and namespace
  objects. This is a breaking change for JavaScript consumers.
- **Provider errors are consolidated into `ProviderError`.** The per-provider
  error classes and guards (`OpenAIError`/`isOpenAIError`, `AnthropicError`,
  `XAIError`, `LocalError`, ...) are gone; catch `ProviderError` and branch on
  its `provider` field instead.
- **Low-level helper exports are removed.** The preset lookup tables and
  helpers (`MODEL_PRESETS`, `CREATIVITY_PRESETS`, `REASONING_PRESETS` and
  friends) are no longer exported — the `model: "fast"`, `creativity`, and
  `reasoning` options still resolve exactly as before. The per-provider
  SSE/accumulator toolkit (`parseSSEStream`, `createAccumulator`, ...),
  `chatStreamToWritable`/`messageStreamToWritable`, and
  `buildHeaders`/`buildUrl` are internal now; use the `chatStream*` /
  `messageStream*` namespace methods.
- **The TypeScript type vocabulary is rebuilt.** Provider wire types and
  per-call option interfaces from the old package are replaced by a smaller
  set of provider-neutral types (`GenerationOptions`, `GenerationResult`,
  `Usage`, `ProviderId`, schema/JSON Schema types). Model name unions widen to
  `string`. Some names change: `MessageRole` → `Role`,
  `GenerateOptions` → `GenerationOptions`, `SchemaConstructor` → `SchemaClass`,
  `InferSchema` → `InferSchemaInstance`/`InferSchemaInput`.

### Added

- Native OCaml provider clients for OpenAI, Anthropic, xAI, OpenRouter, and
  local OpenAI-compatible servers.
- A standalone Draft 2020-12 JSON Schema parser and validator with OpenAI strict
  projection and typed OCaml codec generation.
- A `chatoyant.ppx` providing the `module%tool` syntax and
  `[@@deriving chatoyant]` codecs.

## 0.11.1 — 2026-04-15

- Final release of the TypeScript implementation. Earlier changelog history is
  available in the Git log prior to the OCaml port.
