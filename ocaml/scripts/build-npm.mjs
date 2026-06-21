import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedEntry = path.join(root, "_build/default/js/dist/js/chatoyant_js.js");
const typesEntry = path.join(root, "js/chatoyant_js.d.ts");
const distDir = path.join(root, "dist");
const distEntry = path.join(distDir, "index.js");
const distTypes = path.join(distDir, "index.d.ts");

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

const result = await esbuild.build({
  entryPoints: [generatedEntry],
  outfile: distEntry,
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  minify: true,
  sourcemap: false,
  metafile: true,
  treeShaking: true,
  legalComments: "none",
});

const types = await readFile(typesEntry, "utf8");
await writeFile(distTypes, types);

const bytes = result.metafile.outputs[path.relative(root, distEntry)]?.bytes;
const size = typeof bytes === "number" ? `${bytes} bytes` : "unknown size";
console.log(`built dist/index.js (${size})`);
console.log("copied dist/index.d.ts");
