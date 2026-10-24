# JavaScript Guide

The npm package is generated from the OCaml/Melange implementation and bundled
with esbuild. It exposes a single root import path, ESM plus CommonJS
entrypoints, checked `dist/index.d.ts` and `dist/index.d.cts` declaration files,
and no runtime npm dependencies.

## Install Shape

```bash
npm install chatoyant
```

Use the root import for everything:

```ts
import {
  Chat,
  JsonSchema,
  OpenAI,
  OpenRouter,
  Schema,
  Tokens,
  createTool,
  genData,
  genStream,
  genText,
} from "chatoyant";
```

Former subpaths such as `chatoyant/core`, `chatoyant/schema`,
`chatoyant/tokens`, and `chatoyant/providers/openai` intentionally migrate to
root exports and root namespace objects.

## Provider Routing

Provider is detected from the model name unless explicitly set.

| Provider | Env var | Detection |
| --- | --- | --- |
| OpenAI | `OPENAI_API_KEY` | `gpt-*`, `o1-*`, `o3-*`, `o4-*`, `chatgpt-*` |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-*` |
| xAI | `XAI_API_KEY` | `grok-*` |
| Meta | `META_API_KEY` (or `MODEL_API_KEY`) | `muse-*` |
| OpenRouter | `OPENROUTER_API_KEY` | Slash notation such as `openai/gpt-4o` |
| Local | `LOCAL_BASE_URL` | Explicit `provider: "local"` or local fallback |

## Images, Files, and the Responses API

Messages accept image and file attachments; each provider adapter renders
them into its native blocks (OpenAI content parts / Responses input items,
Anthropic image and document blocks, xAI image parts):

```ts
import { Chat, OpenAI } from "chatoyant";

// URLs, data: URIs, { data, mediaType } base64 objects, or provider file ids
const chat = new Chat({ model: "gpt-6.1-sol" })
  .user("What is in this photo, and what does the spec say?", {
    images: ["https://example.com/photo.jpg"],
    files: [{ fileId }],
  });
await chat.generate();
```

For multi-turn conversations, upload once and attach by file id — history
then re-sends only the id, never the bytes:

```ts
const file = await OpenAI.uploadFile(
  { data: pdfBase64, filename: "spec.pdf", mediaType: "application/pdf" },
);
chat.user("Read the attached spec.", { files: [{ fileId: file.id }] });
```

`uploadFile` / `listFiles` / `getFile` / `deleteFile` exist on `OpenAI`,
`Meta`, and `Anthropic` (Anthropic's Files API beta header is added
automatically, for uploads and whenever a message references a file id).
Base64 attachments also work everywhere and benefit from automatic prompt
caching on repeat turns.

The Responses API has a typed surface of its own — normalized results,
usage, and `ProviderError` failures included:

```ts
const result = await OpenAI.createResponse(messages, { reasoning: "high" });
const data = await OpenAI.responseStructured(messages, PersonSchema);
```

Both also exist on `Meta`. Provider HTTP failures throw `ProviderError`
carrying `status`, `errorType`, `errorCode`, and `errorParam` from the
provider's error envelope alongside the original message.

Meta's Model API (Muse Spark) is handled with its wire rules applied
automatically: reasoning cannot be disabled (`reasoning: "off"` omits the
field; `minimal`–`xhigh` pass through), `stop` sequences and non-`"auto"`
`toolChoice` values are dropped instead of failing the request, `maxTokens`
maps to `max_completion_tokens`, and `webSearch: true` routes through
`/v1/responses` with the built-in `web_search` tool. The discounted
`muse-spark-1.2-contributor` model permits Meta to train on request data —
it is priced and recognized but never selected by a preset.

Intent presets resolve to provider-specific model names:

| Preset | OpenAI | Anthropic | xAI | Meta |
| --- | --- | --- | --- | --- |
| fast / cheap | gpt-6-luna | claude-haiku-5-5 | grok-4-1-fast-non-reasoning | muse-spark-1.3 |
| balanced | gpt-6.1-sol | claude-sonnet-5-5 | grok-4.3 | muse-spark-1.3 |
| best / reasoning | gpt-6-astra | claude-fable-5-1 | grok-4.7 | muse-spark-1.3 |

Also recognized: gpt-6-sol, gpt-5.6-cyber, gpt-5.5-cyber, gpt-5.3-codex,
chat-latest, gpt-5-search-api, claude-mythos-5-1, claude-opus-5-5,
claude-opus-5, grok-4.6, grok-build-0.1, muse-spark-1.3-contributor,
muse-wonder-1.0, grok-imagine-image-2.0, grok-imagine-image-quality,
grok-imagine-video-1.5, and grok-imagine-video-1.5-lite.

OpenAI prices use the short-context tier (up to 272K input tokens); higher
long-context rates are not modelled. GPT-5.6 Sol uses OpenAI's promotional
price, at least through 2026-11-21. Haiku 5.5 prompts above 100K tokens
and Grok Build prompts at or above 200K tokens have higher rates not modelled here.

Retired on first-party APIs (ids still resolve for pricing/detection): claude-opus-4-1, claude-opus-4, claude-sonnet-4, claude-3-5-haiku/claude-3-*; xAI no longer lists grok-4-1-fast-*, grok-code-fast-1, grok-3*, grok-4-0709.

```ts
await genText("Hello", { model: "fast" });
await genText("Hello", { model: "balanced" });
await genText("Hello", { model: "best" });
await genText("Hello", { model: "cheap" });
await genText("Hello", { model: "fast", provider: "anthropic" });
```

Unified options map to provider request fields where supported:

```ts
await genText("Explain CRDTs", {
  model: "gpt-6.1-sol",
  reasoning: "high",
  creativity: "balanced",
  maxTokens: 1000,
  topP: 0.9,
  stop: ["END"],
});
```

Provider-specific request fields can still be passed through `extra` for chat
requests or `requestOptions` for media/helper requests.

## One-Shot Calls

```ts
import { genData, genStream, genText, Schema } from "chatoyant";

const text = await genText("What is 2+2?", {
  model: "gpt-4o",
  system: "Return short answers.",
});

class Person extends Schema {
  name = Schema.String({ description: "Person name" });
  age = Schema.Integer({ minimum: 0 });
}

const person = await genData("Extract: Alice is 30 years old", Person);

for await (const chunk of genStream("Write a haiku about typed APIs.")) {
  process.stdout.write(chunk);
}
```

## Chat Sessions And Tools

```ts
import { Chat, Schema, createTool } from "chatoyant";

const lookup = createTool({
  name: "lookup",
  description: "Lookup data",
  parameters: {
    q: Schema.String({ minLength: 1, description: "Search query" }),
  },
  async execute({ args, ctx }) {
    return { found: args.q, model: ctx.model, provider: ctx.provider };
  },
});

const chat = new Chat({ model: "gpt-4o" });
chat.system("Use tools when useful.");
chat.user("Find needle.");
chat.addTool(lookup);

const result = await chat.generateWithResult({ maxIterations: 4 });
console.log(result.content);
console.log(chat.lastResult?.usage.totalTokens);
console.log(chat.toJSON());
```

`Chat` supports fluent message mutation, tool registration, `generate`,
`generateWithResult`, `stream`, `streamAccumulate`, `generateData`, JSON
roundtrip, clone, and fork.

## Provider Namespaces

Provider helpers are available both as direct exports and through namespaces:

```ts
import {
  Anthropic,
  Local,
  OpenAI,
  OpenRouter,
  Providers,
  XAI,
  createOpenAIClient,
} from "chatoyant";

const direct = createOpenAIClient({ model: "gpt-4o" });
const namespaced = OpenAI.create({ model: "gpt-4o" });
const aggregate = Providers.OpenRouter.create({ model: "openai/gpt-4o" });

const models = await OpenAI.listModelIds();
const claude = await Anthropic.messageSimple([{ role: "user", content: "Hello" }]);
const grok = await XAI.chatWithWebSearch([{ role: "user", content: "Recent news?" }]);
const routed = await OpenRouter.chatSimple([{ role: "user", content: "Hello" }], {
  model: "anthropic/claude-sonnet-5",
});
const local = await Local.chatSimple([{ role: "user", content: "Hello" }], {
  model: "llama3.2:3b",
  localBaseUrl: "http://127.0.0.1:11434/v1",
});
```

The raw provider clients remain available for explicit provider work while the
unified `Chat` and shortcut functions stay provider-neutral.

## Local Models

Chatoyant supports OpenAI-compatible local servers such as Ollama, LM Studio,
llama.cpp, vLLM, LocalAI, and other `/v1/chat/completions` implementations.

```bash
export LOCAL_BASE_URL=http://127.0.0.1:11434/v1
export LOCAL_API_KEY=local
```

```ts
import { Chat, genStream, genText } from "chatoyant";

const text = await genText("Write a haiku about local inference.", {
  model: "llama3.2:3b",
  provider: "local",
});

for await (const chunk of genStream("Count from 1 to 5.", {
  model: "Qwen3.5-4B-MLX-4bit",
  localBaseUrl: "http://127.0.0.1:8765/v1",
  localApiKey: "local",
  localTimeout: 120_000,
})) {
  process.stdout.write(chunk);
}

const chat = new Chat({
  model: "my-fine-tune",
  provider: "local",
  localBaseUrl: "http://127.0.0.1:11434/v1",
});
```

Local inference is treated as unmetered by design.

## xAI Media

xAI media helpers are exposed through `XAI` and `createXAIClient`.

```ts
import { XAI, createXAIClient } from "chatoyant";

const imageUrl = await XAI.generateImageUrl("A futuristic city at sunset", {
  model: "grok-imagine-image",
  aspectRatio: "16:9",
  resolution: "2k",
});

const client = createXAIClient();

const editedUrl = await client.editImageUrl(
  "https://example.com/photo.png",
  "Render this as a pencil sketch",
);

await client.editMultipleImages(
  ["https://example.com/subject.png", "https://example.com/scene.png"],
  "Place the subject into the scene",
);

const job = (await XAI.startVideoGeneration("A timelapse of a flower blooming", {
  duration: 10,
  aspectRatio: "16:9",
  resolution: "720p",
})) as { id?: string; requestId?: string };

const status = await XAI.getVideoStatus(String(job.id ?? job.requestId));
const url = await XAI.generateVideoUrl("Ocean waves at sunrise", {
  duration: 5,
});
```

`generateVideo`, `generateVideoUrl`, and `generateVideoFromImage` poll status
automatically by default. Use `startVideoGeneration` plus `getVideoStatus` when
you want to manage a long-running job yourself.

Media cost helpers live in the root token surface:

```ts
import { calculateImageCost, calculateVideoCost } from "chatoyant";

calculateImageCost({ model: "grok-imagine-image", count: 4 });
calculateVideoCost({ model: "grok-imagine-video", durationSeconds: 10 });
```

## Schema And Tokens

```ts
import {
  JsonSchema,
  Schema,
  Tokens,
  estimateChatTokens,
  estimateTokens,
  fitMessages,
  splitText,
} from "chatoyant";

class User extends Schema {
  name = Schema.String({ minLength: 1 });
  age = Schema.Integer({ minimum: 0 });
  email = Schema.String({ format: "email", optional: true });
  roles = Schema.Array(Schema.Enum(["admin", "user", "guest"]));
}

const user = Schema.parse(User, {
  name: "Alice",
  age: 30,
  roles: ["admin"],
});

const schema = Schema.toJSON(User);
const valid = JsonSchema.validate(schema, user).valid;

const tokens = estimateTokens("hello world");
const chatTokens = estimateChatTokens([
  { role: "system", content: "Be concise." },
  { role: "user", content: "Hello." },
]);

const chunks = splitText(longDocument, { maxTokens: 512, overlap: 50 });
const fitted = fitMessages(messages, {
  maxTokens: 4000,
  reserveForResponse: 1000,
});

const cost = Tokens.calculateCost({
  model: "gpt-4o",
  inputTokens: 1000,
  outputTokens: 500,
});
```

Schema descriptors include `String`, `Number`, `Integer`, `Boolean`, `Null`,
`Array`, `Object`, `Enum`, and `Literal`.

## CommonJS

```js
const { Chat, OpenAI, genText } = require("chatoyant");

async function main() {
  const text = await genText("Hello", { model: "gpt-4o" });
  console.log(text);
}

main();
```

CommonJS consumers receive `dist/index.cjs` and `dist/index.d.cts`; ESM
consumers receive `dist/index.js` and `dist/index.d.ts`.

## Published Artifact

`npm run pack:dry-run` should produce a small package containing:

- `package.json`
- `README.md`
- `OCAML.md`
- `JAVASCRIPT.md`
- `LICENSE`
- `dist/index.js`
- `dist/index.cjs`
- `dist/index.d.ts`
- `dist/index.d.cts`

The package has no runtime npm dependencies. Build dependencies live only in
the source tree.
