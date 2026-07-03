# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
