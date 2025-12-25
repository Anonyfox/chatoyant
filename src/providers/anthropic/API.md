# Anthropic Claude API Reference

> **Base URL:** `https://api.anthropic.com/v1`
>
> **Authentication:** `x-api-key: $API_KEY_ANTHROPIC`
>
> **Required Header:** `anthropic-version: 2023-06-01`
>
> **Official Documentation:** https://docs.anthropic.com/en/api

---

## Table of Contents

1. [Messages](#1-messages)
2. [Message Batches](#2-message-batches)
3. [Token Counting](#3-token-counting)
4. [Models](#4-models)
5. [Files](#5-files)

---

## Authentication & Headers

All requests must include:

```
x-api-key: $API_KEY_ANTHROPIC
anthropic-version: 2023-06-01
content-type: application/json
```

### Optional Headers

| Header | Description |
|--------|-------------|
| `anthropic-beta` | Enable beta features (comma-separated) |
| `anthropic-dangerous-direct-browser-access` | For browser-based requests (not recommended) |

### Beta Features

Enable with `anthropic-beta` header:

- `prompt-caching-2024-07-31` - Prompt caching
- `computer-use-2024-10-22` - Computer use tools
- `pdfs-2024-09-25` - PDF file support
- `token-counting-2024-11-01` - Token counting endpoint
- `message-batches-2024-09-24` - Batch processing
- `extended-thinking-2025-05-14` - Extended thinking (Claude 4+)

---

## 1. Messages

Creates a message (chat completion). This is the primary endpoint for interacting with Claude.

### Endpoint

```
POST /messages
```

**Documentation:** https://docs.anthropic.com/en/api/messages

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | ✅ | Model ID (e.g., `claude-sonnet-4-20250514`, `claude-3-5-sonnet-20241022`) |
| `messages` | array | ✅ | Array of message objects (user/assistant turns) |
| `max_tokens` | integer | ✅ | Maximum tokens to generate (model-specific limit) |
| `system` | string/array | ❌ | System prompt (string or content blocks) |
| `temperature` | number | ❌ | Sampling temperature (0-1). Default: 1.0 |
| `top_p` | number | ❌ | Nucleus sampling threshold |
| `top_k` | integer | ❌ | Top-k sampling |
| `stop_sequences` | array | ❌ | Custom stop sequences (up to 8191 chars each) |
| `stream` | boolean | ❌ | Enable SSE streaming. Default: false |
| `tools` | array | ❌ | Available tools for the model to use |
| `tool_choice` | object | ❌ | Tool selection strategy |
| `metadata` | object | ❌ | Request metadata (e.g., `user_id`) |

### Extended Thinking (Claude 4+)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `thinking` | object | ❌ | Extended thinking configuration |
| `thinking.type` | string | ❌ | `enabled` to activate |
| `thinking.budget_tokens` | integer | ❌ | Token budget for thinking (1024-128000) |

### Message Object

```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

// Content block types
type ContentBlock =
  | TextBlock
  | ImageBlock
  | DocumentBlock
  | ToolUseBlock
  | ToolResultBlock;

interface TextBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

interface ImageBlock {
  type: 'image';
  source: {
    type: 'base64' | 'url';
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    data?: string;  // base64 for type: 'base64'
    url?: string;   // URL for type: 'url'
  };
  cache_control?: { type: 'ephemeral' };
}

interface DocumentBlock {
  type: 'document';
  source: {
    type: 'base64' | 'url' | 'text';
    media_type: 'application/pdf' | 'text/plain' | 'text/html' | 'text/csv' | 'text/markdown';
    data?: string;
    url?: string;
    text?: string;
  };
  cache_control?: { type: 'ephemeral' };
  title?: string;
  context?: string;
  citations?: { enabled: boolean };
}
```

### System Prompt

Can be a string or array of content blocks:

```typescript
// Simple string
system: "You are a helpful assistant."

// With cache control
system: [
  {
    type: "text",
    text: "You are a helpful assistant with access to...",
    cache_control: { type: "ephemeral" }
  }
]
```

### Tools / Function Calling

```typescript
interface Tool {
  name: string;                    // Tool name (a-zA-Z0-9_-)
  description?: string;            // When to use this tool
  input_schema: {                  // JSON Schema for input
    type: 'object';
    properties: Record<string, JSONSchema>;
    required?: string[];
  };
  cache_control?: { type: 'ephemeral' };
}

// Built-in tools (require anthropic-beta header)
interface ComputerTool {
  type: 'computer_20241022';
  name: 'computer';
  display_width_px: number;
  display_height_px: number;
  display_number?: number;
}

interface TextEditorTool {
  type: 'text_editor_20250124' | 'text_editor_20250429';
  name: 'str_replace_editor';
}

interface BashTool {
  type: 'bash_20250124';
  name: 'bash';
}

interface WebSearchTool {
  type: 'web_search_20250305';
  name: 'web_search';
  allowed_domains?: string[];
  blocked_domains?: string[];
  max_uses?: number;
  user_location?: {
    type: 'approximate';
    city?: string;
    region?: string;
    country?: string;
    timezone?: string;
  };
}
```

### Tool Choice

```typescript
interface ToolChoice {
  type: 'auto' | 'any' | 'tool' | 'none';
  name?: string;                      // Required when type: 'tool'
  disable_parallel_tool_use?: boolean;
}
```

### Tool Use in Messages

```typescript
// Assistant message with tool use
interface ToolUseBlock {
  type: 'tool_use';
  id: string;           // Tool use ID (e.g., "toolu_abc123")
  name: string;         // Tool name
  input: object;        // Tool input arguments
}

// User message with tool result
interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;  // Matches the tool_use id
  content: string | ContentBlock[];
  is_error?: boolean;
}
```

### Response Object

```typescript
interface MessageResponse {
  id: string;                        // e.g., "msg_abc123"
  type: 'message';
  role: 'assistant';
  content: ContentBlock[];           // Response content blocks
  model: string;                     // Model used
  stop_reason: StopReason;
  stop_sequence?: string | null;     // If stopped by custom sequence
  usage: Usage;
}

type StopReason =
  | 'end_turn'           // Natural completion
  | 'max_tokens'         // Hit token limit
  | 'stop_sequence'      // Hit stop sequence
  | 'tool_use';          // Model wants to use a tool

interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;   // Prompt caching
  cache_read_input_tokens?: number;       // Prompt caching
}
```

### Response Content Blocks

```typescript
type ResponseContentBlock =
  | TextBlock
  | ToolUseBlock
  | ThinkingBlock;

interface TextBlock {
  type: 'text';
  text: string;
  citations?: Citation[];  // If citations enabled
}

interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: object;
}

interface ThinkingBlock {
  type: 'thinking';
  thinking: string;       // Model's reasoning (extended thinking)
  signature: string;      // Verification signature
}
```

### Streaming Response

When `stream: true`, responses are Server-Sent Events (SSE):

```
event: message_start
data: {"type":"message_start","message":{...}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":15}}

event: message_stop
data: {"type":"message_stop"}
```

### Stream Event Types

```typescript
type StreamEvent =
  | MessageStartEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | MessageDeltaEvent
  | MessageStopEvent
  | PingEvent
  | ErrorEvent;

interface MessageStartEvent {
  type: 'message_start';
  message: MessageResponse;  // Partial message (no content yet)
}

interface ContentBlockStartEvent {
  type: 'content_block_start';
  index: number;
  content_block: ContentBlock;  // Initial block (empty text, etc.)
}

interface ContentBlockDeltaEvent {
  type: 'content_block_delta';
  index: number;
  delta: Delta;
}

type Delta =
  | { type: 'text_delta'; text: string }
  | { type: 'input_json_delta'; partial_json: string }
  | { type: 'thinking_delta'; thinking: string }
  | { type: 'signature_delta'; signature: string };

interface ContentBlockStopEvent {
  type: 'content_block_stop';
  index: number;
}

interface MessageDeltaEvent {
  type: 'message_delta';
  delta: {
    stop_reason: StopReason;
    stop_sequence?: string;
  };
  usage: { output_tokens: number };
}

interface MessageStopEvent {
  type: 'message_stop';
}

interface PingEvent {
  type: 'ping';
}

interface ErrorEvent {
  type: 'error';
  error: APIError;
}
```

### Example Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: $API_KEY_ANTHROPIC" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "system": "You are a helpful assistant.",
    "messages": [
      {"role": "user", "content": "Hello, Claude!"}
    ]
  }'
```

### Example Response

```json
{
  "id": "msg_01XFDUDYJgAACzvnptvVoYEL",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Hello! How can I help you today?"
    }
  ],
  "model": "claude-sonnet-4-20250514",
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 25,
    "output_tokens": 12
  }
}
```

---

## 2. Message Batches

Process multiple messages asynchronously. Ideal for large-scale processing with 50% cost savings.

### 2.1 Create Batch

```
POST /messages/batches
```

**Documentation:** https://docs.anthropic.com/en/api/creating-message-batches

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `requests` | array | ✅ | Array of batch request objects (up to 100,000) |

```typescript
interface BatchRequest {
  custom_id: string;     // Your unique ID (up to 64 chars)
  params: {
    model: string;
    max_tokens: number;
    messages: Message[];
    // ... other message params
  };
}
```

### Response

```typescript
interface MessageBatch {
  id: string;                      // e.g., "msgbatch_abc123"
  type: 'message_batch';
  processing_status: 'in_progress' | 'canceling' | 'ended';
  request_counts: {
    processing: number;
    succeeded: number;
    errored: number;
    canceled: number;
    expired: number;
  };
  ended_at?: string;               // ISO timestamp
  created_at: string;
  expires_at: string;
  cancel_initiated_at?: string;
  results_url?: string;            // JSONL results when complete
}
```

### 2.2 Retrieve Batch

```
GET /messages/batches/{batch_id}
```

### 2.3 List Batches

```
GET /messages/batches
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | integer | Max results (1-100). Default: 20 |
| `before_id` | string | Cursor for pagination |
| `after_id` | string | Cursor for pagination |

### 2.4 Cancel Batch

```
POST /messages/batches/{batch_id}/cancel
```

### 2.5 Get Batch Results

```
GET /messages/batches/{batch_id}/results
```

Returns JSONL with each line containing:

```typescript
interface BatchResult {
  custom_id: string;
  result: {
    type: 'succeeded' | 'errored' | 'canceled' | 'expired';
    message?: MessageResponse;     // If succeeded
    error?: APIError;              // If errored
  };
}
```

---

## 3. Token Counting

Count tokens before sending a request. Requires `anthropic-beta: token-counting-2024-11-01`.

### Endpoint

```
POST /messages/count_tokens
```

**Documentation:** https://docs.anthropic.com/en/api/token-counting

### Request Parameters

Same as Messages endpoint, but without generation parameters.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | ✅ | Model ID |
| `messages` | array | ✅ | Messages to count |
| `system` | string/array | ❌ | System prompt |
| `tools` | array | ❌ | Tools to include |
| `tool_choice` | object | ❌ | Tool choice |
| `thinking` | object | ❌ | Thinking config |

### Response

```typescript
interface TokenCountResponse {
  input_tokens: number;
}
```

---

## 4. Models

List and retrieve available models.

### 4.1 List Models

```
GET /models
```

**Documentation:** https://docs.anthropic.com/en/api/models-list

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | integer | Max results (1-1000). Default: 20 |
| `before_id` | string | Cursor for pagination |
| `after_id` | string | Cursor for pagination |

### Response

```typescript
interface ModelsResponse {
  data: Model[];
  has_more: boolean;
  first_id: string;
  last_id: string;
}

interface Model {
  id: string;            // e.g., "claude-sonnet-4-20250514"
  type: 'model';
  display_name: string;  // e.g., "Claude Sonnet 4"
  created_at: string;    // ISO timestamp
}
```

### 4.2 Retrieve Model

```
GET /models/{model_id}
```

---

## 5. Files

Upload and manage files for use in messages (PDFs, etc.).

### 5.1 Upload File

```
POST /files
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | file | ✅ | File to upload (max 500MB) |
| `purpose` | string | ✅ | `vision` |

### 5.2 List Files

```
GET /files
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | integer | Max results. Default: 100 |
| `after_id` | string | Cursor for pagination |

### 5.3 Retrieve File

```
GET /files/{file_id}
```

### 5.4 Delete File

```
DELETE /files/{file_id}
```

### Response

```typescript
interface FileObject {
  id: string;              // e.g., "file_abc123"
  type: 'file';
  filename: string;
  purpose: string;
  size: number;            // Bytes
  created_at: string;
  downloadable: boolean;
}
```

---

## Error Handling

All errors follow this format:

```typescript
interface APIError {
  type: 'error';
  error: {
    type: ErrorType;
    message: string;
  };
}

type ErrorType =
  | 'invalid_request_error'      // 400 - Bad request
  | 'authentication_error'       // 401 - Invalid API key
  | 'permission_error'           // 403 - Not allowed
  | 'not_found_error'            // 404 - Resource not found
  | 'request_too_large'          // 413 - Payload too large
  | 'rate_limit_error'           // 429 - Rate limited
  | 'api_error'                  // 500 - Server error
  | 'overloaded_error';          // 529 - Overloaded
```

### HTTP Status Codes

| Code | Error Type | Description |
|------|------------|-------------|
| 400 | `invalid_request_error` | Invalid parameters |
| 401 | `authentication_error` | Invalid/missing API key |
| 403 | `permission_error` | Not authorized |
| 404 | `not_found_error` | Resource not found |
| 413 | `request_too_large` | Request exceeds limit |
| 429 | `rate_limit_error` | Rate limited |
| 500 | `api_error` | Internal server error |
| 529 | `overloaded_error` | API overloaded |

### Request Size Limits

| Endpoint | Limit |
|----------|-------|
| Messages | 32 MB |
| Batch API | 256 MB |
| Files API | 500 MB |

---

## Rate Limits

Rate limits vary by:
- Organization tier
- Model
- Endpoint

Check response headers:
- `anthropic-ratelimit-requests-limit`
- `anthropic-ratelimit-requests-remaining`
- `anthropic-ratelimit-requests-reset`
- `anthropic-ratelimit-tokens-limit`
- `anthropic-ratelimit-tokens-remaining`
- `anthropic-ratelimit-tokens-reset`
- `retry-after` (when rate limited)

---

## Streaming Implementation Notes

### SSE Format

```
event: message_start
data: {...}

event: content_block_delta
data: {...}

event: message_stop
data: {...}
```

### TypeScript Parsing

```typescript
async function* parseAnthropicSSE(response: Response) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let eventType = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7);
      } else if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        yield { event: eventType, data };
      }
    }
  }
}
```

---

## Token Limits by Model

| Model | Context Window | Max Output |
|-------|---------------|------------|
| claude-opus-4.5 | 200,000 | 32,000 |
| claude-sonnet-4 | 200,000 | 64,000 |
| claude-3-5-sonnet | 200,000 | 8,192 |
| claude-3-5-haiku | 200,000 | 8,192 |
| claude-3-opus | 200,000 | 4,096 |
| claude-3-sonnet | 200,000 | 4,096 |
| claude-3-haiku | 200,000 | 4,096 |

---

## Prompt Caching

Reduce costs by caching frequently used content. Add `cache_control` to content blocks:

```typescript
{
  type: "text",
  text: "Long reference document...",
  cache_control: { type: "ephemeral" }
}
```

Cache hits are reflected in `usage`:
- `cache_creation_input_tokens` - Tokens cached (first request)
- `cache_read_input_tokens` - Tokens read from cache

**Pricing:**
- Cache creation: 25% more than base input
- Cache reads: 90% less than base input
- Cache TTL: 5 minutes (refreshed on use)

---

## Vision (Image Input)

Claude supports image inputs via:

```typescript
// Base64
{
  type: "image",
  source: {
    type: "base64",
    media_type: "image/jpeg",
    data: "base64-encoded-data..."
  }
}

// URL
{
  type: "image",
  source: {
    type: "url",
    url: "https://example.com/image.jpg"
  }
}
```

**Supported formats:** JPEG, PNG, GIF, WebP

**Limits:**
- Max 20 images per request
- Max 5MB per image (base64)
- Images are resized if >1568px on longest side

---

## PDF Support

Requires `anthropic-beta: pdfs-2024-09-25`:

```typescript
{
  type: "document",
  source: {
    type: "base64",
    media_type: "application/pdf",
    data: "base64-encoded-pdf..."
  },
  title: "Document Title",
  citations: { enabled: true }
}
```

**Limits:**
- Max 100 pages
- Max 32MB file size
- Standard pages ~1,500 tokens each

---

## Citations

Enable citations for documents:

```typescript
// In request
{
  type: "document",
  source: { ... },
  citations: { enabled: true }
}

// In response
{
  type: "text",
  text: "According to the document...",
  citations: [
    {
      type: "char_location",
      cited_text: "quoted text",
      document_index: 0,
      document_title: "Title",
      start_char_index: 100,
      end_char_index: 150
    }
  ]
}
```

---

## Pricing Reference

See: https://www.anthropic.com/pricing

Token pricing varies by model. Usage is tracked via the `usage` field.

---

*Last updated: December 2024*

