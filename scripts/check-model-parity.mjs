import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripJSComments, stripOCamlComments } from "./check-api-surface.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fields = { cache_write_5m: "cacheWrite5m", cache_write_1h: "cacheWrite1h", per_image: "perImage", per_second: "perSecond" };
const fail = (label) => { throw new Error(`Cannot parse ${label}`); };

// Consume the entire supported grammar, so an unfamiliar row cannot silently
// disappear from the comparison. No source code is evaluated.
function parser(source, label) {
  let rest = source.trim();
  return {
    take(pattern) {
      const match = rest.match(pattern);
      if (!match || match.index !== 0) return fail(`${label} near ${JSON.stringify(rest.slice(0, 80))}`);
      rest = rest.slice(match[0].length).trimStart();
      return match;
    },
    starts: (text) => rest.startsWith(text),
    done: () => !rest,
  };
}
function put(table, key, value, label) {
  if (Object.hasOwn(table, key)) fail(`${label}: duplicate ${key}`);
  table[key] = value;
}
function nonempty(table, label) {
  if (!Object.keys(table).length) fail(`${label}: zero rows`);
  return table;
}
function section(source, pattern, label) {
  const matches = [...source.matchAll(pattern)];
  if (matches.length !== 1) fail(`${label}: expected one table, found ${matches.length}`);
  return matches[0][1];
}
function ocamlTable(source, pricing) {
  const label = pricing ? "OCaml pricing" : "OCaml context windows";
  const body = section(stripOCamlComments(source), /\blet all\s*=\s*\[([\s\S]*?)\]/g, label);
  const p = parser(body, label), table = {};
  while (!p.done()) {
    const id = JSON.parse(p.take(/^\(\s*("(?:[^"\\]|\\.)*")\s*,\s*/)[1]);
    let value;
    if (pricing) {
      p.take(/^p\s+/);
      value = {};
      while (p.starts("~")) {
        const [, field, number] = p.take(/^~([a-z][\w]*):([0-9][\d_]*(?:\.[\d_]*)?(?:[eE][+-]?\d+)?)\s*/);
        put(value, fields[field] ?? field, Number(number.replaceAll("_", "")), label);
      }
      if (!("input" in value) || !("output" in value)) fail(`${label}: ${id} requires input and output`);
      p.take(/^\(\s*\)/);
    } else value = Number(p.take(/^([0-9][\d_]*)/)[1].replaceAll("_", ""));
    p.take(/^\)\s*;/);
    put(table, id, value, label);
  }
  return nonempty(table, label);
}
function jsObject(source, name, frozen = true) {
  const label = `JS ${name}`;
  const start = new RegExp(`\\bconst ${name}\\s*=\\s*${frozen ? "Object\\.freeze\\(" : ""}\\{`, "g");
  const matches = [...source.matchAll(start)];
  if (matches.length !== 1) fail(`${label}: expected one table`);
  const offset = matches[0].index + matches[0][0].length - 1;
  const p = parser(source.slice(offset), label);
  function object() {
    p.take(/^\{/);
    const result = {};
    while (!p.starts("}")) {
      const token = p.take(/^("(?:[^"\\]|\\.)*"|[A-Za-z_]\w*)\s*:/)[1];
      const key = token.startsWith('"') ? JSON.parse(token) : token;
      let value;
      if (p.starts("{")) value = object();
      else if (p.starts('"')) value = JSON.parse(p.take(/^"(?:[^"\\]|\\.)*"/)[0]);
      else value = Number(p.take(/^[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?\d+)?/)[0]);
      put(result, key, value, label);
      if (!p.starts("}")) p.take(/^,/);
    }
    p.take(/^\}/);
    return nonempty(result, label);
  }
  const result = object();
  p.take(frozen ? /^\)\s*;/ : /^;/);
  return result;
}
function ocamlPresets(source) {
  source = stripOCamlComments(source);
  const names = section(source, /type model_preset\s*=([^\n]+)/g, "OCaml preset variants").split("|").map((s) => s.trim().toLowerCase());
  const body = section(source, /let resolve_model_preset\b[^=]*=\s*match \(preset, provider\) with([\s\S]*?)(?=\nlet )/g, "OCaml presets");
  const p = parser(body, "OCaml presets"), table = {};
  const variants = (s) => s.replace(/[()]/g, "").split("|").map((s) => s.trim().toLowerCase());
  while (!p.done()) {
    const [, presets, providers, target, model] = p.take(/^\|\s*(\([^)]*\)|\w+)\s*,\s*(\([^)]*\)|\w+)\s*->\s*(Some\s+("[^"\n]+")|None)/);
    for (const provider of variants(providers)) {
      table[provider] ??= {};
      for (const preset of presets === "_" ? names : variants(presets)) {
        if (!names.includes(preset)) fail(`OCaml preset ${preset}`);
        put(table[provider], preset, target === "None" ? null : JSON.parse(model), "OCaml presets");
      }
    }
  }
  return nonempty(table, "OCaml presets");
}
function differences(a, b, label, messages) {
  for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    const location = `${label}.${key}`;
    if (!Object.hasOwn(a, key)) messages.push(`${location}: missing on OCaml side`);
    else if (!Object.hasOwn(b, key)) messages.push(`${location}: missing on JS side`);
    else if (a[key] && b[key] && typeof a[key] === "object" && typeof b[key] === "object") differences(a[key], b[key], location, messages);
    else if (a[key] !== b[key]) messages.push(`${location}: OCaml=${JSON.stringify(a[key])}, JS=${JSON.stringify(b[key])}`);
  }
}
export async function main(args = process.argv.slice(2), baseRoot = root, logger = console) {
  if (args.some((arg) => arg !== "--json")) throw new Error("Usage: node scripts/check-model-parity.mjs [--json]");
  const [pricing, context, presets, internal] = await Promise.all(["lib/tokens/pricing.ml", "lib/tokens/context_window.ml", "lib/core/preset.ml", "js/chatoyant_internal.ml"].map((file) => readFile(path.join(baseRoot, file), "utf8")));
  // Read only OCaml raw string bodies, then strip JavaScript comments.
  const js = stripJSComments([...internal.matchAll(/\{([a-z_]*)\|([\s\S]*?)\|\1\}/g)].map((m) => m[2]).join("\n"));
  const ocaml = { pricing: ocamlTable(pricing, true), context: ocamlTable(context, false), presets: ocamlPresets(presets) };
  const javascript = { pricing: jsObject(js, "PRICING"), context: jsObject(js, "CONTEXT_WINDOWS"), presets: jsObject(js, "presets", false) };
  // Absent JS provider maps represent no explicit preset mapping. Preserve the
  // OCaml None rows in JSON; do not compare the resolver's runtime fallback.
  for (const [provider, mappings] of Object.entries(ocaml.presets)) {
    if (Object.values(mappings).every((value) => value === null) && !Object.hasOwn(javascript.presets, provider)) javascript.presets[provider] = Object.fromEntries(Object.keys(mappings).map((key) => [key, null]));
  }
  const messages = [];
  for (const table of Object.keys(ocaml)) differences(ocaml[table], javascript[table], table, messages);
  for (const message of messages) logger.error(message);
  if (args.includes("--json")) {
    // Each side is retained on drift so JSON never silently chooses a value.
    const merge = (a, b) => {
      if (JSON.stringify(a) === JSON.stringify(b)) return a;
      if (a && b && typeof a === "object" && typeof b === "object") return Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].sort().map((key) => [key, merge(a[key], b[key])]));
      return { ocaml: a ?? null, js: b ?? null };
    };
    const data = merge(ocaml, javascript);
    const models = Object.fromEntries([...new Set([...Object.keys(data.pricing), ...Object.keys(data.context)])].sort().map((id) => [id, { price: data.pricing[id] ?? null, contextWindow: data.context[id] ?? null }]));
    logger.log(JSON.stringify({ models, presets: data.presets }, null, 2));
  } else {
    for (const [name, table] of Object.entries(ocaml)) logger.log(`${name}: ${name === "presets" ? Object.values(table).reduce((n, rows) => n + Object.keys(rows).length, 0) : Object.keys(table).length} OCaml rows, ${name === "presets" ? Object.values(javascript[name]).reduce((n, rows) => n + Object.keys(rows).length, 0) : Object.keys(javascript[name]).length} JS rows`);
  }
  return messages.length ? 1 : 0;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code; }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
