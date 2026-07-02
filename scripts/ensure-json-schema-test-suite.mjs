import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const suiteDir = process.env.JSON_SCHEMA_TEST_SUITE_DIR
  ? path.resolve(process.env.JSON_SCHEMA_TEST_SUITE_DIR)
  : path.join(root, ".cache/json-schema-test-suite");
const expectedCommit = "e491ac1126961fa56ac9523a42ac9e27c0311e78";
const repo = "https://github.com/json-schema-org/JSON-Schema-Test-Suite.git";

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

if (await exists(path.join(suiteDir, "tests/draft2020-12"))) {
  try {
    const { stdout } = await exec("git", ["-C", suiteDir, "rev-parse", "HEAD"]);
    if (stdout.trim() === expectedCommit) {
      console.log(`json schema test suite ready at ${suiteDir}`);
      process.exit(0);
    }
  } catch {
    if (process.env.JSON_SCHEMA_TEST_SUITE_DIR) {
      console.log(`using existing JSON_SCHEMA_TEST_SUITE_DIR=${suiteDir}`);
      process.exit(0);
    }
  }
}

if (process.env.JSON_SCHEMA_TEST_SUITE_DIR) {
  throw new Error(`JSON_SCHEMA_TEST_SUITE_DIR does not contain tests/draft2020-12: ${suiteDir}`);
}

await mkdir(path.dirname(suiteDir), { recursive: true });
if (!(await exists(path.join(suiteDir, ".git")))) {
  await exec("git", ["clone", "--filter=blob:none", repo, suiteDir], { maxBuffer: 10 * 1024 * 1024 });
}
await exec("git", ["-C", suiteDir, "fetch", "--depth=1", "origin", expectedCommit], { maxBuffer: 10 * 1024 * 1024 });
await exec("git", ["-C", suiteDir, "checkout", "--detach", expectedCommit], { maxBuffer: 10 * 1024 * 1024 });
console.log(`json schema test suite ready at ${suiteDir}`);
