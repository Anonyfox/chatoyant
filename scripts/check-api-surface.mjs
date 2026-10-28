import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

// Keep offsets and newlines in the code mask. Strings are opaque to both
// comment stripping and delimiter scanning; their exact contents stay in text.
function lex(source, ocaml = false) {
  let text = "", mask = "";
  const blank = (s) => s.replace(/[^\n]/g, " ");
  for (let i = 0; i < source.length;) {
    const start = i;
    if (ocaml ? source.startsWith("(*", i) : source.startsWith("/*", i) || source.startsWith("//", i)) {
      if (!ocaml && source.startsWith("//", i)) {
        i = source.indexOf("\n", i);
        if (i < 0) i = source.length;
      } else {
        i += 2;
        let depth = 1;
        while (i < source.length && depth) {
          if (ocaml && source.startsWith("(*", i)) { depth++; i += 2; }
          else if (source.startsWith(ocaml ? "*)" : "*/", i)) { depth--; i += 2; }
          else i++;
        }
        if (depth) throw new Error("Unterminated API comment");
      }
      const s = blank(source.slice(start, i));
      text += s; mask += s;
      continue;
    }
    const quoted = ocaml && source.slice(i).match(/^\{([a-z_]*)\|/);
    const char = ocaml && source.slice(i).match(/^'(?:[^'\\\n]|\\(?:[0-9]{3}|x[0-9a-fA-F]{2}|.))'/);
    if (quoted) {
      const end = source.indexOf(`|${quoted[1]}}`, i + quoted[0].length);
      if (end < 0) throw new Error("Unterminated OCaml quoted string");
      i = end + quoted[1].length + 2;
    } else if (char) i += char[0].length;
    else if (source[i] === '"' || (!ocaml && "'`".includes(source[i]))) {
      const quote = source[i++];
      while (i < source.length) {
        if (source[i] === "\\") i += 2;
        else if (source[i++] === quote) break;
      }
    } else {
      text += source[i]; mask += source[i++];
      continue;
    }
    const s = source.slice(start, i);
    text += s; mask += s.replace(/[\s\S]/g, "\0");
  }
  return { text, mask };
}

export function stripJSComments(source) { return lex(source).text; }
export function stripOCamlComments(source) { return lex(source, true).text; }

function normalize(source, ocaml = false) {
  const { text, mask } = lex(source, ocaml);
  let result = "";
  for (let i = 0; i < text.length; i++) {
    // Only collapse whitespace outside literals.
    if (/\s/.test(text[i]) && mask[i] === text[i]) {
      if (!result.endsWith(" ")) result += " ";
    } else result += text[i];
  }
  return result.trim();
}

// A lightweight declaration scanner for regex-free .d.ts files. => is not an
// angle close. Braces inside generic constraints are not declaration bodies.
function jsParts(source, members = false, enumBody = false) {
  const { text, mask } = lex(source);
  const parts = [];
  let start = 0, brace = 0, paren = 0, bracket = 0, angle = 0;
  const flush = (end) => {
    const part = text.slice(start, end).trim();
    if (part && part !== ";") parts.push(part);
    start = end;
  };
  for (let i = 0; i < mask.length; i++) {
    const c = mask[i];
    if (c === "{") brace++;
    if (c === "}") brace--;
    if (c === "(") paren++;
    if (c === ")") paren--;
    if (c === "[") bracket++;
    if (c === "]") bracket--;
    if (c === "<") angle++;
    if (c === ">" && mask[i - 1] !== "=" && angle) angle--;
    if (brace || paren || bracket || angle) continue;
    if (c === ";" || (enumBody && c === ",")) flush(i + 1);
    else if (!members && c === "}" && /^(?:export\s+)?(?:declare\s+)?(?:abstract\s+)?(?:interface|class|namespace|enum)\b/.test(text.slice(start).trimStart())) flush(i + 1);
    else if (members && c === "\n" && text.slice(start, i).trim()) flush(i);
  }
  flush(text.length);
  return parts;
}

function jsIdentity(declaration) {
  return declaration.match(/^(?:(?:export|default|declare|abstract)\s+)*(type|interface|class|namespace|enum|function|const|let|var)\s+([\w$]+)/);
}

export function extractJSEntries(source) {
  const entries = [];
  for (const declaration of jsParts(source)) {
    const identity = jsIdentity(declaration);
    const key = identity ? `${identity[1]} ${identity[2]}` : "declaration";
    entries.push(`${key}: ${normalize(declaration)}`);
    if (!identity || !["interface", "class", "namespace", "enum", "type"].includes(identity[1])) continue;
    const { mask } = lex(declaration);
    let angle = 0, paren = 0, bracket = 0;
    for (let i = 0; i < mask.length; i++) {
      const c = mask[i];
      if (c === "<") angle++;
      if (c === ">" && mask[i - 1] !== "=" && angle) angle--;
      if (c === "(") paren++;
      if (c === ")") paren--;
      if (c === "[") bracket++;
      if (c === "]") bracket--;
      if (c !== "{" || angle || paren || bracket) continue;
      let end = i + 1, depth = 1;
      for (; end < mask.length && depth; end++) {
        if (mask[end] === "{") depth++;
        if (mask[end] === "}") depth--;
      }
      const body = declaration.slice(i + 1, end - 1);
      const namespace = identity[1] === "namespace";
      for (const member of namespace ? jsParts(body) : jsParts(body, true, identity[1] === "enum")) {
        const name = namespace ? jsIdentity(member)?.[2] : member.match(/^(?:(?:public|private|protected|static|readonly|abstract|override|get|set)\s+)*([\w$]+|"[^"]+"|'[^']+'|\[[^\]]+\])/)?.[1];
        entries.push(`${identity[2]}.${name ?? "(call)"}: ${normalize(member)}`);
      }
      i = end - 1;
    }
  }
  return entries.sort(compare);
}

export function extractOCamlEntries(source, relativePath = "fixture.mli") {
  const { text, mask } = lex(source, true);
  const starts = [];
  let depth = 0, blocks = 0;
  const tokens = /[A-Za-z_][\w']*|[(){}\[\]]/g;
  for (const match of mask.matchAll(tokens)) {
    const token = match[0], i = match.index;
    if (!depth && !blocks && /^(val|type|module|exception|external|include|class)$/.test(token)) {
      // Item keywords start a line; keywords in `module type of` and RHSs don't.
      const line = mask.slice(mask.lastIndexOf("\n", i - 1) + 1, i);
      if (!line.trim()) starts.push(i);
    }
    if ("({[".includes(token)) depth++;
    if (")}]".includes(token)) depth--;
    if (/^(sig|struct|object|begin)$/.test(token)) blocks++;
    if (token === "end") blocks--;
  }
  if (!starts.length && text.trim()) throw new Error(`No signature items found in ${relativePath}`);
  return starts.map((start, index) => {
    const item = normalize(text.slice(start, starts[index + 1] ?? text.length), true);
    const kind = item.match(/^(module type|class type|\w+)/)[0];
    let rest = item.slice(kind.length).trimStart();
    if (kind === "type" || kind === "class" || kind === "class type") {
      rest = rest.replace(/^(?:nonrec\s+|virtual\s+)?(?:\([^)]*\)\s*|'[\w']+\s+)*/, "");
    }
    const name = rest.match(/^(\([^)]+\)|[\w']+)/)?.[0] ?? rest;
    return `${relativePath}::${kind} ${name}: ${item}`;
  }).sort(compare);
}

// Multiset subtraction preserves duplicate declarations and overloads. Match
// unchanged signatures first, then pair remaining signatures sharing a key.
export function diffEntries(previous, current) {
  const groups = (entries) => {
    const map = new Map();
    for (const entry of entries) {
      const key = entry.slice(0, entry.indexOf(": "));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry);
    }
    return map;
  };
  const before = groups(previous), after = groups(current), changes = [];
  for (const key of [...new Set([...before.keys(), ...after.keys()])].sort(compare)) {
    const old = [...(before.get(key) ?? [])].sort(compare);
    const added = [...(after.get(key) ?? [])].sort(compare);
    const removed = old.filter((entry) => {
      const i = added.indexOf(entry);
      if (i < 0) return true;
      added.splice(i, 1);
      return false;
    });
    while (removed.length && added.length) changes.push({ type: "CHANGED", key, before: removed.shift(), after: added.shift() });
    for (const entry of removed) changes.push({ type: "REMOVED", key, before: entry });
    for (const entry of added) changes.push({ type: "ADDED", key, after: entry });
  }
  return changes;
}

async function optionalRead(file) {
  try { return await readFile(file); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

async function ocamlEntries(directory, baseRoot = root) {
  const entries = [];
  const dune = await optionalRead(path.join(directory, "dune"));
  // Current lib directories each contain one library. For ambiguous layouts,
  // include everything rather than silently miss a public declaration.
  const privateLibrary = dune && (dune.toString().match(/\(library\b/g) ?? []).length === 1 && !/\(public_name\s/.test(dune.toString());
  for (const file of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, file.name);
    if (file.isDirectory()) entries.push(...await ocamlEntries(full, baseRoot));
    else if (!privateLibrary && file.name.endsWith(".mli")) entries.push(...extractOCamlEntries(await readFile(full, "utf8"), path.relative(baseRoot, full).split(path.sep).join("/")));
  }
  return entries.sort(compare);
}

export async function main(args = process.argv.slice(2), baseRoot = root, logger = console) {
  const root = baseRoot;
  if (args.some((arg) => arg !== "--update")) throw new Error("Usage: node scripts/check-api-surface.mjs [--update]");
  const source = await readFile(path.join(root, "js/chatoyant_js.d.ts"));
  let failed = false;
  for (const file of ["dist/index.d.ts", "dist/index.d.cts"]) {
    const built = await optionalRead(path.join(root, file));
    if (built && !built.equals(source)) {
      logger.error(`${file}: declarations differ from js/chatoyant_js.d.ts; run npm run build:npm`);
      failed = true;
    }
  }
  for (const [name, entries] of [["js", extractJSEntries(source.toString())], ["ocaml", await ocamlEntries(path.join(root, "lib"), root)]]) {
    const file = path.join(root, `test/api-surface/${name}.api.txt`);
    if (args.includes("--update")) {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, `# Public API surface. Update deliberately with npm run api:update and commit this snapshot.\n${entries.join("\n")}\n`);
      logger.log(`${name}: updated ${entries.length} entries`);
      continue;
    }
    const snapshot = await optionalRead(file);
    if (!snapshot) { logger.error(`${name}: missing snapshot; run npm run api:update`); failed = true; continue; }
    const previous = snapshot.toString().split("\n").filter((line) => line && !line.startsWith("#"));
    const changes = diffEntries(previous, entries);
    logger.log(`${name}: ${entries.length} entries${changes.length ? `, ${changes.length} differences` : ", snapshot matches"}`);
    for (const change of changes) {
      failed = true;
      logger.error(`${change.type} ${change.key}: ${change.type === "ADDED" ? "new public API: run `npm run api:update` and commit the snapshot" : "possible breaking change: needs maintainer approval"}`);
      if (change.before) logger.error(`- ${change.before}`);
      if (change.after) logger.error(`+ ${change.after}`);
    }
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code; }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
