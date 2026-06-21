# Chatoyant

OCaml-first LLM SDK with an Eio native runtime and a Melange-generated npm
package. Chatoyant provides typed provider clients, structured outputs, tool
calling, streaming, token/cost accounting, and a root-only JavaScript API
generated from the OCaml implementation.

## Highlights

- Native OCaml API built around Eio, result-returning calls, `.mli` contracts,
  and typed tool definitions.
- Melange-generated JavaScript package with one root import path, ESM and CJS
  entrypoints, and a colocated TypeScript declaration file.
- Unified `Chat` session API, one-shot text/data/stream shortcuts, tool calling,
  streaming accumulation, JSON roundtrip, and token/cost accounting.
- Raw provider clients for OpenAI, Anthropic, xAI, OpenRouter, and local
  OpenAI-compatible servers.
- Standalone Draft 2020-12 JSON Schema parser/validator with OpenAI strict
  projection and typed OCaml codec generation.
- Production-derived JS usage tests, OCaml native tests, TypeScript declaration
  checks, and the official JSON Schema suite against the bundled npm package.

## OCaml Quick Start

```ocaml
open Chatoyant

let () =
  Eio_main.run @@ fun env ->
  let ai = Chatoyant.openai ~model:"gpt-5.4-mini" env in
  match Chatoyant.gen_text ai "Say hello in three words." with
  | Ok text -> print_endline text
  | Error err -> prerr_endline (Chatoyant.Error.provider err)
```

Typed tools are ordinary modules. Comments become schema descriptions, `option`
means optional, and the generated `tool` value plugs into a chat.

```ocaml
module%tool Calculate = struct
  type operation =
    | Add
    | Divide

  type request = {
    operation : operation; (** Operation to apply. *)
    values : float list [@min_items 1]; (** Numbers to combine in order. *)
  }

  type answer = { result : float }

  (** Combine numbers with a typed arithmetic operation. *)
  let run : request -> (answer, string) result =
   fun { operation; values } ->
    match operation, values with
    | _, [] -> Error "at least one value is required"
    | Add, values -> Ok { result = List.fold_left ( +. ) 0. values }
    | Divide, first :: rest ->
        List.fold_left
          (fun acc value -> Result.bind acc (fun n ->
             if value = 0. then Error "division by zero" else Ok (n /. value)))
          (Ok first) rest
        |> Result.map (fun result -> { result })
end

let () =
  Eio_main.run @@ fun env ->
  let ai =
    Chatoyant.openai ~model:"gpt-5.4-mini" ~tools:[ Calculate.tool ] env
  in
  ignore (Chatoyant.gen_text ai "Divide 83 by 3.")
```

For the full native guide, see [OCAML.md](OCAML.md).

## JavaScript Quick Start

```ts
import { Chat, Schema, createTool, genText } from "chatoyant";

const text = await genText("What is 2+2?", { model: "fast" });

const lookup = createTool({
  name: "lookup",
  description: "Lookup data",
  parameters: { q: Schema.String({ minLength: 1 }) },
  async execute({ args }) {
    return { found: args.q };
  },
});

const chat = new Chat({ model: "gpt-4o" });
chat.system("Use tools when useful.").user("Find needle").addTool(lookup);
const reply = await chat.generate();
```

All JavaScript imports come from the package root:

```ts
import { Chat, OpenAI, Tokens, JsonSchema, genData } from "chatoyant";
```

Former subpath imports from the TypeScript package intentionally move to this
root surface. See [JAVASCRIPT.md](JAVASCRIPT.md).

## Build And Test

Run from this directory:

```bash
npm test
npm run release:check
```

`npm run release:check` builds and tests the native OCaml package first, emits
Melange ESM, bundles the npm package with esbuild, runs Node's native tests
against `dist/index.js`, checks `dist/index.d.ts` with `tsc`, runs the pinned
official JSON Schema suite through the bundled package, lints opam metadata,
checks local documentation links, and verifies the npm tarball contents.
