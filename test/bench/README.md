# Benchmark budgets

`npm run test:bench` (part of `npm test`, after the build) times a few hot paths in `dist/index.js`:
JSON Schema validation, token estimation, cost calculation, message JSON roundtrip, Schema class
conversion, and splitText/fitMessages.

CI machines differ in speed, so the gate does not compare raw times. Each benchmark is timed between
two runs of a fixed baseline (a JSON roundtrip of a small object) in the same process, and the gate
compares the median of 7 samples of `benchmark time / baseline time` against `maxRatio` in
`budgets.json`. Inputs are fixed and nothing touches the network. A run takes about 6 s.

The first budgets (2026-10-30) are 2.5x the worst median of five local runs on Node 24.

To tighten a budget, run `node scripts/bench.mjs --update` on main a few times, check the proposed
ceilings with `--json`, and commit the lower `maxRatio`. `--update` never raises an existing
ceiling. If a change really has to make a path slower, use `--update --allow-raise` and say why in
the commit message. A benchmark without a budget, or a budget without a benchmark, fails the gate.
