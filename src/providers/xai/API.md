# xAI Grok API Reference

> **Base URL:** `https://api.x.ai/v1`
>
> **Authentication:** `Authorization: Bearer $API_KEY_XAI`
>
> **Compatibility:** OpenAI SDK compatible
>
> **Official Documentation:** https://docs.x.ai/docs/api-reference

---

## Table of Contents

1. [Chat Completions](#1-chat-completions)
2. [Image Generation](#2-image-generation)
3. [Embeddings](#3-embeddings)
4. [Models](#4-models)
5. [Files](#5-files)
6. [Raw Sampling](#6-raw-sampling)

---

## OpenAI Compatibility

The xAI API is designed to be fully compatible with OpenAI's API. You can use OpenAI SDKs by:

1. Changing the base URL to `https://api.x.ai/v1`
2. Using your xAI API key
3. Using Grok model names

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.API_KEY_XAI,
  baseURL: 'https://api.x.ai/v1',
});
```

---

## 1. Chat Completions

Creates a model response for a chat conversation. Primary endpoint for text generation.

### Endpoint

```
POST /chat/completions
```

**Documentation:** https://docs.x.ai/docs/api-reference#chat-completions

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | ✅ | Model ID (e.g., `grok-4`, `grok-3`, `grok-2-1212`) |
| `messages` | array | ✅ | Array of message objects |
| `temperature` | number | ❌ | Sampling temperature (0-2). Default: 1 |
| `top_p` | number | ❌ | Nucleus sampling threshold. Default: 1 |
| `n` | integer | ❌ | Number of completions. Default: 1 |
| `stream` | boolean | ❌ | Enable SSE streaming. Default: false |
| `stop` | string/array | ❌ | Stop sequences (up to 4) |
| `max_tokens` | integer | ❌ | Maximum tokens to generate |
| `presence_penalty` | number | ❌ | Presence penalty (-2.0 to 2.0). Default: 0 |
| `frequency_penalty` | number | ❌ | Frequency penalty (-2.0 to 2.0). Default: 0 |
| `logit_bias` | object | ❌ | Token bias adjustments |
| `logprobs` | boolean | ❌ | Return log probabilities. Default: false |
| `top_logprobs` | integer | ❌ | Top logprobs per token (0-20) |
| `user` | string | ❌ | End-user identifier |
| `seed` | integer | ❌ | Deterministic sampling seed |
| `tools` | array | ❌ | Available tools/functions |
| `tool_choice` | string/object | ❌ | Tool selection: `none`, `auto`, `required`, or specific |
| `parallel_tool_calls` | boolean | ❌ | Allow parallel tool calls. Default: true |
| `response_format` | object | ❌ | Output format configuration |
| `reasoning_effort` | string | ❌ | For reasoning models: `low`, `medium`, `high` |

### Message Object

```typescript
interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

// Multimodal content (vision models)
interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;        // URL or base64 data URI
    detail?: 'auto' | 'low' | 'high';
  };
}
```

### Tools / Function Calling

```typescript
interface Tool {
  type: 'function' | 'web_search';
  function?: {
    name: string;
    description?: string;
    parameters?: object;  // JSON Schema
    strict?: boolean;
  };
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;  // JSON string
  };
}
```

### Web Search Tool

xAI supports built-in web search:

```typescript
{
  type: 'web_search'
}
```

When enabled, Grok can search the web for current information.

### Response Format

```typescript
// Plain text (default)
{ type: 'text' }

// JSON mode
{ type: 'json_object' }

// Structured outputs with JSON Schema
{
  type: 'json_schema',
  json_schema: {
    name: string;
    description?: string;
    schema: object;
    strict?: boolean;
  }
}
```

### Response Object

```typescript
interface ChatCompletion {
  id: string;                        // e.g., "chatcmpl-abc123"
  object: 'chat.completion';
  created: number;                   // Unix timestamp
  model: string;
  system_fingerprint?: string;
  choices: Choice[];
  usage: Usage;
}

interface Choice {
  index: number;
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: ToolCall[];
    refusal?: string | null;
  };
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  logprobs?: Logprobs | null;
}

interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
}
```

### Streaming Response

When `stream: true`, responses are Server-Sent Events (SSE):

```
data: {"id":"chatcmpl-123","object":"chat.completion.chunk",...}
data: {"id":"chatcmpl-123","object":"chat.completion.chunk",...}
data: [DONE]
```

```typescript
interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  system_fingerprint?: string;
  choices: ChunkChoice[];
  usage?: Usage;  // Only in final chunk with stream_options.include_usage
}

interface ChunkChoice {
  index: number;
  delta: {
    role?: 'assistant';
    content?: string;
    tool_calls?: ToolCallDelta[];
  };
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  logprobs?: Logprobs | null;
}
```

### Example Request

```bash
curl https://api.x.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY_XAI" \
  -d '{
    "model": "grok-3",
    "messages": [
      {"role": "system", "content": "You are Grok, a helpful AI assistant."},
      {"role": "user", "content": "What is the meaning of life?"}
    ],
    "temperature": 0.7,
    "max_tokens": 1000
  }'
```

### Example Response

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1703123456,
  "model": "grok-3",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "42. But seriously, the meaning of life is whatever you make of it..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 150,
    "total_tokens": 175
  }
}
```

---

## 2. Image Generation

Generate images from text prompts using Grok's image models.

### Endpoint

```
POST /images/generations
```

**Documentation:** https://docs.x.ai/docs/api-reference#image-generation

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | ❌ | Model ID (e.g., `grok-2-image-1212`). Default: latest |
| `prompt` | string | ✅ | Description of the image to generate |
| `n` | integer | ❌ | Number of images (1-10). Default: 1 |
| `size` | string | ❌ | Image size. Default: `1024x1024` |
| `quality` | string | ❌ | `standard` or `hd`. Default: `standard` |
| `style` | string | ❌ | `vivid` or `natural`. Default: `vivid` |
| `response_format` | string | ❌ | `url` or `b64_json`. Default: `url` |
| `user` | string | ❌ | End-user identifier |

### Response Object

```typescript
interface ImageResponse {
  created: number;
  data: ImageData[];
}

interface ImageData {
  url?: string;           // If response_format is 'url'
  b64_json?: string;      // If response_format is 'b64_json'
  revised_prompt?: string;
}
```

### Example Request

```bash
curl https://api.x.ai/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY_XAI" \
  -d '{
    "model": "grok-2-image-1212",
    "prompt": "A futuristic cityscape at sunset with flying cars",
    "n": 1,
    "size": "1024x1024"
  }'
```

---

## 3. Embeddings

Generate vector embeddings for text input.

### Endpoint

```
POST /embeddings
```

**Documentation:** https://docs.x.ai/docs/api-reference#embeddings

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | ✅ | Embedding model ID |
| `input` | string/array | ✅ | Text(s) to embed |
| `encoding_format` | string | ❌ | `float` or `base64`. Default: `float` |
| `dimensions` | integer | ❌ | Output dimensions (model-specific) |
| `user` | string | ❌ | End-user identifier |

### Response Object

```typescript
interface EmbeddingResponse {
  object: 'list';
  data: Embedding[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

interface Embedding {
  object: 'embedding';
  index: number;
  embedding: number[];
}
```

---

## 4. Models

List and retrieve available models.

### 4.1 List All Models

```
GET /models
```

Returns all available models with minimal information.

### Response

```typescript
interface ModelsResponse {
  object: 'list';
  data: Model[];
}

interface Model {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}
```

### 4.2 Get Model Details

```
GET /models/{model_id}
```

Returns detailed information about a specific model.

### 4.3 List Language Models

```
GET /language-models
```

Returns detailed information about available language models.

### Response

```typescript
interface LanguageModelsResponse {
  models: LanguageModel[];
}

interface LanguageModel {
  id: string;
  fingerprint: string;
  aliases: string[];           // Alternative names
  context_length: number;      // Max context window
  input_modalities: string[];  // e.g., ["text", "image"]
  output_modalities: string[]; // e.g., ["text"]
  pricing: {
    input: number;             // $ per million tokens
    output: number;            // $ per million tokens
  };
}
```

### 4.4 Get Language Model

```
GET /language-models/{model_id}
```

### 4.5 List Image Generation Models

```
GET /image-generation-models
```

### 4.6 Get Image Generation Model

```
GET /image-generation-models/{model_id}
```

---

## 5. Files

Upload and manage files for use in conversations.

### 5.1 Upload File

```
POST /files
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | file | ✅ | File to upload |
| `purpose` | string | ✅ | Purpose of file |

### 5.2 List Files

```
GET /files
```

### 5.3 Get File

```
GET /files/{file_id}
```

### 5.4 Delete File

```
DELETE /files/{file_id}
```

### 5.5 Update File

```
PATCH /files/{file_id}
```

### 5.6 Download File

```
GET /files/{file_id}/content
```

### 5.7 Chunked Upload

For large files:

```
POST /files/upload/initialize
POST /files/upload/chunk
```

### Response Object

```typescript
interface FileObject {
  id: string;
  object: 'file';
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
}
```

---

## 6. Raw Sampling

Direct access to model sampling for advanced use cases.

### Endpoint

```
POST /sample
```

**Documentation:** https://docs.x.ai/docs/api-reference#raw-sampling

Low-level sampling endpoint for advanced users requiring direct model access.

---

## Available Models

### Language Models

| Model | Context | Input Price | Output Price | Capabilities |
|-------|---------|-------------|--------------|--------------|
| `grok-4-1-fast-reasoning` | 2M | $0.20/M | $0.50/M | Reasoning, coding, vision |
| `grok-4-1-fast-non-reasoning` | 2M | $0.20/M | $0.50/M | Tool calling, agentic |
| `grok-4-fast-reasoning` | 2M | $0.20/M | $0.50/M | Cost-efficient reasoning |
| `grok-4-fast-non-reasoning` | 2M | $0.20/M | $0.50/M | Cost-efficient |
| `grok-code-fast-1` | 256K | $0.20/M | $1.50/M | Agentic coding |
| `grok-4` | 256K | $3.00/M | $15.00/M | Flagship model |
| `grok-4-0709` | 256K | $3.00/M | $15.00/M | Flagship (dated) |
| `grok-3` | 131K | $3.00/M | $15.00/M | Previous flagship |
| `grok-3-mini` | 131K | $0.30/M | $0.50/M | Fast, efficient |
| `grok-2-vision-1212` | 32K | $2.00/M | $10.00/M | Vision capable |

### Image Generation Models

| Model | Output Price | Capabilities |
|-------|--------------|--------------|
| `grok-2-image-1212` | $0.07/image | Text-to-image |

### Model Aliases

Models can be referenced by aliases:
- `grok-4` → latest grok-4 version
- `grok-3` → latest grok-3 version
- `grok-beta` → current beta model

---

## Vision (Image Input)

Grok vision models support image inputs:

```typescript
{
  role: "user",
  content: [
    {
      type: "text",
      text: "What's in this image?"
    },
    {
      type: "image_url",
      image_url: {
        url: "https://example.com/image.jpg",
        detail: "high"
      }
    }
  ]
}
```

### Supported Models
- `grok-2-vision-1212`
- `grok-4-1-fast-reasoning` (multimodal)

### Limits
- Max 20 images per request
- Max 20MB per image
- Supported formats: JPEG, PNG, GIF, WebP

---

## Error Handling

Errors follow OpenAI's format:

```typescript
interface APIError {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}
```

### Error Types

| Type | Description |
|------|-------------|
| `invalid_request_error` | Invalid parameters |
| `authentication_error` | Invalid API key |
| `permission_error` | Insufficient permissions |
| `not_found_error` | Resource not found |
| `rate_limit_error` | Rate limit exceeded |
| `server_error` | Server error |

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Rate Limited |
| 500 | Server Error |
| 503 | Service Unavailable |

---

## Rate Limits

Rate limits vary by model and tier. Check response headers:

- `x-ratelimit-limit-requests`
- `x-ratelimit-limit-tokens`
- `x-ratelimit-remaining-requests`
- `x-ratelimit-remaining-tokens`
- `x-ratelimit-reset-requests`
- `x-ratelimit-reset-tokens`

---

## Streaming Implementation

### SSE Format

Same as OpenAI:

```
data: {"id":"chatcmpl-123",...}\n\n
data: {"id":"chatcmpl-123",...}\n\n
data: [DONE]\n\n
```

### TypeScript Parsing

```typescript
async function* parseSSE(response: Response) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        yield JSON.parse(data);
      }
    }
  }
}
```

---

## Key Differences from OpenAI

| Feature | OpenAI | xAI |
|---------|--------|-----|
| Base URL | `api.openai.com/v1` | `api.x.ai/v1` |
| Models | GPT series | Grok series |
| Web search | Requires Responses API | Built-in tool |
| Reasoning | o1/o3 series | `-reasoning` suffix models |
| Vision | Most models | Specific vision models |
| Max context | 128K-200K | Up to 2M tokens |

---

## Model Selection Guide

| Use Case | Recommended Model |
|----------|-------------------|
| General chat | `grok-3` or `grok-3-mini` |
| Complex reasoning | `grok-4-1-fast-reasoning` |
| Tool/function calling | `grok-4-1-fast-non-reasoning` |
| Coding tasks | `grok-code-fast-1` |
| Image understanding | `grok-2-vision-1212` |
| Image generation | `grok-2-image-1212` |
| Cost-sensitive | `grok-3-mini` |
| Highest quality | `grok-4` |

---

## Pricing Reference

See: https://x.ai/api/

Token pricing varies by model. Usage is tracked via the `usage` field.

**Note:** xAI offers competitive pricing, especially for the "fast" model variants which provide significant cost savings while maintaining high quality.

---

*Last updated: December 2024*

