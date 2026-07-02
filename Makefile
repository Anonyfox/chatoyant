# Release + dev tasks for chatoyant (run from the repo root).
#
# The release engine bumps package.json (+ package-lock.json) and dune-project's
# (version) together, regenerates chatoyant.opam, proves the build, then commits
# and tags vX.Y.Z. The npm version, the OCaml/dune version, the opam version, and
# the git tag stay in lockstep.
#
#   make release-minor          # bump + prove + commit + tag (no push)
#   make release-minor DRY=1    # rehearse end-to-end, change nothing
#   make release-minor PUSH=1   # bump + prove + commit + tag + push
#
# Swap 'minor' for patch | major. DRY=1 and PUSH=1 work on every release-* target.

.DEFAULT_GOAL := help
.PHONY: help build test check version-check docs docs-serve \
        release-patch release-minor release-major

REL   := node scripts/release.mjs
FLAGS := $(if $(DRY),--dry-run) $(if $(PUSH),--push)

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-15s\033[0m %s\n",$$1,$$2}'

build: ## Build OCaml + Melange + npm bundle
	npm run build

test: ## Full test suite (node parity + types + JSON Schema)
	npm test

check: ## Full release gate (sync + test + lint + pack dry-run)
	npm run release:check

docs: ## Build the branded API docs into _site/
	dune build @doc
	node scripts/brand-docs.mjs

docs-serve: docs ## Build docs, then serve them at http://localhost:8099
	python3 -m http.server 8099 --directory _site

version-check: ## Assert package.json and dune-project versions match
	npm run version:check

release-patch: ## Cut a patch release (DRY=1 rehearse, PUSH=1 push)
	$(REL) patch $(FLAGS)

release-minor: ## Cut a minor release (DRY=1 rehearse, PUSH=1 push)
	$(REL) minor $(FLAGS)

release-major: ## Cut a major release (DRY=1 rehearse, PUSH=1 push)
	$(REL) major $(FLAGS)
