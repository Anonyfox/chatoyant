import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { main } from "../../scripts/check-model-parity.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sources = {
  "lib/tokens/pricing.ml": `let all = [
    ("alpha", p ~input:1.0 ~output:2.0 ~cached:0.1 ~cache_write_5m:1.25 ~cache_write_1h:2.0 ~per_image:0.04 ~per_second:0.08 ());
    ("beta", p ~input:3.0 ~output:4.0 ());
  ]`,
  "lib/tokens/context_window.ml": `let all = [("alpha", 100_000); ("beta", 200_000);]`,
  "lib/core/preset.ml": `type model_preset = Fast | Cheap | Best | Balanced | Reasoning
let resolve_model_preset ~provider preset =
  match (preset, provider) with
  | (Fast | Cheap | Best | Balanced | Reasoning), Openai -> Some "alpha"
  | _, (Local | Openrouter) -> None
let next = ()`,
  "js/chatoyant_internal.ml": `let raw = {| 
const PRICING = Object.freeze({
  "alpha": { input: 1, output: 2, cached: 0.1, cacheWrite5m: 1.25, cacheWrite1h: 2, perImage: 0.04, perSecond: 0.08 },
  "beta": { input: 3, output: 4 },
});
const CONTEXT_WINDOWS = Object.freeze({ "alpha": 100000, "beta": 200000 });
const presets = { openai: { fast: "alpha", cheap: "alpha", best: "alpha", balanced: "alpha", reasoning: "alpha" } };
|}`,
};
async function fixture(t, changes = {}, args = []) {
  const directory = await mkdtemp(path.join(tmpdir(), "chatoyant-models-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const [file, source] of Object.entries({ ...sources, ...changes })) {
    await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
    await writeFile(path.join(directory, file), source);
  }
  const output = [], errors = [];
  const status = await main(args, directory, { log: (s) => output.push(s), error: (s) => errors.push(s) });
  return { status, output: output.join("\n"), errors: errors.join("\n") };
}
const jsFile = "js/chatoyant_internal.ml";
test("real source tables have model parity", async () => {
  const errors = [];
  const status = await main([], root, { log() {}, error: (s) => errors.push(s) });
  assert.equal(status, 0, errors.join("\n"));
});
test("small tables match, including all price fields and grouped/None presets", async (t) => {
  assert.equal((await fixture(t)).status, 0);
  const result = await fixture(t, {}, ["--json"]);
  assert.equal(result.status, 0);
  const data = JSON.parse(result.output);
  assert.deepEqual(data.models.alpha, { price: { input: 1, output: 2, cached: 0.1, cacheWrite5m: 1.25, cacheWrite1h: 2, perImage: 0.04, perSecond: 0.08 }, contextWindow: 100000 });
  assert.equal(data.presets.local.fast, null);
  assert.equal(data.presets.openai.reasoning, "alpha");
});
for (const field of ["input", "output", "cached", "cacheWrite5m", "cacheWrite1h", "perImage", "perSecond"]) {
  test(`detects changed ${field} price`, async (t) => {
    const changed = sources[jsFile].replace(new RegExp(`${field}: [\\d.]+`), `${field}: 999`);
    const result = await fixture(t, { [jsFile]: changed });
    assert.equal(result.status, 1);
    assert.match(result.errors, new RegExp(`pricing\\.alpha\\.${field}: OCaml=.*JS=999`));
    assert.equal(result.errors.split("\n").length, 1);
  });
}
for (const side of ["OCaml", "JS"]) {
  test(`detects a row missing from ${side}`, async (t) => {
    const file = side === "JS" ? jsFile : "lib/tokens/pricing.ml";
    const pattern = side === "JS" ? /  "beta": \{ input: 3, output: 4 \},\n/ : /\("beta", p ~input:3\.0 ~output:4\.0 \(\)\);/;
    const result = await fixture(t, { [file]: sources[file].replace(pattern, "") });
    assert.equal(result.status, 1);
    assert.equal(result.errors, `pricing.beta: missing on ${side} side`);
  });
}
test("detects changed preset", async (t) => {
  const result = await fixture(t, { [jsFile]: sources[jsFile].replace('best: "alpha"', 'best: "beta"') });
  assert.equal(result.status, 1);
  assert.equal(result.errors, 'presets.openai.best: OCaml="alpha", JS="beta"');
});
test("detects changed context window", async (t) => {
  const result = await fixture(t, { [jsFile]: sources[jsFile].replace('"alpha": 100000', '"alpha": 99999') });
  assert.equal(result.status, 1);
  assert.equal(result.errors, "context.alpha: OCaml=100000, JS=99999");
});
for (const [name, change] of [
  ["missing table", (s) => s.replace("const PRICING", "const OTHER")],
  ["empty table", (s) => s.replace(/const PRICING[\s\S]*?\}\);/, "const PRICING = Object.freeze({});")],
  ["unparsed row", (s) => s.replace("input: 1,", "input: unknown(),")],
  ["duplicate row", (s) => s.replace('"beta": {', '"alpha": {')],
]) {
  test(`fails loudly on ${name}`, async (t) => {
    await assert.rejects(fixture(t, { [jsFile]: change(sources[jsFile]) }), /Cannot parse JS PRICING/);
  });
}
for (const file of ["lib/tokens/pricing.ml", "lib/tokens/context_window.ml", "lib/core/preset.ml"]) {
  test(`fails loudly on empty ${file}`, async (t) => {
    await assert.rejects(fixture(t, { [file]: "let all = []" }), /Cannot parse OCaml/);
  });
}
test("JSON preserves conflicting values and keeps a failing status", async (t) => {
  const result = await fixture(t, { [jsFile]: sources[jsFile].replace("input: 1,", "input: 9,") }, ["--json"]);
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.output).models.alpha.price.input, { ocaml: 1, js: 9 });
  assert.match(result.errors, /pricing.alpha.input/);
});
test("rejects an OCaml pricing row it cannot fully consume", async (t) => {
  const file = "lib/tokens/pricing.ml";
  await assert.rejects(fixture(t, { [file]: sources[file].replace("~input:1.0", "~input:computed") }), /Cannot parse OCaml pricing/);
});
