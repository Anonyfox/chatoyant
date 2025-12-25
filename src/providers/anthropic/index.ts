/**
 * Anthropic Provider Module.
 *
 * Provides a complete, typesafe interface to the Anthropic Claude API.
 *
 * @example
 * ```typescript
 * import { AnthropicClient, createAnthropicClient } from 'chatoyant/providers/anthropic';
 *
 * const client = createAnthropicClient({
 *   apiKey: process.env.API_KEY_ANTHROPIC!,
 *   defaultModel: 'claude-sonnet-4-20250514',
 * });
 *
 * // Message
 * const text = await client.messageSimple([
 *   { role: 'user', content: 'Hello!' }
 * ]);
 *
 * // Stream
 * for await (const delta of client.streamContent([
 *   { role: 'user', content: 'Tell me a story' }
 * ])) {
 *   process.stdout.write(delta.text);
 * }
 * ```
 *
 * @module providers/anthropic
 */

// Client
export { AnthropicClient, type AnthropicClientConfig, createAnthropicClient } from './client.js';
// Errors
export { AnthropicError, isAnthropicError } from './errors.js';
// Messages
export {
  createMessage,
  extractText,
  extractToolUses,
  type MessagesOptions,
  messageSimple,
  messageStructured,
  messageWithTools,
} from './messages.js';
// Messages Streaming
export {
  type MessagesStreamOptions,
  messageStream,
  messageStreamAccumulate,
  messageStreamContent,
  messageStreamReadable,
  messageStreamToWritable,
  type StreamDelta,
} from './messages-stream.js';
// Request utilities
export {
  API_VERSION,
  BASE_URL,
  buildHeaders,
  buildUrl,
  DEFAULT_TIMEOUT,
  type RequestOptions,
  request,
  requestGet,
  requestRaw,
} from './request.js';
// Streaming utilities
export {
  accumulatorToToolUses,
  createAccumulator,
  parseSSEStream,
  type StreamAccumulator,
  streamWithAccumulator,
  updateAccumulator,
} from './stream.js';

// Types
export type {
  AnyTool,
  APIErrorResponse,
  BashTool,
  CacheControl,
  Citation,
  ComputerTool,
  ContentBlock,
  ContentBlockDeltaEvent,
  ContentBlockStartEvent,
  ContentBlockStopEvent,
  DocumentBlock,
  DocumentSource,
  ErrorEvent,
  ErrorType,
  ImageBlock,
  ImageSource,
  InputSchema,
  MCPTool,
  Message,
  MessageDeltaEvent,
  MessageStartEvent,
  MessageStopEvent,
  MessagesRequest,
  MessagesResponse,
  Model,
  ModelsResponse,
  PingEvent,
  RedactedThinkingBlock,
  RequestMetadata,
  ResponseContentBlock,
  Role,
  StopReason,
  StreamEvent,
  SystemPrompt,
  TextBlock,
  TextEditorTool,
  ThinkingBlock,
  ThinkingConfig,
  TokenCountRequest,
  TokenCountResponse,
  Tool,
  ToolChoice,
  ToolResultBlock,
  ToolUseBlock,
  Usage,
  WebSearchTool,
} from './types.js';
