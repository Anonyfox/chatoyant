# OCaml Architecture

This rewrite is organized as small Dune libraries with `.mli` contracts first.
The TypeScript implementation remains in `../src` and is the production parity
oracle until replacement is explicitly proven.

## Libraries

- `chatoyant.runtime`
  Runtime-independent JSON plus effect signatures for environment, clock, and
  HTTP. Native and Melange backends should satisfy these signatures.

- `chatoyant.tokens`
  Pure token estimation and cost math. This layer must stay dependency-free and
  deterministic.

- `chatoyant.schema`
  Typed schema descriptors and JSON Schema emission. Structured outputs and tool
  parameter validation both depend on this layer. `Chatoyant_schema.Codec`
  pairs a schema with typed OCaml JSON encoding/decoding. It is the generated
  code and advanced escape-hatch foundation; normal app-facing OCaml tool code
  should use `module%tool` from `chatoyant.ppx` instead of hand-writing codecs.

- `chatoyant.provider`
  Provider-neutral message, options, error, generation, and client signatures.
  Raw provider clients remain separately faithful to provider APIs; adapters
  implement these neutral signatures for `chatoyant.core`.
  Current raw providers cover OpenAI, Anthropic, xAI, OpenRouter, and Local.
  OpenAI-compatible providers share an internal `Openai_compatible` kernel for
  deterministic request normalization, usage decoding, attribution headers, and
  local-server stream smoothing while keeping the visible Local/OpenRouter
  surfaces small.
  Anthropic now also has a provider-specific HTTP client functor, typed response
  decoding, typed API error decoding, typed stream event decoding, and a
  `Provider.CHAT` adapter functor.

- `chatoyant.core`
  Provider-neutral messages, options, generation result metadata, and chat state.
  This layer should orchestrate behavior without embedding provider wire formats.
  `Chat` remains the small immutable state container. `Session` is the
  stateful/fluent API mirroring the JavaScript `Chat` class: message mutation,
  registered tools, generation, `last_result`, JSON roundtrip, clone, and fork.
  `Shortcuts` provides one-shot `gen_text`/`gen_result`/stream accumulation
  helpers. All execution paths are functors over provider and clock modules,
  allowing deterministic tests and Melange exports without JS-side business
  logic. `Tool.create_typed` remains the typed constructor used by generated
  code and custom integrations when a `Chatoyant_schema.Codec` is already
  available.

- `chatoyant`
  Native OCaml public entrypoint. It is Eio-first and exposes the polished app
  surface directly as `Chatoyant.openai env`, `Chatoyant.gen_text`,
  `Chatoyant.Chat`, `Chatoyant.Http`, and typed
  `[%chatoyant.gen_data: output]`. It adapts `env#net` and `env#clock` into the
  runtime `HTTP` and `CLOCK` signatures, uses `cohttp-eio` plus system CA roots
  for HTTPS, encodes multipart bodies at the effect boundary, and provides
  provider constructors for OpenAI, Anthropic, xAI, OpenRouter, and Local.
  The Melange/npm artifact is built from the pure runtime/core/provider/schema
  libraries plus JS fetch plumbing, not from this native facade.

- `chatoyant.ppx`
  Native OCaml developer-experience layer shipped in the same opam package. It
  expands `module%tool` and `module%chatoyant.tool` blocks into typed codecs and
  `Tool.t` wrappers. It is an opt-in preprocessor for OCaml consumers and is not
  part of the Melange npm surface.

## OCaml Tool DX

The preferred OCaml shape is one module per tool:

```ocaml
module%tool Calculate = struct
  type operation =
    | Add
    | Divide

  type request = {
    operation : operation; (** Operation to apply. *)
    values : float list [@min_items 1]; (** Numbers to combine in order. *)
  }

  type answer = {
    expression : string;
    result : float;
  }

  (** Combine numbers with a typed arithmetic operation. *)
  let run : request -> (answer, string) result =
   fun request -> ...
end
```

The PPX derives:

- the tool name from the module name, e.g. `Calculate` -> `calculate`;
- the tool description from the doc comment on `run`, with the module doc as a
  fallback;
- recursive input field descriptions from normal record-field doc comments;
- optional fields from `option`;
- enum strings from nullary variants;
- array/string/number constraints from small attributes such as `[@min_items
  1]`;
- `Calculate.tool` for pure tools;
- typed JSON helpers for every reachable tool type, e.g.
  `request_of_json`, `request_to_json`, and `request_schema`.

Effectful tools use a normal first `env` argument and get a generated `make`:

```ocaml
module%tool Lookup_city_metric = struct
  type env = { http : Http.client; base_url : string }
  type request = {
    city : string; (** City name. *)
  }
  type metric = { city : string; metric : float; source : string }

  (** Look up a city metric over HTTP. *)
  let run : env -> request -> (metric, string) result =
   fun env request -> ...
end
```

Usage stays direct and testable:

```ocaml
let result = Calculate.run { operation = Divide; values = [83.; 3.] }
let tools = [ Calculate.tool; Lookup_city_metric.make env ]
```

The rule of thumb is: comments describe, attributes constrain, types validate,
`run` implements, and generated `tool`/`make` values bridge into Chatoyant.

## Functor Boundary

Provider modules are functors over runtime effects:

```ocaml
module Make_client (Http : Chatoyant_runtime.Effect.HTTP) : CLIENT
module Make_provider (Http : Chatoyant_runtime.Effect.HTTP)
                     (Config : CONFIG) : Provider.CHAT
```

This keeps request construction, decoding, stream accumulation, and retry logic
testable without network calls, while allowing native and JavaScript backends to
use the right primitives.

Native Eio consumers should start from `Chatoyant`:

```ocaml
Eio_main.run @@ fun env ->
let ai = Chatoyant.openai env ~model:"gpt-5.4-mini" in
Chatoyant.Chat.ask
     ~system:"Use tools when useful."
     ~tools:[ calculator; lookup_city_metric ]
     ~max_tokens:1_200
     "Do the calculation and lookup."
     ai
```

Provider-specific `Chat` constructors read the standard API-key environment
variable when `~api_key` is omitted, e.g. `OPENAI_API_KEY` for OpenAI.

Raw functorized clients remain available for advanced composition, custom
effect modules, and parity tests:

```ocaml
Eio_main.run @@ fun env ->
let module Http =
  (val Chatoyant.Http.make ~net:env#net ~clock:env#clock ())
in
let module Openai = Chatoyant.Provider.Openai.Make_client (Http) in
...
```

## MLI Policy

- Every module that crosses a layer boundary gets an `.mli`.
- Public types live in interfaces before implementation grows.
- Variant types are preferred for closed concepts such as providers, roles,
  reasoning levels, and known error classes.
- Escape hatches are explicit JSON values, never hidden `string` blobs.
- Unknown provider response fields should be retained when useful for debugging
  or forward compatibility.

## Melange

Dune Melange support follows the current Dune documentation:

- `dune-project` enables `(using melange 1.0)`.
- Libraries use `(modes :standard melange)`.
- JavaScript output uses `melange.emit`.
- ES module output uses `(module_systems esm)`.

The npm-facing root is intentionally split into two generated modules:

- `chatoyant_internal.js` contains raw Melange/interop implementation details
  and fixture helpers used by parity tests.
- `chatoyant_js.js` is the public root wrapper. It imports only curated
  `public_*` aliases from the internal module and exports the documented root
  surface. This keeps runtime `import * as chatoyant from "chatoyant"` clean
  while preserving the internal parity workbench for tests.

## npm Byproduct

The OCaml package is the source of truth. The npm package is built as a
byproduct:

1. `dune build @runtest @melange` proves native OCaml behavior and emits ESM.
2. `scripts/build-npm.mjs` bundles the public Melange wrapper with esbuild into
   `dist/index.js`, minifies it, and copies `js/chatoyant_js.d.ts` to
   `dist/index.d.ts`.
3. `npm test` runs Node's native test runner against the bundled package import,
   runs TypeScript against the colocated declaration file, and verifies the
   pinned JSON Schema official suite through the bundled package.

`npm pack --dry-run` should contain only `package.json`, `README.md`, `LICENSE`,
the markdown files under `docs/`, `dist/index.js`, `dist/index.cjs`, and
`dist/index.d.ts`.

The initial emit target is `ocaml/js/dist`. Generated artifacts live under
Dune's `_build` directory.
