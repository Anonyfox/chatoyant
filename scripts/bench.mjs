import { readFile, writeFile } from 'node:fs/promises';
import { JsonSchema, Schema, Message, estimateTokens, estimateChatTokens, calculateCost, estimateCost, splitText, fitMessages } from '../dist/index.js';

const flags = new Set(process.argv.slice(2));
if ([...flags].some(x => !['--update', '--allow-raise', '--json'].includes(x)) || (flags.has('--allow-raise') && !flags.has('--update'))) {
  throw new Error('Usage: node scripts/bench.mjs [--json] [--update [--allow-raise]]');
}
const path = new URL('../test/bench/budgets.json', import.meta.url);
const text = 'Deterministic SDK benchmark text with words, numbers 123 and punctuation. '.repeat(48);
const messages = Array.from({ length: 8 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: text.slice(0, 512), id: i }));
const schema = { type: 'object', required: ['name', 'age', 'active', 'tags', 'address'], additionalProperties: false, properties: {
  name: { type: 'string', minLength: 2 }, age: { type: 'integer', minimum: 0 }, active: { type: 'boolean' },
  tags: { type: 'array', items: { type: 'string' }, minItems: 1 },
  address: { type: 'object', required: ['city', 'zip'], properties: { city: { type: 'string' }, zip: { type: 'string', pattern: '^[0-9]{5}$' } } },
} };
const data = { name: 'Ada', age: 37, active: true, tags: ['sdk', 'node'], address: { city: 'Berlin', zip: '10115' } };
const validator = new JsonSchema(schema);
class Profile extends Schema {
  name = Schema.String(); age = Schema.Integer(); active = Schema.Boolean();
  tags = Schema.Array(Schema.String()); address = Schema.Object({ city: Schema.String(), zip: Schema.String() });
}
const baseline = () => JSON.parse(JSON.stringify(data));
// Every return value escapes the timing loop so V8 cannot discard the workload.
let sink;
const benchmarks = {
  'json-schema-construct-validate': () => new JsonSchema(schema).validate(data),
  'json-schema-reused-validate': () => validator.validate(data),
  'token-estimation': () => estimateTokens(text) + estimateChatTokens(messages),
  'cost-calculation': () => [calculateCost({ model: 'gpt-4o', inputTokens: 2048, outputTokens: 512 }), estimateCost({ model: 'gpt-4o', inputText: text, expectedOutputTokens: 512 })],
  'message-roundtrip': () => Message.fromJSON(Message.user(text).toJSON()).toJSON(),
  'schema-conversion': () => Schema.toJSON(Profile),
  'split-fit': () => [splitText(text, { maxTokens: 128, overlap: 16 }), fitMessages(messages, { maxTokens: 512, reserveForResponse: 64 })],
};
function time(fn, count) {
  const start = process.hrtime.bigint();
  for (let i = 0; i < count; i++) sink = fn();
  return Number(process.hrtime.bigint() - start) / count;
}
function iterations(fn) {
  let count = 32;
  while (time(fn, count) * count < 8e6 && count < 1e6) count *= 2;
  return count;
}
const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const baseCount = iterations(baseline);
const counts = Object.fromEntries(Object.entries(benchmarks).map(([name, fn]) => [name, iterations(fn)]));
const samples = Object.fromEntries(Object.keys(benchmarks).map(name => [name, []]));
for (let sample = 0; sample < 7; sample++) {
  // Bracket each sample with calibration to share local clock/JIT/CPU conditions.
  for (const [name, fn] of Object.entries(benchmarks)) {
    const before = time(baseline, baseCount);
    const ns = time(fn, counts[name]);
    const after = time(baseline, baseCount);
    samples[name].push(ns / ((before + after) / 2));
  }
}
void sink;
let budgets;
try { budgets = JSON.parse(await readFile(path, 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT' || !flags.has('--update')) throw error;
  budgets = { _doc: 'Run --update on main several times; commit lower maxRatio. --allow-raise requires a reason in the commit. Initial budgets use the worst of five runs.', headroom: 2.5, benchmarks: {} };
}
const missing = Object.keys(benchmarks).filter(name => !Object.hasOwn(budgets.benchmarks, name));
const stale = Object.keys(budgets.benchmarks).filter(name => !Object.hasOwn(benchmarks, name));
const roundUp = value => { const scale = 10 ** (1 - Math.floor(Math.log10(value))); return Number((Math.ceil(value * scale) / scale).toPrecision(2)); };
const results = Object.entries(samples).map(([name, values]) => {
  const ratio = median(values);
  const proposedMaxRatio = roundUp(ratio * budgets.headroom);
  if (flags.has('--update')) {
    const previous = budgets.benchmarks[name]?.maxRatio;
    budgets.benchmarks[name] = { maxRatio: previous === undefined || flags.has('--allow-raise') ? proposedMaxRatio : Math.min(previous, proposedMaxRatio), measuredRatio: ratio, measuredOn: new Date().toISOString().slice(0, 10) };
  }
  const budget = budgets.benchmarks[name]?.maxRatio;
  return { name, ratio, budget: budget ?? null, proposedMaxRatio, ok: Number.isFinite(budget) && budget > 0 && ratio <= budget };
});
if (flags.has('--update')) await writeFile(path, JSON.stringify(budgets, null, 2) + '\n');
const errors = [...(flags.has('--update') ? [] : missing.map(x => `Missing budget: ${x}`)), ...stale.map(x => `Budget without benchmark: ${x}`)];
if (flags.has('--json')) console.log(JSON.stringify({ results, errors }, null, 2));
else {
  console.table(results.map(({ name, ratio, budget, ok }) => ({ name, ratio: ratio.toFixed(3), budget, ok })));
  for (const error of errors) console.error(error);
}
if (errors.length || results.some(x => !x.ok)) process.exitCode = 1;
