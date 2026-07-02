#!/usr/bin/env node
// Submit a released version to the public opam-repository.
//
// Deterministic replacement for `dune-release publish` + `opam submit`, whose
// interactive prompts crash on non-tty (End_of_file). Steps:
//
//   1. dune-release distrib      build + test the source tarball from the tag
//   2. gh release upload         attach the tarball to the GitHub release
//   3. checksum verify           served asset must match the recipe's sha512
//   4. dune-release opam pkg     write the opam recipe with url + checksums
//   5. fork clone                ensure a treeless clone of <you>/opam-repository
//   6. branch + commit + push    packages/chatoyant/chatoyant.X.Y.Z/opam
//   7. gh pr create              or force-update the existing open PR
//
// Re-running is safe: the asset upload clobbers, the branch is recreated from
// upstream/master, and an existing open PR is updated by the force-push.
//
// Usage:
//   node scripts/opam-publish.mjs [--tag vX.Y.Z] [--dry-run]
//
//   --tag      Release tag to submit (default: v<package.json version>).
//   --dry-run  Run distrib, verification, recipe, and branch prep, but do not
//              upload, push, or open a PR.
//
// Config: OPAM_REPO_CLONE overrides the fork clone path (default
// ~/git/opam-repository, matching dune-release's own default).

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UPSTREAM = "ocaml/opam-repository";
const CLONE = process.env.OPAM_REPO_CLONE || join(homedir(), "git", "opam-repository");

const fail = (msg) => {
  console.error(`opam-publish: ${msg}`);
  process.exit(1);
};

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: "utf8", ...opts }).trim();
const show = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: "inherit", ...opts });
const git = (...args) => run("git", ["-C", CLONE, ...args]);
const gitShow = (...args) => show("git", ["-C", CLONE, ...args]);

function sha512(buffer) {
  return createHash("sha512").update(buffer).digest("hex");
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const tagIdx = argv.indexOf("--tag");
  const pkgVersion = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
  const tag = tagIdx !== -1 ? argv[tagIdx + 1] : `v${pkgVersion}`;
  if (!/^v\d+\.\d+\.\d+$/.test(tag ?? "")) fail(`bad tag "${tag}" — expected vX.Y.Z`);
  const version = tag.slice(1);
  const branch = `release-chatoyant-${version}`;
  const tarball = join(ROOT, "_build", `chatoyant-${tag}.tbz`);
  const recipe = join(ROOT, "_build", `chatoyant.${version}`, "opam");

  // Preflight: tag exists, gh is authenticated (also yields the fork owner).
  try {
    run("git", ["-C", ROOT, "rev-parse", "--verify", `refs/tags/${tag}`]);
  } catch {
    fail(`tag ${tag} does not exist — cut the release first (make release-*)`);
  }
  let owner;
  try {
    owner = run("gh", ["api", "user", "--jq", ".login"]);
  } catch {
    fail("gh is not authenticated — run `gh auth login` (or set GH_TOKEN)");
  }
  const fork = `${owner}/opam-repository`;
  const assetUrl = `https://github.com/${owner}/chatoyant/releases/download/${tag}/chatoyant-${tag}.tbz`;

  console.log(
    `opam-publish: chatoyant ${version} (tag ${tag}) -> ${UPSTREAM}${dryRun ? "  [dry-run]" : ""}\n`,
  );

  // 1. Build + test the distribution tarball from the tag.
  show("opam", ["exec", "--", "dune-release", "distrib", "--tag", tag], { cwd: ROOT });
  if (!existsSync(tarball)) fail(`distrib did not produce ${tarball}`);

  // 2. Attach the tarball to the GitHub release (idempotent via --clobber).
  if (dryRun) {
    console.log(`opam-publish: [dry-run] skipping: gh release upload ${tag} ${tarball}`);
  } else {
    show("gh", ["release", "upload", tag, tarball, "--clobber"], { cwd: ROOT });
  }

  // 3. The served asset must be byte-identical to the local tarball.
  const local = sha512(readFileSync(tarball));
  const response = await fetch(assetUrl);
  if (response.ok) {
    const served = sha512(Buffer.from(await response.arrayBuffer()));
    if (served !== local) {
      const msg = `served asset checksum differs from local tarball (${assetUrl})`;
      if (dryRun) console.warn(`opam-publish: warning — ${msg}`);
      else fail(msg);
    } else {
      console.log("opam-publish: served asset checksum verified");
    }
  } else if (!dryRun) {
    fail(`uploaded asset is not downloadable: HTTP ${response.status} ${assetUrl}`);
  }

  // 4. Write the opam recipe (url + sha256/sha512 from the local tarball).
  show("opam", ["exec", "--", "dune-release", "opam", "pkg", "--tag", tag], { cwd: ROOT });
  if (!existsSync(recipe)) fail(`opam pkg did not produce ${recipe}`);

  // 5. Ensure the fork and a treeless local clone with an upstream remote.
  if (!existsSync(CLONE)) {
    try {
      run("gh", ["repo", "view", fork, "--json", "name"]);
    } catch {
      show("gh", ["repo", "fork", UPSTREAM, "--clone=false"]);
    }
    mkdirSync(dirname(CLONE), { recursive: true });
    show("git", [
      "clone",
      "--filter=tree:0",
      "--single-branch",
      "--branch",
      "master",
      `https://github.com/${fork}.git`,
      CLONE,
    ]);
  }
  try {
    git("remote", "get-url", "upstream");
  } catch {
    git("remote", "add", "upstream", `https://github.com/${UPSTREAM}.git`);
  }
  gitShow("fetch", "upstream", "master");

  // 6. Recreate the release branch from upstream/master and commit the recipe.
  git("checkout", "-B", branch, "upstream/master");
  const pkgDir = join(CLONE, "packages", "chatoyant", `chatoyant.${version}`);
  mkdirSync(pkgDir, { recursive: true });
  run("cp", [recipe, join(pkgDir, "opam")]);
  show("opam", ["lint", join(pkgDir, "opam")]);
  const isNewPackage = git("ls-tree", "upstream/master", "--name-only", "packages/chatoyant") === "";
  const title = `[${isNewPackage ? "new package" : "new release"}] chatoyant (${version})`;
  git("add", "packages/chatoyant");
  git("commit", "-m", title);

  if (dryRun) {
    console.log(`\nopam-publish: dry-run OK — would push ${branch} to ${fork} and open:`);
    console.log(`  ${title}  (${UPSTREAM} <- ${owner}:${branch})`);
    return;
  }

  // 7. Push and open (or update) the pull request.
  gitShow("push", "--force-with-lease", "-u", "origin", branch);
  const existing = run("gh", [
    "pr", "list",
    "--repo", UPSTREAM,
    "--head", `${owner}:${branch}`,
    "--state", "open",
    "--json", "url",
    "--jq", ".[0].url // empty",
  ]);
  if (existing) {
    console.log(`\nopam-publish: existing PR updated by the push: ${existing}`);
    return;
  }
  const body = [
    `Release of **chatoyant** ${version}: an OCaml-first SDK for LLM providers`,
    "(OpenAI, Anthropic, xAI, OpenRouter, local OpenAI-compatible servers) with an",
    "Eio native API, typed tools and structured outputs, streaming, and token/cost",
    "accounting.",
    "",
    `- Sources: https://github.com/${owner}/chatoyant`,
    `- Changes: https://github.com/${owner}/chatoyant/blob/main/CHANGELOG.md`,
    "- Tests run offline (`with-test` needs no network or API keys).",
    "",
    "🤖 Generated with [Claude Code](https://claude.com/claude-code)",
  ].join("\n");
  show("gh", [
    "pr", "create",
    "--repo", UPSTREAM,
    "--base", "master",
    "--head", `${owner}:${branch}`,
    "--title", title,
    "--body", body,
  ]);
}

await main();
