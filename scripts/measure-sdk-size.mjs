#!/usr/bin/env node
// Measures what a one-call LLM script costs in install footprint and bundle
// size for several JavaScript SDKs. Each SDK gets a fresh temp dir, a
// production `npm install`, and an esbuild bundle (minified, ESM, node target)
// of the smallest script that sends one chat request. Network is only used by
// npm; the bundled scripts are never executed.
//
// Usage: node scripts/measure-sdk-size.mjs [--json]
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const cases = [
  {
    name: "chatoyant",
    deps: ["chatoyant"],
    code: `import { genText } from "chatoyant";\nconsole.log(await genText("Hello", { model: "gpt-6.1-sol" }));\n`,
  },
  {
    name: "openai",
    deps: ["openai"],
    code: `import OpenAI from "openai";\nconst r = await new OpenAI().responses.create({ model: "gpt-6.1-sol", input: "Hello" });\nconsole.log(r.output_text);\n`,
  },
  {
    name: "@anthropic-ai/sdk",
    deps: ["@anthropic-ai/sdk"],
    code: `import Anthropic from "@anthropic-ai/sdk";\nconst r = await new Anthropic().messages.create({ model: "claude-sonnet-5-5", max_tokens: 256, messages: [{ role: "user", content: "Hello" }] });\nconsole.log(r.content);\n`,
  },
  {
    name: "ai + @ai-sdk/openai",
    deps: ["ai", "@ai-sdk/openai"],
    code: `import { generateText } from "ai";\nimport { openai } from "@ai-sdk/openai";\nconst r = await generateText({ model: openai("gpt-6.1-sol"), prompt: "Hello" });\nconsole.log(r.text);\n`,
  },
  {
    name: "langchain + @langchain/openai",
    deps: ["langchain", "@langchain/core", "@langchain/openai"],
    code: `import { ChatOpenAI } from "@langchain/openai";\nconst r = await new ChatOpenAI({ model: "gpt-6.1-sol" }).invoke("Hello");\nconsole.log(r.content);\n`,
  },
];

function dirSize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) total += dirSize(p);
    else if (entry.isFile()) total += statSync(p).size;
  }
  return total;
}

function countPackages(lockPath) {
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  return Object.keys(lock.packages ?? {}).filter((k) => k.startsWith("node_modules/")).length;
}

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString();

// Pin the registry's `latest` tag explicitly; a bare name can resolve older.
const latest = (d) => `${d}@${run("npm", ["view", d, "version"], tmpdir()).trim()}`;

const rows = [];
for (const c of cases) {
  c.deps = c.deps.map(latest);
  const dir = mkdtempSync(join(tmpdir(), "sdk-size-"));
  try {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "m", private: true, type: "module" }));
    run("npm", ["install", "--omit=dev", "--no-audit", "--no-fund", "--ignore-scripts", ...c.deps], dir);
    run("npm", ["install", "--no-save", "--no-audit", "--no-fund", "esbuild@0.25"], dir);
    const versions = c.deps;
    // Footprint without esbuild: reinstall prod deps only in a sibling dir.
    const prod = mkdtempSync(join(tmpdir(), "sdk-prod-"));
    writeFileSync(join(prod, "package.json"), JSON.stringify({ name: "m", private: true, type: "module" }));
    run("npm", ["install", "--omit=dev", "--no-audit", "--no-fund", "--ignore-scripts", ...versions], prod);
    const installBytes = dirSize(join(prod, "node_modules"));
    const packages = countPackages(join(prod, "package-lock.json"));
    rmSync(prod, { recursive: true, force: true });
    writeFileSync(join(dir, "main.mjs"), c.code);
    run(join(dir, "node_modules/.bin/esbuild"), ["main.mjs", "--bundle", "--minify", "--format=esm", "--platform=node", "--target=node20", "--outfile=out.js", "--log-level=error"], dir);
    const bundle = readFileSync(join(dir, "out.js"));
    rows.push({ name: c.name, versions, packages, installBytes, bundleBytes: bundle.length, gzipBytes: gzipSync(bundle, { level: 9 }).length });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ date: new Date().toISOString().slice(0, 10), node: process.version, rows }, null, 2));
} else {
  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
  console.log("| SDK | Versions | Packages installed | node_modules | Bundle (min) | Bundle (min+gzip) |");
  console.log("| --- | --- | ---: | ---: | ---: | ---: |");
  for (const r of rows) console.log(`| ${r.name} | ${r.versions.join(", ")} | ${r.packages} | ${mb(r.installBytes)} | ${kb(r.bundleBytes)} | ${kb(r.gzipBytes)} |`);
}
