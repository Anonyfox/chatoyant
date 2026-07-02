# Contributing to Chatoyant

Thanks for your interest in improving Chatoyant. This project is OCaml-first; the
npm package is generated from the OCaml sources with Melange.

## Prerequisites

- OCaml `>= 5.3` and [opam](https://opam.ocaml.org/)
- Node.js `>= 18` (used to bundle and test the generated npm package)

## Setup

```bash
# OCaml dependencies (into your current opam switch)
opam install . --deps-only --with-test --with-doc

# Node dependencies (esbuild + TypeScript, dev-only)
npm ci
```

## Build and test

```bash
make build      # dune build (OCaml + Melange) + esbuild npm bundle
make test       # full suite: native tests, JS parity tests, tsc, JSON Schema suite
make check      # the full release gate (sync + test + lint + pack dry-run)
make help       # list all targets
```

Under the hood, `dune build @runtest @melange` runs the native OCaml tests and
emits the Melange JavaScript; `scripts/build-npm.mjs` bundles it with esbuild.

## Formatting

Code is formatted with `ocamlformat` (pinned in `.ocamlformat`):

```bash
dune fmt
```

CI rejects unformatted code. Install the matching version with
`opam install ocamlformat.0.29.0`.

## Project layout

```
lib/
  chatoyant/  aggregate public entrypoint (the Chatoyant module)
  core/       unified Chat session, messages, tools, options, results
  provider/   OpenAI, Anthropic, xAI, OpenRouter, local clients
  schema/     Draft 2020-12 JSON Schema parser, validator, codecs
  tokens/     token estimation, context windows, cost/pricing
  runtime/    JSON, SSE, effect plumbing
  eio/        native Eio runtime bindings
  ppx/        module%tool and [@@deriving chatoyant]
js/           Melange entry point exported to npm
test/         native (*.ml) and JS parity (*.mjs) tests
scripts/      npm bundling, release engine, doc/version checks
```

## Releasing

Releases keep the npm version, the OCaml/`dune-project` version, the
`chatoyant.opam` version, and the Git tag identical at all times.

```bash
make release-minor DRY=1   # rehearse end-to-end, change nothing
make release-minor         # bump + prove + commit + tag vX.Y.Z (no push)
make release-minor PUSH=1  # ...and git push --follow-tags
```

(`patch` and `major` work the same way.) The engine bumps every version source,
regenerates `chatoyant.opam`, stamps the `Unreleased` section of `CHANGELOG.md`
with the new version and date (a release without an `Unreleased` section is
refused), runs the full gate, then commits and tags. Pushing
a `v*.*.*` tag triggers `publish.yml`, which publishes the npm package.

The full ship — npm and opam-repository in one command:

```bash
make release-minor PUSH=1 OPAM=1
```

The opam leg (also available standalone as `make opam-publish`, or as the
`Submit to opam-repository` workflow) builds and tests the source tarball with
`dune-release distrib`, uploads it to the GitHub release, verifies the served
checksum, writes the opam recipe, and opens a PR against `ocaml/opam-repository`
from your fork. Re-running `make opam-publish` force-updates the open PR — use
it to address opam-repository review feedback.

## Pull requests

- Keep changes focused and include tests where it makes sense.
- Run `make check` and `dune fmt` before opening the PR.
- CI runs across several OCaml compilers; all jobs must pass.
