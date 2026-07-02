#!/usr/bin/env node
// Asserts the version is identical across every source the release touches:
//   - package.json        (npm)
//   - dune-project        (OCaml project version)
//   - chatoyant.opam      (generated from dune-project; committed, so checkable)
// The git tag cut at release time carries the same number, keeping npm, opam,
// and the tag in lockstep. Wired into release:check so drift can never build,
// test, or publish.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const sources = {
  "package.json": JSON.parse(read("package.json")).version ?? null,
  "dune-project": (read("dune-project").match(/^\(version\s+([^)\s]+)\)/m) ?? [])[1] ?? null,
  "chatoyant.opam": (read("chatoyant.opam").match(/^version:\s*"([^"]+)"/m) ?? [])[1] ?? null,
};

const missing = Object.entries(sources).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(`version-sync: missing version in ${missing.join(", ")}`);
  process.exit(1);
}

if (new Set(Object.values(sources)).size !== 1) {
  console.error("version-sync: drift —");
  for (const [k, v] of Object.entries(sources)) console.error(`  ${k.padEnd(16)} ${v}`);
  process.exit(1);
}

console.log(`version-sync: ok (${sources["package.json"]}) — package.json, dune-project, chatoyant.opam`);
