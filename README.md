# Chatoyant ✨

[![npm version](https://img.shields.io/npm/v/chatoyant.svg?style=flat-square)](https://www.npmjs.com/package/chatoyant)
[![CI](https://img.shields.io/github/actions/workflow/status/Anonyfox/chatoyant/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/Anonyfox/chatoyant/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**Typesafe LLM provider clients for TypeScript.** Native `fetch`, streaming, structured outputs, zero dependencies.

> _chatoyant_ /ʃəˈtɔɪənt/ — having a changeable lustre, like a cat's eye in the dark

---

## Installation

```bash
npm install chatoyant
```

Tree-shakable submodules — import only what you need:

```typescript
import { createOpenAIClient } from "chatoyant/providers/openai";
import { createAnthropicClient } from "chatoyant/providers/anthropic";
import { createXAIClient } from "chatoyant/providers/xai";
import { Schema } from "chatoyant/schema";
```

---

## OpenAI

Full client for GPT models, embeddings, and image generation.

> **API Key:** Set `API_KEY_OPENAI` in your environment.

```typescript
import { createOpenAIClient } from "chatoyant/providers/openai";

const client = createOpenAIClient({
  apiKey: process.env.API_KEY_OPENAI!,
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

> **API Key:** Set `API_KEY_ANTHROPIC` in your environment.

```typescript
import { createAnthropicClient } from "chatoyant/providers/anthropic";

const client = createAnthropicClient({
  apiKey: process.env.API_KEY_ANTHROPIC!,
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

> **API Key:** Set `API_KEY_XAI` in your environment.

```typescript
import { createXAIClient } from "chatoyant/providers/xai";

const client = createXAIClient({
  apiKey: process.env.API_KEY_XAI!,
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

## License

MIT — **[Anonyfox](https://anonyfox.com)**
