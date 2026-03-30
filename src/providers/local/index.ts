/**
 * Local Provider Module.
 *
 * Provides an OpenAI-compatible client for local inference servers such as
 * Ollama, LM Studio, mlx-lm, llama.cpp server, vLLM, and any other server
 * that implements the OpenAI Chat Completions API.
 *
 * Configuration via environment variables:
 * - `LOCAL_BASE_URL` — base URL of the local server (required)
 * - `LOCAL_API_KEY`  — API key (optional, defaults to "local")
 *
 * Or pass `localBaseUrl` / `localApiKey` inline to `Chat` or `genText`.
 *
 * @example
 * ```typescript
 * import { createLocalClient } from 'chatoyant/providers/local';
 *
 * const client = createLocalClient({
 *   baseUrl: 'http://127.0.0.1:11434/v1',  // Ollama
 * });
 *
 * // Chat
 * const reply = await client.chatSimple([
 *   { role: 'user', content: 'Hello!' }
 * ]);
 *
 * // Stream
 * for await (const delta of client.streamContent([
 *   { role: 'user', content: 'Tell me a story' }
 * ])) {
 *   process.stdout.write(delta.content);
 * }
 * ```
 *
 * @module providers/local
 */

// Re-export OpenAI types — local uses the same wire format
export type {
  AssistantMessage,
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionRequest,
  Choice,
  ChunkChoice,
  ChunkDelta,
  ErrorType,
  FinishReason,
  Message,
  Model,
  ModelsResponse,
  Role,
  StreamOptions,
  SystemMessage,
  Tool,
  ToolCall,
  ToolCallDelta,
  ToolChoice,
  ToolMessage,
  Usage,
  UserMessage,
} from '../openai/types.js';
export { createLocalClient, LocalClient, type LocalClientConfig } from './client.js';
export { isLocalError, LocalError } from './errors.js';
