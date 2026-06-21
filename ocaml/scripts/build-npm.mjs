import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedEntry = path.join(root, "_build/default/js/dist/js/chatoyant_js.js");
const typesEntry = path.join(root, "js/chatoyant_js.d.ts");
const distDir = path.join(root, "dist");
const distEntry = path.join(distDir, "index.js");
const distCjsEntry = path.join(distDir, "index.cjs");
const distTypes = path.join(distDir, "index.d.ts");

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

const esmResult = await esbuild.build({
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

const cjsResult = await esbuild.build({
  entryPoints: [generatedEntry],
  outfile: distCjsEntry,
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node18",
  minify: true,
  sourcemap: false,
  metafile: true,
  treeShaking: true,
  legalComments: "none",
});

const types = await readFile(typesEntry, "utf8");
await writeFile(distTypes, types);

const esmBytes = esmResult.metafile.outputs[path.relative(root, distEntry)]?.bytes;
const cjsBytes = cjsResult.metafile.outputs[path.relative(root, distCjsEntry)]?.bytes;
const esmSize = typeof esmBytes === "number" ? `${esmBytes} bytes` : "unknown size";
const cjsSize = typeof cjsBytes === "number" ? `${cjsBytes} bytes` : "unknown size";
console.log(`built dist/index.js (${esmSize})`);
console.log(`built dist/index.cjs (${cjsSize})`);
console.log("copied dist/index.d.ts");
