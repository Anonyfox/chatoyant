# Chatoyant OCaml Port Northstar

This directory is the parallel OCaml/Melange rewrite of Chatoyant. The existing
TypeScript implementation in `src/` remains untouched production reference
material until the OCaml implementation has full proven parity.

## Goal

Build a lean, safe, fast, fully functional Chatoyant implementation in OCaml
that can compile natively with Dune and emit clean ES module JavaScript with
Melange. The final swap is only considered after parity is demonstrated for all
current public use cases and provider behavior.

## Non-Negotiables

- Keep the TypeScript source available for comparison at all times.
- Preserve the package's public capabilities before replacing anything.
- Prefer OCaml types, modules, signatures, and functors over runtime stringly
  checks.
- Use `.mli` files as first-class contracts with useful documentation.
- Keep pure logic separate from runtime effects.
- Treat provider implementations as faithful clients for the providers' current
  public APIs, not just ports of the old TypeScript assumptions.
- Check official online provider documentation when implementing or updating
  provider baselines.
- Handle malformed data, partial streams, missing fields, unsupported options,
  provider quirks, and unknown future fields gracefully.
- Keep unified results, messages, tools, provider tool calls, and stream
  accumulators JSON-serializable. Preserve exact provider-reported usage and
  costs whenever available; estimate only when no real numbers exist; treat
  local inference as explicitly unmetered.
- Publish one intentional root JavaScript surface. No npm subpaths should be
  required for first-class usage; provider, schema, token, and core capabilities
  should be available from `chatoyant` through direct ergonomic exports and
  namespace objects where names would otherwise collide.
- Avoid architectural debt introduced by the TypeScript shape where OCaml gives
  us a cleaner cut.
- Make native OCaml tool definitions feel like OCaml, not like hand-written
  JSON Schema plumbing. The preferred app-facing shape is `module%tool`: one
  small module per tool, normal local types, doc comments for descriptions,
  attributes only for validation constraints, directly testable `run`, and a
  generated `tool`/`make` wrapper for Chatoyant.

## Architecture Direction

The OCaml implementation should be organized around explicit layers:

1. `Chatoyant_core`
   Provider-neutral chat state, messages, tools, unified options, generation
   results, streaming accumulation, metadata, and orchestration. See
   `docs/UNIFIED_ABSTRACTIONS.md` for invariants.

2. `Chatoyant_schema`
   Typed schema descriptors plus a standalone draft 2020-12 JSON Schema
   subsystem for parsing, validation, JSON Pointer/reference resolution,
   unevaluated tracking, provider projections, and Melange/Node validation.
   It supports deterministic preloaded resource registries, `$dynamicRef`
   dynamic-scope behavior, dialect vocabulary toggles, and the official
   draft2020-12 test suite through generated JS. Legacy descriptor optionality
   remains compatibility-oriented; the upcoming typed codec layer should make
   absent-vs-null explicit.

3. `Chatoyant_tokens`
   Pure token estimation, pricing, context windows, chunking, and cost math.

4. `Chatoyant_provider`
   Provider-neutral signatures and shared request/streaming/error primitives.

5. Provider packages/modules
   `Openai`, `Anthropic`, `Xai`, `Openrouter`, and `Local`, each with raw
   faithful low-level API coverage plus adapters for the unified core.

6. Runtime boundary
   The OCaml package is Eio-first, full stop. Native users start from
   `Chatoyant`, not a runtime-suffixed module: `Chatoyant.openai env`,
   `Chatoyant.gen_text`, `Chatoyant.Chat`, `Chatoyant.Http`, and typed
   `[%chatoyant.gen_data: t]`. The lower provider/core modules remain
   functorized so tests and generated JS can supply deterministic HTTP/clock
   effects, but that boundary must not leak into normal OCaml userland.
   Melange/npm uses the pure runtime/core/provider/schema libraries and JS
   `fetch` plumbing separately; it does not determine the native OCaml surface.

7. `chatoyant.ppx`
   Native OCaml DX layer shipped inside the same `chatoyant` opam package. It
   expands `module%tool`/`module%chatoyant.tool` blocks into typed codecs and
   `Chatoyant.Core.Tool.t` values while leaving Melange/npm users untouched.
   The runtime `Codec` module remains the small generated-code and advanced
   escape-hatch foundation; normal OCaml users should not have to write it.

## Parity Strategy

- Start with static parity maps from the current TypeScript public surface.
- Add fixture-driven tests that compare request bodies, response decoding,
  stream accumulation, schema output, token/cost values, and error behavior.
- Add provider-specific contract tests from official docs and captured fixtures.
- Add end-to-end smoke tests only after deterministic pure parity is stable.
- Keep every behavior intentionally classified as:
  - `parity`: matches current TypeScript behavior.
  - `updated`: deliberately follows newer official provider behavior.
  - `removed`: obsolete or unsound behavior intentionally left behind.

## Build Targets

- Native OCaml libraries and tests through Dune.
- Melange-generated ES modules for npm-facing JavaScript.
- The npm package is a byproduct: build/test native OCaml first, then bundle the
  Melange public root with esbuild into `dist/index.js` and copy the matching
  declaration file to `dist/index.d.ts`.
- `npm test` must exercise the bundled npm package with Node's native test
  runner and TypeScript checks, including production-derived usage patterns and
  the pinned official JSON Schema suite.
- The generated JavaScript must preserve good developer experience:
  ergonomic imports, useful errors, no operational clutter, and no hidden
  runtime dependencies unless deliberately introduced.
- The npm-facing root ESM file must stay a curated wrapper. Raw implementation
  helpers and test fixtures may exist in generated internal modules, but they
  must not leak through the `chatoyant` root export list.
- Melange should own the behavior and the public JavaScript artifact wherever
  possible. Records and modules map naturally to JavaScript values and ES
  modules; OCaml classes compile to OCaml object runtime machinery rather than
  idiomatic ES classes. For npm-facing classes, use Melange interop (`mel.raw`
  plus `mel.as`) to emit tiny ES class shells that delegate into OCaml-owned
  session/functor logic.

## Working Rule

When context is compacted or a fresh session begins, read this file first, then
inspect the current implementation status before making changes.
