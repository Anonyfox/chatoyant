// Usage: node scripts/bench-json-schema-cache.mjs [path/to/module.js]
// Run against separately built before/after modules on the same Node version.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
const { JsonSchema } = await import(pathToFileURL(resolve(process.argv[2] || "dist/index.js")));
const fields = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [
  `field${i}`, { type: "string", minLength: 1, maxLength: 100, description: `Field ${i}` },
]));
const raw = { type: "object", properties: fields, required: ["field0"], additionalProperties: false };
const schema = new JsonSchema(raw);
const data = { field0: "hello" };
const count = 1000;
let sink;
const run = () => {
  const start = performance.now();
  for (let i = 0; i < count; i++) sink = schema.validate(data);
  return (performance.now() - start) * 1000 / count;
};
run();
const samples = Array.from({ length: 9 }, run).sort((a, b) => a - b);
if (sink !== true) throw new Error("benchmark validation failed");
console.log(JSON.stringify({ node: process.version, schemaBytes: JSON.stringify(raw).length,
  iterationsPerSample: count, samples: samples.length, medianUsPerCall: samples[4],
  minUsPerCall: samples[0], maxUsPerCall: samples[8] }, null, 2));
