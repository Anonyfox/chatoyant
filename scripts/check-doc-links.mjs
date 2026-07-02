import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// _opam is the local switch ocaml/setup-ocaml creates inside the workspace on
// CI; _site is the branded docs build. Both contain third-party markdown.
const ignoredDirs = new Set(["_build", "_opam", "_site", "node_modules", "dist", ".cache", ".git"]);
const markdownFiles = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        walk(path.join(dir, entry.name));
      }
    } else if (entry.name.endsWith(".md")) {
      markdownFiles.push(path.join(dir, entry.name));
    }
  }
}

function localTarget(href) {
  const [withoutHash] = href.split("#");
  if (!withoutHash || /^[a-z][a-z0-9+.-]*:/i.test(withoutHash)) {
    return null;
  }
  return withoutHash;
}

walk(root);

let failures = 0;
const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
for (const file of markdownFiles) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(linkPattern)) {
    const href = match[1].trim();
    const target = localTarget(href);
    if (target === null) {
      continue;
    }
    const absolute = path.resolve(path.dirname(file), decodeURIComponent(target));
    if (!existsSync(absolute)) {
      console.error(`${path.relative(root, file)}: missing link target ${href}`);
      failures += 1;
    }
  }
}

if (failures > 0) {
  process.exit(1);
}

console.log(`checked ${markdownFiles.length} markdown files`);
