# OpenAI API Reference

> **Base URL:** `https://api.openai.com/v1`
>
> **Authentication:** `Authorization: Bearer $API_KEY_OPENAI`
>
> **Official Documentation:** https://platform.openai.com/docs/api-reference

---

## Table of Contents

1. [Chat Completions](#1-chat-completions)
2. [Responses API](#2-responses-api)
3. [Embeddings](#3-embeddings)
4. [Images](#4-images)
5. [Audio](#5-audio)
6. [Moderation](#6-moderation)
7. [Models](#7-models)
8. [Files](#8-files)

---

## 1. Chat Completions

Creates a model response for a chat conversation. This is the primary endpoint for text generation.

### Endpoint

```
POST /chat/completions
```

**Documentation:** https://platform.openai.com/docs/api-reference/chat/create

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | ✅ | Model ID (e.g., `gpt-4o`, `gpt-4o-mini`, `o1`, `o3-mini`) |
| `messages` | array | ✅ | Array of message objects representing the conversation |
| `temperature` | number | ❌ | Sampling temperature (0-2). Lower = more deterministic. Default: 1 |
| `top_p` | number | ❌ | Nucleus sampling. Default: 1 |
| `n` | integer | ❌ | Number of completions to generate. Default: 1 |
| `stream` | boolean | ❌ | Enable SSE streaming. Default: false |
| `stream_options` | object | ❌ | Options for streaming (e.g., `include_usage: true`) |
| `stop` | string/array | ❌ | Up to 4 sequences where the API will stop generating |
| `max_tokens` | integer | ❌ | Maximum tokens to generate (deprecated, use `max_completion_tokens`) |
| `max_completion_tokens` | integer | ❌ | Upper bound on completion tokens |
| `presence_penalty` | number | ❌ | Penalize new tokens based on presence (-2.0 to 2.0). Default: 0 |
| `frequency_penalty` | number | ❌ | Penalize new tokens based on frequency (-2.0 to 2.0). Default: 0 |
| `logit_bias` | object | ❌ | Modify likelihood of specific tokens appearing |
| `logprobs` | boolean | ❌ | Return log probabilities. Default: false |
| `top_logprobs` | integer | ❌ | Number of most likely tokens to return (0-20) |
| `user` | string | ❌ | Unique end-user identifier for abuse monitoring |
| `seed` | integer | ❌ | Deterministic sampling seed (beta) |
| `tools` | array | ❌ | List of tools (functions) the model may call |
| `tool_choice` | string/object | ❌ | Controls tool calling: `none`, `auto`, `required`, or specific tool |
| `parallel_tool_calls` | boolean | ❌ | Allow parallel function calls. Default: true |
| `response_format` | object | ❌ | Output format: `text`, `json_object`, or `json_schema` |
| `modalities` | array | ❌ | Output types: `["text"]` or `["text", "audio"]` |
| `audio` | object | ❌ | Audio output config: `voice`, `format` |
| `reasoning_effort` | string | ❌ | For o1/o3: `low`, `medium`, `high`. Default: `medium` |
| `metadata` | object | ❌ | Developer-defined tags (max 16 keys) |
| `store` | boolean | ❌ | Store output for distillation. Default: false |

### Message Object

```typescript
interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];  // string or array for multimodal
  name?: string;                     // Optional participant name
  tool_calls?: ToolCall[];           // For assistant messages with tool calls
  tool_call_id?: string;             // For tool response messages
}

// For vision/multimodal
interface ContentPart {
  type: 'text' | 'image_url' | 'input_audio';
  text?: string;
  image_url?: {
    url: string;        // URL or base64 data URI
    detail?: 'auto' | 'low' | 'high';
  };
  input_audio?: {
    data: string;       // Base64-encoded audio
    format: 'wav' | 'mp3';
  };
}
```

### Tools / Function Calling

```typescript
interface Tool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: object;  // JSON Schema
    strict?: boolean;     // Enable strict schema adherence
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

### Response Format (Structured Outputs)

```typescript
// Plain text (default)
{ type: 'text' }

// JSON mode (model decides structure)
{ type: 'json_object' }

// Structured outputs with JSON Schema
{
  type: 'json_schema',
  json_schema: {
    name: string;
    description?: string;
    schema: object;     // JSON Schema object
    strict?: boolean;   // Default: false
  }
}
```

### Response Object

```typescript
interface ChatCompletion {
  id: string;                        // e.g., "chatcmpl-abc123"
  object: 'chat.completion';
  created: number;                   // Unix timestamp
  model: string;                     // Model used
  system_fingerprint?: string;       // Backend config fingerprint
  choices: Choice[];
  usage: Usage;
  service_tier?: string;             // e.g., "scale", "default"
}

interface Choice {
  index: number;
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: ToolCall[];
    refusal?: string | null;         // If model refused
    audio?: {                        // For audio output
      id: string;
      expires_at: number;
      data: string;                  // Base64 audio
      transcript: string;
    };
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
    audio_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
    audio_tokens?: number;
    accepted_prediction_tokens?: number;
    rejected_prediction_tokens?: number;
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
  usage?: Usage;  // Only with stream_options.include_usage: true
}

interface ChunkChoice {
  index: number;
  delta: {
    role?: 'assistant';
    content?: string;
    tool_calls?: ToolCallDelta[];
    refusal?: string;
  };
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  logprobs?: Logprobs | null;
}

interface ToolCallDelta {
  index: number;
  id?: string;
  type?: 'function';
  function?: {
    name?: string;
    arguments?: string;  // Streamed incrementally
  };
}
```

### Example Request

```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY_OPENAI" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ],
    "temperature": 0.7,
    "max_completion_tokens": 1000
  }'
```

### Example Response

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1703123456,
  "model": "gpt-4o-2024-08-06",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 9,
    "total_tokens": 29
  },
  "system_fingerprint": "fp_abc123"
}
```

---

## 2. Responses API

The newer Responses API provides enhanced features including built-in tools, background execution, and conversation state management.

### Endpoint

```
POST /responses
```

**Documentation:** https://platform.openai.com/docs/api-reference/responses

### Key Differences from Chat Completions

- Built-in tools: `web_search`, `code_interpreter`, `file_search`
- Background mode for long-running tasks
- Automatic conversation state management
- MCP (Model Context Protocol) connector support

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | ✅ | Model ID |
| `input` | string/array | ✅ | Input text or message array |
| `instructions` | string | ❌ | System instructions |
| `tools` | array | ❌ | Tools including built-in ones |
| `tool_choice` | string/object | ❌ | Tool selection strategy |
| `temperature` | number | ❌ | Sampling temperature |
| `max_output_tokens` | integer | ❌ | Max tokens to generate |
| `truncation` | string | ❌ | How to truncate: `auto`, `disabled` |
| `background` | boolean | ❌ | Run in background mode |
| `metadata` | object | ❌ | Developer-defined tags |
| `store` | boolean | ❌ | Store for distillation |
| `stream` | boolean | ❌ | Enable streaming |

### Built-in Tools

```typescript
// Web search
{ type: 'web_search' }

// Code interpreter
{ type: 'code_interpreter' }

// File search (requires vector store)
{
  type: 'file_search',
  vector_store_ids: string[]
}

// MCP connector
{
  type: 'mcp',
  server_label: string,
  server_url: string,
  allowed_tools?: string[]
}
```

### Response Object

```typescript
interface Response {
  id: string;
  object: 'response';
  created_at: number;
  status: 'completed' | 'in_progress' | 'failed' | 'incomplete';
  model: string;
  output: OutputItem[];
  usage: Usage;
  metadata?: object;
  error?: ResponseError;
}

interface OutputItem {
  type: 'message' | 'tool_call' | 'tool_result';
  // ... varies by type
}
```

---

## 3. Embeddings

Creates vector embeddings for text input.

### Endpoint

```
POST /embeddings
```

**Documentation:** https://platform.openai.com/docs/api-reference/embeddings

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | ✅ | Model ID (e.g., `text-embedding-3-small`, `text-embedding-3-large`) |
| `input` | string/array | ✅ | Text(s) to embed. Max 8191 tokens per input |
| `encoding_format` | string | ❌ | `float` (default) or `base64` |
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
  embedding: number[];  // Vector of floats
}
```

### Example Request

```bash
curl https://api.openai.com/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY_OPENAI" \
  -d '{
    "model": "text-embedding-3-small",
    "input": "The quick brown fox jumps over the lazy dog",
    "dimensions": 512
  }'
```

---

## 4. Images

Generate, edit, and create variations of images.

### 4.1 Create Image

```
POST /images/generations
```

**Documentation:** https://platform.openai.com/docs/api-reference/images/create

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | ❌ | `gpt-image-1` or `dall-e-3`. Default: `gpt-image-1` |
| `prompt` | string | ✅ | Description of image (max 32000 chars for gpt-image-1) |
| `n` | integer | ❌ | Number of images (1-10). Default: 1 |
| `size` | string | ❌ | `1024x1024`, `1024x1792`, `1792x1024`, `auto` |
| `quality` | string | ❌ | `low`, `medium`, `high`, `auto`. Default: `auto` |
| `style` | string | ❌ | `vivid` or `natural`. Default: `vivid` |
| `output_format` | string | ❌ | `url`, `b64_json`, `webp`, `png`, `jpeg` |
| `background` | string | ❌ | `transparent`, `opaque`, `auto` |
| `user` | string | ❌ | End-user identifier |

### 4.2 Edit Image

```
POST /images/edits
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image` | file | ✅ | Original image (PNG, max 25MB) |
| `prompt` | string | ✅ | Description of edit |
| `mask` | file | ❌ | Mask indicating areas to edit |
| `model` | string | ❌ | Model to use |
| `n` | integer | ❌ | Number of images |
| `size` | string | ❌ | Output size |

### 4.3 Create Variation

```
POST /images/variations
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image` | file | ✅ | Original image (PNG, max 4MB) |
| `n` | integer | ❌ | Number of variations |
| `size` | string | ❌ | Output size |

### Response Object

```typescript
interface ImageResponse {
  created: number;
  data: ImageData[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

interface ImageData {
  url?: string;           // If output_format is 'url'
  b64_json?: string;      // If output_format is 'b64_json'
  revised_prompt?: string; // Revised prompt (DALL-E 3)
}
```

---

## 5. Audio

### 5.1 Create Speech (TTS)

```
POST /audio/speech
```

**Documentation:** https://platform.openai.com/docs/api-reference/audio/createSpeech

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | ✅ | `tts-1`, `tts-1-hd`, `gpt-4o-mini-tts` |
| `input` | string | ✅ | Text to synthesize (max 4096 chars) |
| `voice` | string | ✅ | `alloy`, `ash`, `ballad`, `coral`, `echo`, `fable`, `nova`, `onyx`, `sage`, `shimmer`, `verse` |
| `response_format` | string | ❌ | `mp3`, `opus`, `aac`, `flac`, `wav`, `pcm`. Default: `mp3` |
| `speed` | number | ❌ | Speed (0.25-4.0). Default: 1.0 |
| `instructions` | string | ❌ | Voice style instructions (gpt-4o-mini-tts only) |

**Response:** Audio file in specified format (streamed)

### 5.2 Create Transcription (STT)

```
POST /audio/transcriptions
```

**Documentation:** https://platform.openai.com/docs/api-reference/audio/createTranscription

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | file | ✅ | Audio file (mp3, mp4, mpeg, mpga, m4a, wav, webm, max 25MB) |
| `model` | string | ✅ | `whisper-1`, `gpt-4o-transcribe`, `gpt-4o-mini-transcribe` |
| `language` | string | ❌ | ISO-639-1 language code |
| `prompt` | string | ❌ | Guide model's style or continue previous audio |
| `response_format` | string | ❌ | `json`, `text`, `srt`, `verbose_json`, `vtt`. Default: `json` |
| `temperature` | number | ❌ | Sampling temperature (0-1). Default: 0 |
| `timestamp_granularities` | array | ❌ | `word`, `segment` (verbose_json only) |
| `include` | array | ❌ | Include: `logprobs` |

### Response Object

```typescript
interface Transcription {
  text: string;
  task?: string;
  language?: string;
  duration?: number;
  words?: Word[];
  segments?: Segment[];
}

interface Word {
  word: string;
  start: number;
  end: number;
}
```

### 5.3 Create Translation

```
POST /audio/translations
```

Translates audio to English text.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | file | ✅ | Audio file (max 25MB) |
| `model` | string | ✅ | `whisper-1` |
| `prompt` | string | ❌ | Guide model's style |
| `response_format` | string | ❌ | Output format |
| `temperature` | number | ❌ | Sampling temperature |

---

## 6. Moderation

Checks if text violates OpenAI's content policy.

### Endpoint

```
POST /moderations
```

**Documentation:** https://platform.openai.com/docs/api-reference/moderations

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input` | string/array | ✅ | Text(s) to classify |
| `model` | string | ❌ | `omni-moderation-latest`, `text-moderation-latest` |

### Response Object

```typescript
interface ModerationResponse {
  id: string;
  model: string;
  results: ModerationResult[];
}

interface ModerationResult {
  flagged: boolean;
  categories: {
    hate: boolean;
    'hate/threatening': boolean;
    harassment: boolean;
    'harassment/threatening': boolean;
    'self-harm': boolean;
    'self-harm/intent': boolean;
    'self-harm/instructions': boolean;
    sexual: boolean;
    'sexual/minors': boolean;
    violence: boolean;
    'violence/graphic': boolean;
    illicit: boolean;
    'illicit/violent': boolean;
  };
  category_scores: {
    [category: string]: number;  // 0.0 - 1.0
  };
  category_applied_input_types: {
    [category: string]: string[];  // 'text', 'image'
  };
}
```

---

## 7. Models

List and retrieve available models.

### 7.1 List Models

```
GET /models
```

**Documentation:** https://platform.openai.com/docs/api-reference/models/list

### Response Object

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

### 7.2 Retrieve Model

```
GET /models/{model}
```

Returns details for a specific model.

### 7.3 Delete Fine-tuned Model

```
DELETE /models/{model}
```

Deletes a fine-tuned model (owner only).

---

## 8. Files

Manage files for fine-tuning, assistants, and other features.

### 8.1 Upload File

```
POST /files
```

**Documentation:** https://platform.openai.com/docs/api-reference/files/create

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | file | ✅ | File to upload (max 512MB for Assistants) |
| `purpose` | string | ✅ | `assistants`, `batch`, `fine-tune`, `vision`, `user_data` |

### 8.2 List Files

```
GET /files
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `purpose` | string | ❌ | Filter by purpose |
| `limit` | integer | ❌ | Max results (1-10000). Default: 10000 |
| `order` | string | ❌ | `asc` or `desc`. Default: `desc` |
| `after` | string | ❌ | Cursor for pagination |

### 8.3 Retrieve File

```
GET /files/{file_id}
```

### 8.4 Delete File

```
DELETE /files/{file_id}
```

### 8.5 Retrieve File Content

```
GET /files/{file_id}/content
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
  status: 'uploaded' | 'processed' | 'error';
  status_details?: string;
}
```

---

## Error Handling

All endpoints return errors in a consistent format:

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

### Common Error Types

| Type | Description |
|------|-------------|
| `invalid_request_error` | Invalid parameters or format |
| `authentication_error` | Invalid or missing API key |
| `permission_error` | Insufficient permissions |
| `not_found_error` | Resource not found |
| `rate_limit_error` | Rate limit exceeded |
| `server_error` | OpenAI server error |
| `engine_overloaded_error` | Server is overloaded |

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

Rate limits vary by:
- Model tier (free, tier 1-5)
- Model type
- Endpoint

Check `x-ratelimit-*` response headers:
- `x-ratelimit-limit-requests`
- `x-ratelimit-limit-tokens`
- `x-ratelimit-remaining-requests`
- `x-ratelimit-remaining-tokens`
- `x-ratelimit-reset-requests`
- `x-ratelimit-reset-tokens`

---

## Streaming Implementation Notes

### SSE Format

```
data: {"id":"chatcmpl-123",...}\n\n
data: {"id":"chatcmpl-123",...}\n\n
data: [DONE]\n\n
```

### Getting Usage in Streams

Set `stream_options.include_usage: true` to receive usage in the final chunk.

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

## Token Counting

OpenAI uses the `tiktoken` library for tokenization:

- **cl100k_base**: GPT-4, GPT-3.5-turbo, text-embedding-ada-002
- **o200k_base**: GPT-4o, o1, o3

Approximate: 1 token ≈ 4 characters in English

### Token Limits by Model

| Model | Context Window | Max Output |
|-------|---------------|------------|
| gpt-4o | 128,000 | 16,384 |
| gpt-4o-mini | 128,000 | 16,384 |
| gpt-4-turbo | 128,000 | 4,096 |
| gpt-3.5-turbo | 16,385 | 4,096 |
| o1 | 200,000 | 100,000 |
| o3-mini | 200,000 | 100,000 |

---

## Pricing Reference

See: https://openai.com/pricing

Token pricing varies by model. Usage is tracked via the `usage` field in responses.

---

*Last updated: December 2024*

