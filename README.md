# Chatoyant ✨

[![npm version](https://img.shields.io/npm/v/chatoyant.svg?style=flat-square)](https://www.npmjs.com/package/chatoyant)
[![CI](https://img.shields.io/github/actions/workflow/status/Anonyfox/chatoyant/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/Anonyfox/chatoyant/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)

<div align="center">
  <img src="https://raw.githubusercontent.com/Anonyfox/chatoyant/main/assets/chatoyant-logo.png" alt="Chatoyant Logo" width="400" />
</div>

Unified TypeScript SDK for LLM providers (OpenAI, Anthropic, xAI, OpenRouter, and any local OpenAI-compatible server) with streaming, structured outputs, and zero dependencies.

> _chatoyant_ /ʃəˈtɔɪənt/ — having a changeable lustre, like a cat's eye in the dark

---

## Installation

```bash
npm install chatoyant
```

Tree-shakable submodules — import only what you need:

```typescript
import { genText, Chat, Tool } from "chatoyant/core";
import { createOpenAIClient } from "chatoyant/providers/openai";
import { Schema } from "chatoyant/schema";
import * as tokens from "chatoyant/tokens";
```

---

## Quick Start

The unified API works across OpenAI, Anthropic, xAI, OpenRouter, and local models. Provider is auto-detected from the model name — no config needed beyond setting the right API key. Defaults to OpenAI when using presets.

| Provider | Env var | Detection |
|---|---|---|
| OpenAI | `OPENAI_API_KEY` | `gpt-*`, `o1-*`, `o3-*`, `chatgpt-*` |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-*` |
| xAI | `XAI_API_KEY` | `grok-*` |
| OpenRouter | `OPENROUTER_API_KEY` | `org/model` (any slash notation) |
| Local | `LOCAL_BASE_URL` | any other name → fallback |

```typescript
import { genText, genData, genStream, Schema } from "chatoyant";

// One-shot text generation
const answer = await genText("What is 2+2?");

// Structured output with type safety
class Person extends Schema {
  name = Schema.String();
  age = Schema.Integer();
}
const person = await genData("Extract: Alice is 30 years old", Person);
console.log(person.name, person.age); // "Alice" 30

// Streaming
for await (const chunk of genStream("Write a haiku about TypeScript")) {
  process.stdout.write(chunk);
}
```

**Model presets** — use intent, not model names:

```typescript
await genText("Hello", { model: "fast" }); // Fastest response
await genText("Hello", { model: "best" }); // Highest quality
await genText("Hello", { model: "cheap" }); // Lowest cost
await genText("Hello", { model: "balanced" }); // Good tradeoff
```

**Unified options** — same API, any provider:

```typescript
await genText("Explain quantum physics", {
  model: "gpt-5.1", // Provider detected from model name
  reasoning: "high", // 'off' | 'low' | 'medium' | 'high'
  creativity: "balanced", // 'precise' | 'balanced' | 'creative' | 'wild'
  maxTokens: 1000,
});

// Or explicitly choose provider with presets
await genText("Hello", { model: "fast", provider: "anthropic" });
```

---

## Agentic Conversations

Use `Chat` for multi-turn conversations with tools:

```typescript
import { Chat, createTool, Schema } from "chatoyant";

// Define a tool
class WeatherParams extends Schema {
  city = Schema.String({ description: "City name" });
}

const weatherTool = createTool({
  name: "get_weather",
  description: "Get current weather for a city",
  parameters: WeatherParams,
  execute: async ({ args }) => {
    return { temperature: 22, conditions: "sunny" }; // Your API call here
  },
});

// Create chat with tool
const chat = new Chat({ model: "gpt-4o" });
chat.system("You are a helpful assistant with weather access.");
chat.addTool(weatherTool);

// Multi-turn conversation — tools are called automatically
const reply = await chat.user("What's the weather in Tokyo?").generate();
console.log(reply); // "The weather in Tokyo is 22°C and sunny!"

// Usage metadata is always available after generate() or stream()
console.log(chat.lastResult?.usage); // { inputTokens, outputTokens, ... }
console.log(chat.lastResult?.cost); // { estimatedUsd }
console.log(chat.lastResult?.iterations); // 2 (1 tool call + 1 final response)

// Continue the conversation
const followUp = await chat.user("How about Paris?").generate();

// Streaming also populates lastResult after the generator completes
for await (const chunk of chat.user("Tell me more").stream()) {
  process.stdout.write(chunk);
}
console.log(chat.lastResult?.timing); // { latencyMs }

// Serialize for persistence
const json = chat.toJSON();
const restored = Chat.fromJSON(json);
```

---

## Provider Clients

For direct provider access with full control, use the low-level clients below.

---

## OpenAI

Full client for GPT models, embeddings, and image generation.

> **API Key:** Set `OPENAI_API_KEY` in your environment.

```typescript
import { createOpenAIClient } from "chatoyant/providers/openai";

const client = createOpenAIClient({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Chat
const text = await client.chatSimple([{ role: "user", content: "Hello!" }]);

// Stream
for await (const delta of client.streamContent([
  { role: "user", content: "Write a haiku" },
])) {
  process.stdout.write(delta.content);
}

// Structured output
const data = await client.chatStructured<{ name: string; age: number }>(
  [{ role: "user", content: "Extract: Alice is 30" }],
  {
    name: "person",
    schema: {
      type: "object",
      properties: { name: { type: "string" }, age: { type: "number" } },
    },
  }
);
```

---

## Anthropic

Full client for Claude models with streaming and tool use.

> **API Key:** Set `ANTHROPIC_API_KEY` in your environment.

```typescript
import { createAnthropicClient } from "chatoyant/providers/anthropic";

const client = createAnthropicClient({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Chat
const text = await client.messageSimple([{ role: "user", content: "Hello!" }]);

// Stream
for await (const delta of client.streamContent([
  { role: "user", content: "Write a haiku" },
])) {
  process.stdout.write(delta.text);
}
```

---

## xAI (Grok)

Full client for Grok models with native web search.

> **API Key:** Set `XAI_API_KEY` in your environment.

```typescript
import { createXAIClient } from "chatoyant/providers/xai";

const client = createXAIClient({
  apiKey: process.env.XAI_API_KEY!,
});

// Chat
const text = await client.chatSimple([{ role: "user", content: "Hello!" }]);

// Web search (xAI-exclusive)
const response = await client.chatWithWebSearch([
  { role: "user", content: "What happened in the news today?" },
]);

// Reasoning models
const result = await client.chat(
  [{ role: "user", content: "Solve this step by step..." }],
  {
    model: "grok-3-mini",
    reasoningEffort: "high",
  }
);
```

### Image Generation & Editing

xAI provides `grok-imagine-image` for image generation and editing with natural language. Supports aspect ratios, resolution control, and multi-image editing.

```typescript
// Generate an image
const url = await client.generateImageUrl("A futuristic cityscape at sunset", {
  aspectRatio: "16:9",
  resolution: "2k",
});

// Edit an existing image
const edited = await client.editImageUrl(
  "Render this as a pencil sketch with detailed shading",
  "https://example.com/photo.png"
);

// Compose multiple images
const composed = await client.editMultipleImages(
  "Add the cat from the first image to the second one",
  ["https://example.com/cat.jpg", "https://example.com/scene.jpg"]
);
```

### Video Generation

xAI's `grok-imagine-video` supports text-to-video, image-to-video, and video editing. The API is asynchronous — polling is handled automatically.

```typescript
// Text-to-video (waits for completion)
const video = await client.generateVideo("A timelapse of a flower blooming", {
  duration: 10,
  aspectRatio: "16:9",
  resolution: "720p",
});
console.log(video.url, `${video.duration}s`);

// Animate a still image
const animated = await client.generateVideoFromImage(
  "Gentle waves and flowing clouds",
  "https://example.com/landscape.jpg"
);

// Manual polling for long-running jobs
const { requestId } = await client.startVideoGeneration("An epic scene...", {
  duration: 15,
});
// ... poll later:
const status = await client.getVideoStatus(requestId);
if (status.status === "done") console.log(status.video?.url);
```

Cost calculation for media generation is available via `chatoyant/tokens`:

```typescript
import { calculateImageCost, calculateVideoCost } from "chatoyant/tokens";

calculateImageCost({ model: "grok-imagine-image", count: 4 }); // $0.08
calculateVideoCost({ model: "grok-imagine-video", durationSeconds: 10 }); // $0.50
```

---

## OpenRouter

Access hundreds of models (OpenAI, Anthropic, Meta, Mistral, Google, and more) through a single API key. OpenRouter uses `org/model` slash notation — chatoyant auto-detects this and routes to OpenRouter automatically.

> **API Key:** Set `OPENROUTER_API_KEY` in your environment.

```typescript
import { genText, Chat } from "chatoyant";

// Auto-detected: slash notation → OpenRouter
const text = await genText("Hello!", { model: "anthropic/claude-opus-4" });
const text2 = await genText("Hello!", { model: "meta-llama/llama-3.1-8b-instruct" });
const text3 = await genText("Hello!", { model: "google/gemini-pro" });

// Force any model through OpenRouter explicitly
const chat = new Chat({
  model: "gpt-4o",
  defaults: { provider: "openrouter" },
});
```

**Detection rules:**
- `anthropic/claude-opus-4` → OpenRouter *(not the native Anthropic API)*
- `openai/gpt-4o` → OpenRouter *(not the native OpenAI API)*
- `claude-opus-4` *(no slash)* → Anthropic native

**Direct client:**

```typescript
import { createOpenRouterClient } from "chatoyant/providers/openrouter";

const client = createOpenRouterClient({
  apiKey: process.env.OPENROUTER_API_KEY!,
  defaultModel: "anthropic/claude-opus-4",
});

const text = await client.chatSimple([{ role: "user", content: "Hello!" }]);
```

---

## Local Models

Chatoyant supports any server that speaks the OpenAI-compatible chat API — [Ollama](https://ollama.com), [LM Studio](https://lmstudio.ai), [llama.cpp](https://github.com/ggerganov/llama.cpp), [vLLM](https://github.com/vllm-project/vllm), [LocalAI](https://localai.io), and [oMLX](https://omlx.ai) (great for running models natively on Apple Silicon via MLX).

> **Tested:** `Qwen3.5-4B-MLX-4bit` via oMLX — text generation, streaming, and multi-step tool calling all work out of the box.

**Zero config if you set the env var:**

```bash
export LOCAL_BASE_URL=http://127.0.0.1:11434/v1   # Ollama default
export LOCAL_API_KEY=your-key                       # optional, defaults to "local"
```

Any model name that doesn't match a known provider signature (and doesn't contain `/`) is automatically routed to the local server:

```typescript
import { genText, genStream, Chat, createTool, Schema } from "chatoyant";

// Text generation — model name auto-routes to LOCAL_BASE_URL
const text = await genText("Write a haiku about local LLMs.", {
  model: "Qwen3.5-4B-MLX-4bit",
});

// Streaming
for await (const chunk of genStream("Count from 1 to 5.", {
  model: "llama3.2:3b",
})) {
  process.stdout.write(chunk);
}
```

**Inline config** (no env vars needed):

```typescript
const chat = new Chat({
  model: "Qwen3.5-4B-MLX-4bit",
  localBaseUrl: "http://127.0.0.1:8765/v1",
  localApiKey: "my-key",        // optional
  localTimeout: 120_000,        // optional, ms — useful for large models
});
```

**Explicit `provider: 'local'`** (useful when you want to force local even for ambiguous model names):

```typescript
await genText("Hello", { model: "my-fine-tune", provider: "local" });
```

**Multi-step tool calling** works identically to cloud providers:

```typescript
class CalcParams extends Schema {
  operation = Schema.Enum(["add", "subtract", "multiply", "divide"]);
  a = Schema.Number();
  b = Schema.Number();
}

const calc = createTool({
  name: "calculate",
  description: "Perform one arithmetic operation.",
  parameters: CalcParams,
  execute: async ({ args }) => {
    const { operation, a, b } = args;
    return operation === "add" ? a + b
         : operation === "subtract" ? a - b
         : operation === "multiply" ? a * b
         : a / b;
  },
});

const chat = new Chat({ model: "Qwen3.5-4B-MLX-4bit" });
chat.system("Use the calculate tool for every arithmetic step.");
chat.addTool(calc);

const answer = await chat
  .user("What is (6 * 7) - (20 / 4)?")
  .generate({ maxIterations: 8 });
// → "The result is 37."
```

**Direct client** for lower-level access:

```typescript
import { createLocalClient } from "chatoyant/providers/local";

const client = createLocalClient({
  baseUrl: "http://127.0.0.1:11434/v1",
  apiKey: "local",          // optional
  timeout: 120_000,         // optional
});

const models = await client.listModelIds();
const text   = await client.chatSimple([{ role: "user", content: "Hello!" }]);
```

---

## Tokens

Zero-dependency utilities for token estimation, cost calculation, and context management.

```typescript
import {
  estimateTokens,
  estimateChatTokens,
  calculateCost,
  getContextWindow,
  splitText,
  fitMessages,
  PRICING,
  CONTEXT_WINDOWS,
} from "chatoyant/tokens";

// Estimate tokens in text
const tokens = estimateTokens("Hello, world!"); // ~3

// Estimate tokens for a chat conversation
const chatTokens = estimateChatTokens([
  { role: "system", content: "You are helpful." },
  { role: "user", content: "Hello!" },
]);

// Calculate cost for an API call
const cost = calculateCost({
  model: "gpt-4o",
  inputTokens: 1000,
  outputTokens: 500,
});
console.log(`Total: $${cost.total.toFixed(4)}`);

// Get context window for a model
const maxTokens = getContextWindow("claude-3-opus"); // 200000

// Split long text into chunks for embeddings/RAG
const chunks = splitText(longDocument, { maxTokens: 512, overlap: 50 });

// Fit messages into context budget
const fitted = fitMessages(messages, {
  maxTokens: 4000,
  reserveForResponse: 1000,
});
```

---

## Schema

Typesafe JSON Schema builder with two-way casting. Define once, get perfect type inference and runtime validation.

```typescript
import { Schema } from "chatoyant/schema";

class User extends Schema {
  name = Schema.String({ minLength: 1 });
  age = Schema.Integer({ minimum: 0 });
  email = Schema.String({ format: "email", optional: true });
  roles = Schema.Array(Schema.Enum(["admin", "user", "guest"]));
}

// Create with full type inference
const user = Schema.create(User);
user.name = "Alice";
user.age = 30;
user.roles = ["admin"];

// Validate unknown data
const isValid = Schema.validate(user, unknownData);

// Convert to JSON Schema (for LLM structured outputs)
const jsonSchema = Schema.toJSON(user);

// Parse JSON into typed instance
Schema.parse(user, jsonData);
```

**Types:** `String`, `Number`, `Integer`, `Boolean`, `Array`, `Object`, `Enum`, `Literal`, `Nullable`

---

### Support

If this package helps your project, consider sponsoring its maintenance:

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-EA4AAA?style=for-the-badge&logo=github&logoColor=white)](https://github.com/sponsors/Anonyfox)

---

**[Anonyfox](https://anonyfox.com) • [MIT License](LICENSE)**

</div>
