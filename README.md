# Chatoyant ✨

[![npm version](https://img.shields.io/npm/v/chatoyant.svg?style=flat-square)](https://www.npmjs.com/package/chatoyant)
[![CI](https://img.shields.io/github/actions/workflow/status/Anonyfox/chatoyant/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/Anonyfox/chatoyant/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)

<div align="center">
  <img src="https://raw.githubusercontent.com/Anonyfox/chatoyant/main/assets/chatoyant-logo.png" alt="Chatoyant Logo" width="400" />
</div>

Unified TypeScript SDK for LLM providers (OpenAI, Anthropic, xAI) with streaming, structured outputs, and zero dependencies.

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

The unified API works across OpenAI, Anthropic, and xAI. Set your API key via environment variable (`API_KEY_OPENAI`, `API_KEY_ANTHROPIC`, or `API_KEY_XAI`). The provider is auto-detected from the model name, or defaults to OpenAI when using presets.

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
import { Chat, Tool, Schema } from "chatoyant";

// Define a tool
class WeatherParams extends Schema {
  city = Schema.String({ description: "City name" });
}

class WeatherTool extends Tool {
  name = "get_weather";
  description = "Get current weather for a city";
  parameters = new WeatherParams();

  async execute({ city }) {
    return { temperature: 22, conditions: "sunny" }; // Your API call here
  }
}

// Create chat with tool
const chat = new Chat({ model: "gpt-4o" });
chat.system("You are a helpful assistant with weather access.");
chat.addTool(new WeatherTool());

// Multi-turn conversation — tools are called automatically
const reply = await chat.user("What's the weather in Tokyo?").generate();
console.log(reply); // "The weather in Tokyo is 22°C and sunny!"

// Continue the conversation
const followUp = await chat.user("How about Paris?").generate();

// Get rich metadata
const result = await chat.user("And London?").generateWithResult();
console.log(result.usage); // { inputTokens, outputTokens, reasoningTokens, ... }
console.log(result.timing); // { latencyMs }
console.log(result.cost); // { estimatedUsd }

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
