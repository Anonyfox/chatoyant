import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { test } from "node:test";
import { main } from "../../scripts/check-model-parity.mjs";

test("November provider prices and confirmed contexts match in both source tables", async () => {
  let result;
  assert.equal(await main(["--json"], undefined, {
    log: (json) => { result = JSON.parse(json); },
    error: (error) => assert.fail(error),
  }), 0);
  const expected = {
    "gpt-6-cyber": { input: 20, output: 100, cached: 2 },
    "claude-fable-5-2": { input: 8, output: 40, cached: 0.2, cacheWrite5m: 10, cacheWrite1h: 16 },
    "claude-mythos-5-2": { input: 8, output: 40, cached: 0.2, cacheWrite5m: 10, cacheWrite1h: 16 },
    "muse-ember-1.0": { input: 0.1, output: 0.5, cached: 0.004 },
  };
  for (const [model, price] of Object.entries(expected)) {
    assert.deepEqual(result.models[model].price, price);
  }
  for (const model of ["claude-fable-5-2", "claude-mythos-5-2"]) {
    assert.equal(result.models[model].contextWindow, 1000000);
  }
  // Execute the actual JS table declarations without requiring generated dist.
  const source = await readFile(new URL("../../js/chatoyant_internal.ml", import.meta.url), "utf8");
  for (const [name, models] of Object.entries({
    OPENAI_MODELS: ["gpt-6-cyber"],
    ANTHROPIC_MODELS: ["claude-fable-5-2", "claude-mythos-5-2"],
    META_MODELS: ["muse-ember-1.0"],
  })) {
    const declaration = source.match(new RegExp(`const ${name} = Object.freeze\\(\\[[\\s\\S]*?\\]\\);`))?.[0];
    assert.ok(declaration);
    for (const model of models) assert.ok(vm.runInNewContext(`${declaration} ${name}.includes(${JSON.stringify(model)})`));
  }
});
