import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { JsonSchema } from "chatoyant";

const suiteDir = process.env.JSON_SCHEMA_TEST_SUITE_DIR || path.resolve(".cache/json-schema-test-suite");
const testsDir = path.join(suiteDir, "tests/draft2020-12");
const remotesDir = path.join(suiteDir, "remotes");

function loadResources() {
  const resources = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".json")) {
        const rel = path.relative(remotesDir, full).split(path.sep).join("/");
        resources.push({
          uri: `http://localhost:1234/${rel}`,
          schema: JSON.parse(fs.readFileSync(full, "utf8")),
        });
      }
    }
  }

  walk(remotesDir);
  return resources;
}

test("official JSON Schema draft2020-12 suite passes through bundled package", () => {
  assert.equal(fs.existsSync(testsDir), true, `missing ${testsDir}`);
  assert.equal(fs.existsSync(remotesDir), true, `missing ${remotesDir}`);

  const resources = loadResources();
  let total = 0;
  let passed = 0;
  const failures = [];

  for (const file of fs.readdirSync(testsDir).filter((name) => name.endsWith(".json")).sort()) {
    const groups = JSON.parse(fs.readFileSync(path.join(testsDir, file), "utf8"));
    for (const group of groups) {
      for (const case_ of group.tests) {
        total += 1;
        let valid;
        try {
          valid = JsonSchema.validate(group.schema, case_.data, { resources }).valid;
        } catch (error) {
          valid = `throw:${error?.message || String(error)}`;
        }
        if (valid === case_.valid) {
          passed += 1;
        } else {
          failures.push({
            file,
            group: group.description,
            test: case_.description,
            expected: case_.valid,
            got: valid,
          });
        }
      }
    }
  }

  assert.deepEqual(failures.slice(0, 20), []);
  assert.equal(passed, total);
  assert.equal(total, 1299);
});
