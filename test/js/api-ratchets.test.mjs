import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { undocumentedEntries, documentationRegressions, extractPackageEntries, diffEntries, main } from '../../scripts/check-api-surface.mjs';

test('documentation counts exports and immediate class/interface members, including overloads', () => {
  const source = `
    /** documented */ export class Chat<T extends { id: string }> {
      /** documented constructor */ constructor();
      /** documented method */ send(options: { nested: string }): void;
      send(text: string): void;
      send(count: number): void;
      readonly model: string;
      private secret: string;
    }
    export interface Options {
      /** docs */ value: string;
      callback: (value: { nested: string }) => void;
      [key: string]: unknown;
    }
    type Internal = string;
    /** docs */ export function f<T>(x: T): T;
    export type Shape = { nested: string };
    export const url: "https://host/** fake */";
  `;
  assert.deepEqual(undocumentedEntries(source), [
    'Chat.model #1', 'Chat.send #1', 'Chat.send #2', 'Options.[key: string] #1',
    'Options.callback #1', 'const url #1', 'interface Options #1', 'type Shape #1',
  ]);
});

test('ordinary comments, detached JSDoc and comment markers in literals do not document declarations', () => {
  assert.deepEqual(undocumentedEntries(`
    /* ordinary */ export const a: string;
    /** docs */ // intervening comment
    export const b: string;
    /** docs */ export const c: '/** fake */';
    export const d: string;
  `), ['const a #1', 'const b #1', 'const d #1']);
});

test('documentation ratchet rejects replacements and overload growth even below the maximum', () => {
  assert.equal(documentationRegressions(['A #1', 'B #1'], ['A #1']), false);
  assert.equal(documentationRegressions(['A #1', 'B #1'], ['C #1']), true);
  assert.equal(documentationRegressions(['A #1'], ['A #1', 'A #2']), true);
  assert.equal(documentationRegressions(['A #1'], ['A #1'], 0), true);
});

const pkg = { exports: { '.': { types: './index.d.ts', import: './index.js', require: { default: './index.cjs' } } }, files: ['dist', 'README.md'], main: './index.cjs', module: './index.js', types: './index.d.ts' };
const packageDiff = (after) => diffEntries(extractPackageEntries(pkg), extractPackageEntries(after));
test('package snapshot detects removals and retargeting in every protected field', () => {
  for (const field of Object.keys(pkg)) {
    const after = structuredClone(pkg);
    delete after[field];
    assert.ok(packageDiff(after).some(({ type }) => type === 'REMOVED'), field);
  }
  const after = structuredClone(pkg);
  after.exports['.'].require.default = './other.cjs';
  assert.ok(packageDiff(after).some(({ type, key }) => type === 'CHANGED' && key === 'exports...require.default'));
  after.files.pop();
  assert.ok(packageDiff(after).some(({ type, key }) => type === 'REMOVED' && key.startsWith('files[')));
});

test('package additions are additions, file order is irrelevant, and export condition order matters', () => {
  const after = structuredClone(pkg);
  after.exports['./extra'] = './extra.js';
  after.files.push('LICENSE');
  assert.ok(packageDiff(after).length > 0);
  assert.ok(packageDiff(after).every(({ type }) => type === 'ADDED'));
  assert.deepEqual(packageDiff({ ...pkg, files: [...pkg.files].reverse() }), []);
  const reordered = structuredClone(pkg);
  reordered.exports['.'] = { import: './index.js', types: './index.d.ts', require: { default: './index.cjs' } };
  assert.ok(packageDiff(reordered).some(({ type }) => type === 'CHANGED'));
  assert.notDeepEqual(extractPackageEntries({ exports: ['./a', './b'] }), extractPackageEntries({ exports: ['./b', './a'] }));
});

test('update shrinks documentation baseline and requires a recorded reason for raises', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'chatoyant-ratchet-'));
  const logger = { log() {}, error() {} };
  const run = (...args) => main(args, root, logger);
  const source = (s) => writeFile(path.join(root, 'js/chatoyant_js.d.ts'), s);
  const baseline = () => readFile(path.join(root, 'test/api-surface/undocumented.txt'), 'utf8');
  try {
    await mkdir(path.join(root, 'js'));
    await mkdir(path.join(root, 'lib'));
    await writeFile(path.join(root, 'package.json'), JSON.stringify(pkg));
    await source('export const a: string; export const b: string;');
    assert.equal(await run('--update'), 0);
    await source('/** A documented value. */ export const a: string; export const b: string;');
    assert.equal(await run('--update'), 0);
    assert.match(await baseline(), /# Maximum: 1/);
    const before = await baseline();
    await source('export const a: string; /** B documented. */ export const b: string;');
    assert.equal(await run('--update'), 1);
    assert.equal(await baseline(), before);
    assert.equal(await run(), 1);
    await assert.rejects(run('--update', '--allow-raise'), /Usage/);
    await assert.rejects(run('--allow-raise', 'migration'), /Usage/);
    assert.equal(await run('--update', '--allow-raise', 'Reviewed compatibility migration'), 0);
    assert.match(await baseline(), /# Raise reason: Reviewed compatibility migration/);
    assert.equal(await run(), 0);
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ ...pkg, main: './missing.cjs' }));
    assert.equal(await run(), 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
