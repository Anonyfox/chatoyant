# Adjacent Chatoyant Usage Audit

Scanned sibling repositories under `/Users/fox/projects/github.com/Anonyfox`
on 2026-06-20. Build artifacts, dependency folders, and hidden worktree copies
were excluded from the primary counts. Secrets were not copied into this file.

## Active Dependents

| Repo | Version | Primary use | Compatibility weight |
| --- | --- | --- | --- |
| `gastrorocket` | `^0.2.2` | `genText` one-shot text generation for German business-plan/name helpers | low, legacy |
| `cosmolytic` | `^0.7.0` | `Chat.generateData`, `Schema` classes, `genText`, `createXAIClient`, old `chatoyant/dist/tokens` media cost import | high |
| `micely` | `^0.11.1` | dynamic `import("chatoyant")`, `Chat.generateData`, `Schema.toObject`, `chat.lastResult.usage` tracking | high |
| `gastrorocket-andromeda` | `^0.11.1` | large structured extraction, `Chat.fork`, `generateData`, token/cost accounting, OpenAI/OpenRouter subpath clients | critical |
| `gastrorocket-orbit` | `^0.11.1` | `genData`, `Schema`, `Chat.addTools(...).generate()` agent loops | critical |
| `ghostpaw` | `^0.6.0` | `Chat`, `Message`, `Tool`, `createTool`, streaming turns, persisted tool-call/result messages, provider/model listing utilities | critical |
| `gastrorocket-ops/scripts` | `^0.10.0` | package dependency only in active scripts tree | low |

`ghostpaw/v0` is not current production but remains valuable regression
material: it uses older `Chat`/`Message`/`Tool`/`stream` patterns heavily.

## Surface In Use

### Root Exports

- `Chat`
- `Message`
- `Tool`
- `Schema`
- `createTool`
- `genText`
- `genData`
- `genStream` / `stream` indirectly through `Chat.stream`
- `detectProviderByModel`
- `isProviderActive`
- `getModelsForProvider`

### Subpath Exports

These existing production imports are migration inputs, not the target shape.
The OCaml/Melange package should expose equivalent capabilities from the root
package through direct exports and provider/token/schema namespace objects.

- `chatoyant/providers/openai`
  - `createOpenAIClient`
  - `OpenAIClient` type
  - `listModelIds`
- `chatoyant/providers/openrouter`
  - `createOpenRouterClient`
- `chatoyant/providers/anthropic`
  - `listModelIds`
- `chatoyant/providers/xai`
  - `getLanguageModelList`
- `chatoyant/tokens`
  - `calculateCost`
  - `estimateTokens`
- Legacy compatibility:
  - `chatoyant/dist/tokens`
  - `calculateVideoCost`

## Chat Patterns

### One-Shot Text

Seen in `gastrorocket/imports/api/ai/server/methods.ts`.

Pattern:

```ts
import { genText } from "chatoyant";

const text = await genText(userPrompt, {
  system: systemPrompt,
  model: "grok-...",
});
```

Required parity:

- `system` option is honored.
- model routing recognizes Grok/xAI names and legacy `API_KEY_XAI`.
- return type is a plain `Promise<string>`.

### Structured `Chat.generateData`

Seen in `cosmolytic`, `micely`, and `gastrorocket-andromeda`.

Pattern:

```ts
class Output extends Schema {
  title = Schema.String({ description: "..." });
}

const chat = new Chat({ model: "claude-..." });
chat.system(systemPrompt);
chat.user(prompt);
const result = await chat.generateData(Output, { creativity: "precise" });
const plain = Schema.toObject(result);
const usage = chat.lastResult?.usage;
```

Required parity:

- class-based `Schema extends Schema` descriptors work.
- `Schema.toObject()` returns plain JSON-like data.
- `generateData()` validates/parses structured output.
- `creativity`, `maxTokens`, `temperature`, and model presets are accepted.
- `chat.lastResult.usage` remains populated best-effort after success and
  failure paths.

### Multi-Message Structured Chat

Seen in `cosmolytic` card generation.

Pattern:

```ts
const chat = new Chat({ model: "claude-sonnet-..." });
chat.system(prompt);
for (const hint of hints) chat.user(hint.content);
chat.user(finalInstruction);
await chat.generateData(OutputSchema);
```

Required parity:

- repeated `user()` calls preserve order.
- Anthropic routing strips/handles system prompt correctly.
- structured output works after many context messages.

### Forked Fan-Out

Seen in `gastrorocket-andromeda/src/menus/extract.ts`.

Pattern:

```ts
const base = new ChatWithUsage({ model });
base.system(SYSTEM_PROMPT);
base.user(fullText);
base.user(step1Question);
await base.generateData(PrefixSelectionSchema, opts);

const fork = base.fork();
fork.user(focusPrompt);
await fork.generateData(MenuExtractionSchema, opts);
```

Required parity:

- `fork()` clones model/defaults/messages without sharing subsequent message
  mutation.
- forks keep a byte-identical prefix for provider caching.
- per-fork `lastResult`/usage is independent.

### Tool-Calling Agent Loop

Seen in `gastrorocket-orbit` and `ghostpaw`.

Pattern:

```ts
const searchTool = createTool({
  name: "search_assumptions",
  description: "...",
  parameters: SearchParams as unknown as new () => never,
  execute: async ({ args }) => ({ results: [] }),
});

const chat = new Chat({ model });
chat.system(SYSTEM_PROMPT);
chat.addTools([searchTool, linkTool, createTool]);
await chat.user(signalText).generate({ maxIterations: 8 });
```

Required parity:

- `createTool()` accepts schema constructors, schema instances, and raw `{}`.
- `execute({ args, ctx })` receives parsed arguments.
- `generate({ maxIterations })` drives repeated provider calls until no tools
  remain.
- unknown tools and failed validation become tool-result messages, not process
  crashes.
- `chat.messages` contains assistant tool-call messages and tool result
  messages for persistence.

### Streaming Chat

Seen heavily in `ghostpaw` current and `ghostpaw/v0`.

Pattern:

```ts
for await (const chunk of chat.stream(options)) {
  // persist or render chunk
}
```

Required parity:

- `stream()` returns `AsyncGenerator<string, void, undefined>`.
- `lastResult` is populated when the stream completes.
- history is updated with final assistant text.
- tool-enabled streams may fall back to safe tool-loop generation, but direct
  streams must yield provider SSE chunks.

### Message Persistence

Seen in `ghostpaw/src/core/chat/persist_tool_messages.ts`.

Pattern:

```ts
for (const msg of chat.messages) {
  if (msg.role === "assistant" && msg.toolCalls?.length) {
    msg.toolCalls.map((tc) => ({ id: tc.id, name: tc.name, arguments: tc.arguments }));
  } else if (msg.role === "tool") {
    msg.toolCallId;
    msg.content;
  }
}
```

Required parity:

- `Message` instances expose `role`, `content`, `toolCalls`, `toolCallId`.
- tool call data uses the old JS field name `arguments`, not only `args` or
  `arguments_json`.
- `Message.fromJSON()` and `toJSON()` preserve tool metadata.

## Schema Patterns

The active repos use class fields heavily:

- `Schema.String({ description, optional, minLength/maxLength? })`
- `Schema.Number({ minimum, maximum, optional })`
- `Schema.Integer({ minimum, maximum, optional })`
- `Schema.Boolean({ optional })`
- `Schema.Enum([... ] as const, { description, optional })`
- `Schema.Array(Schema.String())`
- `Schema.Array(Schema.Object(SomeSchema))`
- `Schema.Object(SomeSchema, { optional, description })`
- `Schema.create(SchemaClass)`
- `Schema.toJSON(instance)`
- `Schema.parse(instance, parsed)`
- `Schema.toObject(instance)`

Compatibility requirement: the emitted JS root surface needs TypeScript-style
`Schema` class/proxy behavior, not only raw OCaml descriptors.

## Provider/Model Utilities

Seen in `ghostpaw/src/lib/models/*` and web routes.

Required parity:

- `detectProviderByModel(model)`:
  - `claude...` -> `anthropic`
  - `grok...` -> `xai`
  - `provider/model` -> `openrouter`
  - OpenAI model families -> `openai`
- `isProviderActive(provider)` checks key/env availability without throwing.
- `getModelsForProvider(provider)` returns stable fallback model id arrays.
- Provider subpaths export live model-list helpers:
  - `listModelIds({ apiKey })` for OpenAI/Anthropic.
  - `getLanguageModelList({ apiKey })` for xAI.

## Token/Cost Utilities

Required parity:

- `estimateTokens(text)` still exists under `chatoyant/tokens`.
- `calculateCost(...)` under `chatoyant/tokens`.
- legacy `chatoyant/dist/tokens` must keep working for Cosmolytic until
  downstream migrates.
- `calculateVideoCost` is used by Cosmolytic's xAI video generator.

## Regression Coverage

The adjacent usage map is executable now:

- `test/node_adjacent_usage_patterns.mjs` covers root `Chat`, `Message`,
  `Tool`, `createTool`, `genText`, JS callback tool loops, persisted
  tool-call/result message shapes, `fork`, JSON roundtrip, and SSE streaming.
- `test/js/root-surface.test.mjs` snapshots the curated root-only export list
  so subpath-era helpers do not disappear or leak accidentally.
- `test/js/schema-tool.test.mjs` covers class-based schema fields, nested
  object/array/enum shapes, `Schema.toObject`, `createTool`, validation, and
  structured tool metadata.
- `test/js/chat-provider.test.mjs` covers the npm-facing `Chat` class,
  provider-backed generation, streaming, state inspection, and JSON restore.
- `test/typed/usage_patterns.ts` is compiled by `tsc` against `dist/index.d.ts`
  so known downstream TypeScript shapes keep receiving declaration feedback.
- Provider real smokes stay opt-in through `*_API_KEY` environment variables;
  local inference smoke uses `LOCAL_BASE_URL` and `LOCAL_MODEL`.
