# JavaScript Migration Notes

This rewrite preserves the useful public behavior of the original JavaScript
package while making one deliberate package-surface break: first-class usage now
comes from the root import only. Because the package is still below `1.0`, this
is intended as a minor npm release once the replacement is approved.

## Preserved Highlights

- `genText`, `genData`, `genStream`, and `genStreamAccumulate` remain the quick
  one-shot APIs.
- `Chat` remains the stateful/fluent conversation object with message mutation,
  tools, generation, streaming, `lastResult`, JSON roundtrip, clone, and fork.
- `Message`, `Tool`, `createTool`, `Schema`, `JsonSchema`, and `SchemaError`
  remain normal root-level building blocks.
- Token helpers, pricing tables, context-window helpers, and model/provider
  detection helpers remain available.
- Explicit provider clients remain available for OpenAI, Anthropic, xAI,
  OpenRouter, and local OpenAI-compatible servers.
- ESM and CJS consumers are both supported.
- Usage metadata prefers provider-reported token counts and accumulates tool
  iterations instead of relying on estimates when real numbers are available.

## Import Migration

```ts
// Old
import { Chat, genText } from "chatoyant/core";
import { Schema } from "chatoyant/schema";
import { estimateTokens } from "chatoyant/tokens";
import { createOpenAIClient } from "chatoyant/providers/openai";

// New
import {
  Chat,
  Schema,
  createOpenAIClient,
  estimateTokens,
  genText,
} from "chatoyant";
```

Namespace imports are available when they read better:

```ts
import { OpenAI, Providers, Tokens } from "chatoyant";

const client = OpenAI.create({ model: "gpt-4o" });
const router = Providers.OpenRouter.create({ model: "openai/gpt-4o" });
const tokens = Tokens.estimateTokens("hello world");
```

## Subpath Map

| Old import | New import |
| --- | --- |
| `chatoyant/core` | `chatoyant` direct exports or `Core` namespace |
| `chatoyant/schema` | `chatoyant` direct exports or `Schemas` namespace |
| `chatoyant/tokens` | `chatoyant` direct exports or `Tokens` namespace |
| `chatoyant/providers/openai` | `chatoyant` direct exports or `OpenAI` namespace |
| `chatoyant/providers/anthropic` | `chatoyant` direct exports or `Anthropic` namespace |
| `chatoyant/providers/xai` | `chatoyant` direct exports or `XAI` namespace |
| `chatoyant/providers/openrouter` | `chatoyant` direct exports or `OpenRouter` namespace |
| `chatoyant/providers/local` | `chatoyant` direct exports or `Local` namespace |

## Behavior Notes

- Unknown provider-specific options still pass through `extra` or provider
  client calls where the provider supports them.
- OpenAI-compatible local providers are intentionally conservative: they smooth
  known local stream quirks and avoid paid-cost accounting.
- Raw providers are maintained from current provider docs, not just old package
  assumptions. When a provider has moved since the old TypeScript package, the
  new client follows the current provider behavior and records that as
  `updated` in the parity docs.

## Confidence Gates

Before this package can replace the old JavaScript implementation:

- `npm test` must pass from `ocaml/`.
- `npm run pack:dry-run` must show only the expected publish files.
- `test/js/adjacent-usage-patterns.test.mjs` must keep covering production
  import and behavior patterns gathered from sibling repositories.
- `docs/PARITY.md` must show no missing old root exports except the accepted
  subpath removal.
