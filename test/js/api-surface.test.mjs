import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { extractJSEntries, extractOCamlEntries, diffEntries, stripJSComments, stripOCamlComments, main } from "../../scripts/check-api-surface.mjs";

const jsDiff = (before, after) => diffEntries(extractJSEntries(before), extractJSEntries(after));
const ocamlDiff = (before, after) => diffEntries(extractOCamlEntries(before), extractOCamlEntries(after));

describe("API surface gate", () => {
  it("strips JS comments while preserving markers and spaces inside strings", () => {
    const source = `// leading\nexport type URL = "https://host/*path*/  x"; /* trailing */\nexport type Quote = 'it\\'s // literal';`;
    const entries = extractJSEntries(source);
    assert.equal(entries.length, 2);
    assert.ok(entries.includes('type URL: export type URL = "https://host/*path*/  x";'));
    assert.ok(entries.some((entry) => entry.includes("it\\'s // literal")));
    assert.ok(!stripJSComments(source).includes("leading"));
    assert.deepEqual(extractJSEntries('export/* gap */type X = `/* text */`;'), ['type X: export type X = `/* text */`;']);
  });

  it("detects a removed interface member precisely", () => {
    const changes = jsDiff('export interface Chat { model: string; send(): void; }', 'export interface Chat { model: string; }');
    assert.ok(changes.some((change) => change.type === "REMOVED" && change.key === "Chat.send"));
    assert.ok(changes.some((change) => change.type === "CHANGED" && change.key === "interface Chat"));
  });

  it("reports a changed function signature as CHANGED", () => {
    assert.deepEqual(jsDiff('export function genText(prompt: string): string;', 'export function genText(prompt: string): Promise<string>;').map(({ type, key }) => ({ type, key })), [{ type: "CHANGED", key: "function genText" }]);
  });

  it("reports a new export as ADDED", () => {
    assert.equal(jsDiff('', 'export const version: string;')[0].type, "ADDED");
  });

  it("keeps overloads, including duplicate signatures, and matches unchanged ones first", () => {
    const a = 'export function create(x: string): string;';
    const b = 'export function create(x: number): number;';
    const c = 'export function create(x: boolean): boolean;';
    assert.equal(extractJSEntries(`${a}\n${b}\n${a}`).length, 3);
    assert.deepEqual(jsDiff(`${a}\n${b}`, `${c}\n${a}`).map(({ type, before, after }) => ({ type, before, after })), [{ type: "CHANGED", before: `function create: ${b}`, after: `function create: ${c}` }]);
    assert.equal(jsDiff(`${a}\n${a}`, a)[0].type, "REMOVED");
    const members = extractJSEntries('export interface X { call(x: number): number; call(x: string): string; }');
    assert.equal(members.filter((entry) => entry.startsWith("X.call:")).length, 2);
  });

  it("tracks generic constraints, arrows, and nested member types", () => {
    const source = `export interface X<T extends { id: string }> {
      call<U extends { value: T }>(arg: U, cb: (x: U) => void): Promise<U>;
      options: { nested: string; callback: () => void };
    }
    export type Literal = { a: string; b: number };
    export class Client { constructor(); send(): void; }
    export namespace N { export function f(): void; export const x: number; }
    export enum E { A = "//", B = "/*" }`;
    const entries = extractJSEntries(source);
    for (const key of ["X.call", "X.options", "Literal.a", "Literal.b", "Client.send", "N.f", "N.x", "E.A", "E.B"]) {
      assert.ok(entries.some((entry) => entry.startsWith(`${key}: `)), key);
    }
    assert.equal(entries.filter((entry) => entry.startsWith("interface X:")).length, 1);
  });

  it("strips nested OCaml comments and preserves strings and quoted strings", () => {
    const source = `(* outer (* inner *) end *)
val url : string
external text : string = "https://host/(* literal *)  x"
external quoted : string = {tag|(* literal *)  x|tag}
(* trailing *)`;
    const entries = extractOCamlEntries(source, "lib/example.mli");
    assert.equal(entries.length, 3);
    assert.ok(!stripOCamlComments(source).includes("inner"));
    assert.ok(entries.some((entry) => entry.includes('"https://host/(* literal *)  x"')));
    assert.ok(entries.some((entry) => entry.includes('{tag|(* literal *)  x|tag}')));
    assert.ok(entries.every((entry) => entry.startsWith("lib/example.mli::")));
  });

  it("reports OCaml val changes and keeps nested signatures in their parent", () => {
    assert.equal(ocamlDiff('val generate : string -> string', 'val generate : string -> int')[0].type, "CHANGED");
    const entries = extractOCamlEntries(`module type S = sig
  val run : unit -> unit
  module Nested : sig val x : int end
end
val create : (module S) -> unit
type 'a t
type ('a, 'b) pair
exception Failed of string
include S`);
    assert.equal(entries.length, 6);
    assert.ok(entries.some((entry) => entry.startsWith("fixture.mli::type t:")));
    assert.ok(entries.some((entry) => entry.startsWith("fixture.mli::type pair:")));
    assert.ok(entries.some((entry) => entry.includes("module Nested : sig val x : int end end")));
  });

  it("sorts deterministically regardless of source declaration order", () => {
    assert.deepEqual(extractJSEntries('export const z: number; export const a: number;'), extractJSEntries('export const a: number; export const z: number;'));
    assert.deepEqual(extractOCamlEntries('val z : int\nval a : int'), extractOCamlEntries('val a : int\nval z : int'));
  });

  it("committed snapshots match the current sources", async () => {
    assert.equal(await main([]), 0);
  });

  it("checks both built declaration copies byte for byte, even in update mode", async () => {
    const fixture = await mkdtemp(path.join(tmpdir(), "chatoyant-api-"));
    try {
      for (const dir of ["scripts", "js", "lib/public", "lib/private", "dist"]) await mkdir(path.join(fixture, dir), { recursive: true });
      const source = 'export interface X { member: string; }\n';
      await writeFile(path.join(fixture, "js/chatoyant_js.d.ts"), source);
      await writeFile(path.join(fixture, "lib/public/dune"), '(library (name api) (public_name chatoyant.api))');
      await writeFile(path.join(fixture, "lib/public/api.mli"), 'val run : unit -> unit');
      await writeFile(path.join(fixture, "lib/private/dune"), '(library (name hidden))');
      await writeFile(path.join(fixture, "lib/private/hidden.mli"), 'val hidden : int');
      const run = async (...args) => {
        const messages = [];
        const logger = { log: (s) => messages.push(s), error: (s) => messages.push(s) };
        const status = await main(args, fixture, logger);
        return { status, output: messages.join("\n") };
      };
      assert.equal((await run("--update")).status, 0);
      assert.doesNotMatch(await readFile(path.join(fixture, "test/api-surface/ocaml.api.txt"), "utf8"), /hidden/);
      for (const file of ["index.d.ts", "index.d.cts"]) {
        await writeFile(path.join(fixture, "dist", file), source + " ");
        const result = await run();
        assert.equal(result.status, 1);
        assert.match(result.output, /declarations differ/);
        assert.equal((await run("--update")).status, 1);
        await writeFile(path.join(fixture, "dist", file), source);
      }
      assert.equal((await run()).status, 0);
      await writeFile(path.join(fixture, "js/chatoyant_js.d.ts"), 'export interface X {}\n');
      const removed = await run();
      assert.equal(removed.status, 1);
      assert.match(removed.output, /REMOVED X.member: possible breaking change: needs maintainer approval/);
    } finally {
      await rm(fixture, { recursive: true, force: true });
    }
  });
});
