import fs from "node:fs";
import path from "node:path";
import { JsonSchema } from "../_build/default/js/dist/js/chatoyant_js.js";

const suiteDir =
  process.env.JSON_SCHEMA_TEST_SUITE_DIR || "/tmp/json-schema-test-suite";
const testsDir = path.join(suiteDir, "tests/draft2020-12");
const remotesDir = path.join(suiteDir, "remotes");

if (!fs.existsSync(testsDir) || !fs.existsSync(remotesDir)) {
  throw new Error(
    `JSON Schema Test Suite not found at ${suiteDir}; set JSON_SCHEMA_TEST_SUITE_DIR`,
  );
}

const resources = [];

function walkRemotes(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkRemotes(full);
    } else if (entry.name.endsWith(".json")) {
      const rel = path.relative(remotesDir, full).split(path.sep).join("/");
      resources.push({
        uri: `http://localhost:1234/${rel}`,
        schema: JSON.parse(fs.readFileSync(full, "utf8")),
      });
    }
  }
}

walkRemotes(remotesDir);

let total = 0;
let passed = 0;
const failures = [];

for (const file of fs.readdirSync(testsDir).filter((name) => name.endsWith(".json")).sort()) {
  const groups = JSON.parse(fs.readFileSync(path.join(testsDir, file), "utf8"));
  for (const group of groups) {
    for (const test of group.tests) {
      total += 1;
      let valid;
      try {
        valid = JsonSchema.validate(group.schema, test.data, { resources }).valid;
      } catch (error) {
        valid = `throw:${error?.message || String(error)}`;
      }
      if (valid === test.valid) {
        passed += 1;
      } else {
        failures.push({
          file,
          group: group.description,
          test: test.description,
          expected: test.valid,
          got: valid,
        });
      }
    }
  }
}

if (failures.length > 0) {
  console.error(JSON.stringify({ passed, total, failures: failures.slice(0, 20) }, null, 2));
  throw new Error(`official JSON Schema draft2020-12 suite failed: ${passed}/${total}`);
}

console.log(`node json schema official suite ok ${passed}/${total}`);
