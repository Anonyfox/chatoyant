/**
 * Local provider client.
 *
 * A thin subclass of OpenAIClient that requires an explicit base URL
 * (pointing at a local OpenAI-compatible inference server such as Ollama,
 * LM Studio, mlx-lm, llama.cpp server, vLLM, etc.) and makes the API key
 * optional (defaults to "local" for servers that don't check it).
 *
 * @module providers/local/client
 */

import { OpenAIClient, type OpenAIClientConfig } from '../openai/client.js';

/**
 * Local provider client configuration.
 *
 * Like {@link OpenAIClientConfig} but `baseUrl` is required and `apiKey`
 * is optional (defaults to `"local"`).
 */
export interface LocalClientConfig {
  /** Base URL of the local inference server (required). */
  baseUrl: string;
  /** API key. Defaults to "local" for servers that don't validate it. */
  apiKey?: string;
  /** Default timeout in ms. */
  timeout?: number;
  /** Default model for chat. */
  defaultModel?: string;
  /** Additional headers. */
  headers?: Record<string, string>;
}

/**
 * Client for local OpenAI-compatible inference servers.
 *
 * Supports chat, streaming, tool calling, and structured output via the
 * same interface as {@link OpenAIClient}. The server is expected to implement
 * the OpenAI Chat Completions API at the given `baseUrl`.
 *
 * @example
 * ```typescript
 * // From env vars (LOCAL_BASE_URL + LOCAL_API_KEY)
 * const client = createLocalClient({
 *   baseUrl: process.env.LOCAL_BASE_URL!,
 *   apiKey: process.env.LOCAL_API_KEY,
 *   defaultModel: 'Qwen3.5-9B-MLX-4bit',
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
 *
 * // List models served by the local server
 * const ids = await client.listModelIds();
 * ```
 */
export class LocalClient extends OpenAIClient {
  constructor(config: LocalClientConfig) {
    const openaiConfig: OpenAIClientConfig = {
      ...config,
      apiKey: config.apiKey ?? 'local',
      baseUrl: config.baseUrl,
    };
    super(openaiConfig);
  }
}

/**
 * Create a local provider client.
 *
 * @param config - Client configuration (baseUrl required, apiKey optional)
 * @returns LocalClient instance
 *
 * @example
 * ```typescript
 * const client = createLocalClient({
 *   baseUrl: 'http://127.0.0.1:11434/v1',  // Ollama
 * });
 *
 * const client = createLocalClient({
 *   baseUrl: 'http://127.0.0.1:8765/v1',   // mlx-lm / omlx
 *   apiKey: 'Razer88fox',
 * });
 * ```
 */
export function createLocalClient(config: LocalClientConfig): LocalClient {
  return new LocalClient(config);
}
