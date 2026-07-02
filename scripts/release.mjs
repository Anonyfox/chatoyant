#!/usr/bin/env node
// Release engine for chatoyant.
//
// Bumps package.json (+ package-lock.json) and dune-project's (version)
// together, regenerates the committed chatoyant.opam, stamps CHANGELOG.md's
// "Unreleased" section with the new version and date (dune-release reads the
// top entry for opam release notes), proves the build with `release:check`,
// then commits and tags vX.Y.Z. The npm version, the OCaml/dune version, the
// opam version, and the git tag stay equal; check-version-sync.mjs (run inside
// release:check) refuses any drift.
//
// Usage:
//   node scripts/release.mjs <patch|minor|major> [--dry-run] [--push]
//
//   --dry-run  Rehearse end to end (real bump + full release:check), then
//              restore every touched file. Nothing is committed, tagged, or
//              pushed. Does not require a clean tree.
//   --push     After committing and tagging, run `git push --follow-tags`.
//              Omitted by default: until the repo cutover, pushing a v*.*.*
//              tag would trigger the legacy root publish workflow.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PKG = join(ROOT, "package.json");
const DUNE = join(ROOT, "dune-project");
const OPAM = join(ROOT, "chatoyant.opam");
const CHANGELOG = join(ROOT, "CHANGELOG.md");
const TOUCHED = [
  "package.json",
  "package-lock.json",
  "dune-project",
  "chatoyant.opam",
  "CHANGELOG.md",
];
const BUMPS = new Set(["patch", "minor", "major"]);

const fail = (msg) => {
  console.error(`release: ${msg}`);
  process.exit(1);
};

const git = (...args) =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
const gitInherit = (...args) =>
  execFileSync("git", args, { cwd: ROOT, stdio: "inherit" });
const npmInherit = (...args) =>
  execFileSync("npm", args, { cwd: ROOT, stdio: "inherit" });

function readDuneVersion() {
  const m = readFileSync(DUNE, "utf8").match(/^\(version\s+([^)\s]+)\)/m);
  return m ? m[1] : null;
}

function writeDuneVersion(v) {
  let src = readFileSync(DUNE, "utf8");
  if (/^\(version\s+[^)]+\)/m.test(src)) {
    src = src.replace(/^\(version\s+[^)]+\)/m, `(version ${v})`);
  } else {
    src = src.replace(/^(\(name\s+[^)]+\))\s*$/m, `$1\n(version ${v})`);
  }
  writeFileSync(DUNE, src);
}

// Regenerate the committed opam file from dune-project. dune's --auto-promote
// exits non-zero on the run that performs a promotion, so the exit code is
// deliberately ignored; correctness is verified by reading the result back.
function promoteOpam(expected) {
  try {
    execFileSync("dune", ["build", "@install", "--auto-promote"], {
      cwd: ROOT,
      stdio: "inherit",
    });
  } catch {
    /* promotion run reports non-zero — verified below instead */
  }
  const got = (readFileSync(OPAM, "utf8").match(/^version:\s*"([^"]+)"/m) ?? [])[1];
  if (got !== expected)
    throw new Error(`opam regeneration failed: chatoyant.opam=${got ?? "(none)"} expected ${expected}`);
}

// Turn the "## Unreleased" section into the released entry. Refusing to release
// without one keeps the changelog honest — every release ships written notes.
function stampChangelog(v) {
  const src = readFileSync(CHANGELOG, "utf8");
  if (!/^## Unreleased\s*$/m.test(src))
    throw new Error(
      "CHANGELOG.md has no '## Unreleased' section — write the release notes first",
    );
  const date = new Date().toISOString().slice(0, 10);
  writeFileSync(CHANGELOG, src.replace(/^## Unreleased\s*$/m, `## ${v} — ${date}`));
}

function nextVersion(current, kind) {
  const m = current.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) fail(`current version "${current}" is not plain semver`);
  let [maj, min, pat] = m.slice(1).map(Number);
  if (kind === "major") (maj += 1), (min = 0), (pat = 0);
  else if (kind === "minor") (min += 1), (pat = 0);
  else pat += 1;
  return `${maj}.${min}.${pat}`;
}

function main() {
  const argv = process.argv.slice(2);
  const kind = argv.find((a) => !a.startsWith("-"));
  const dryRun = argv.includes("--dry-run");
  const push = argv.includes("--push");
  if (!BUMPS.has(kind)) fail(`expected patch|minor|major, got "${kind ?? ""}"`);

  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  const current = JSON.parse(readFileSync(PKG, "utf8")).version;
  const duneCurrent = readDuneVersion();
  if (duneCurrent !== null && duneCurrent !== current)
    fail(
      `version drift: package.json=${current} dune-project=${duneCurrent} — fix before releasing`,
    );

  const next = nextVersion(current, kind);
  const tag = `v${next}`;

  if (!dryRun && git("status", "--porcelain") !== "")
    fail("working tree is not clean — commit or stash, or use DRY=1 to rehearse");
  if (git("tag", "--list", tag) === tag) fail(`tag ${tag} already exists`);

  console.log(
    `release: ${current} -> ${next}  (tag ${tag}, branch ${branch})${dryRun ? "  [dry-run]" : ""}\n`,
  );

  const snapshot = TOUCHED.map((f) => join(ROOT, f))
    .filter(existsSync)
    .map((f) => [f, readFileSync(f)]);
  const restore = () => snapshot.forEach(([f, buf]) => writeFileSync(f, buf));

  let committed = false;
  let error = null;
  try {
    npmInherit("version", next, "--no-git-tag-version", "--ignore-scripts");
    writeDuneVersion(next);
    promoteOpam(next);
    stampChangelog(next);
    npmInherit("run", "release:check");

    if (dryRun) {
      console.log("\nrelease: dry-run OK — would run:");
      console.log(`  git add ${TOUCHED.join(" ")}`);
      console.log(`  git commit -m "Release ${tag}"`);
      console.log(`  git tag -a ${tag} -m "Release ${tag}"`);
      console.log(push ? "  git push --follow-tags" : "  (push skipped — pass PUSH=1)");
      console.log("\nrelease: tree restored, nothing changed.");
      return;
    }

    git("add", ...TOUCHED);
    git("commit", "-m", `Release ${tag}`);
    git("tag", "-a", tag, "-m", `Release ${tag}`);
    committed = true;
    console.log(`\nrelease: committed and tagged ${tag}.`);

    if (push) {
      gitInherit("push", "--follow-tags");
      console.log(`release: pushed ${branch} with tags.`);
    } else {
      console.log("release: not pushed. When ready:  git push --follow-tags");
    }
  } catch (err) {
    error = err;
  } finally {
    if (!committed) restore();
  }

  if (error) {
    if (committed)
      fail(`post-commit step failed (commit + tag ${tag} stand): ${error.message ?? error}`);
    fail(`aborted — reverted, nothing committed.\n${error.message ?? error}`);
  }
}

main();
