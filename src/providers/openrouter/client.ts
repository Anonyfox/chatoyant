/**
 * OpenRouter provider client.
 *
 * A thin subclass of OpenAIClient pre-configured for OpenRouter's API.
 * OpenRouter exposes an OpenAI-compatible endpoint that proxies requests
 * to hundreds of models (OpenAI, Anthropic, Meta, Mistral, Google, etc.)
 * using the standard org/model naming convention (e.g. "anthropic/claude-opus-4").
 *
 * @module providers/openrouter/client
 */

import { OpenAIClient, type OpenAIClientConfig } from '../openai/client.js';
import { PROVIDERS } from '../registry.js';

/** OpenRouter API base URL. */
export const OPENROUTER_BASE_URL = PROVIDERS.openrouter.baseUrl;

/**
 * OpenRouter client configuration.
 *
 * Like {@link OpenAIClientConfig} but `baseUrl` is pre-set to OpenRouter's
 * endpoint — only `apiKey` is required.
 */
export interface OpenRouterClientConfig {
  /** OPENROUTER_API_KEY */
  apiKey: string;
  /** Default timeout in ms. */
  timeout?: number;
  /** Default model (e.g. "anthropic/claude-opus-4"). */
  defaultModel?: string;
  /** Additional headers (e.g. HTTP-Referer, X-Title for attribution). */
  headers?: Record<string, string>;
}

/**
 * Client for OpenRouter — a unified gateway to frontier and open models
 * via a single OpenAI-compatible API.
 *
 * Model names follow org/model convention, e.g.:
 * - `"anthropic/claude-opus-4"`
 * - `"openai/gpt-4o"`
 * - `"meta-llama/llama-3.1-8b-instruct"`
 * - `"google/gemini-pro"`
 * - `"mistralai/mistral-large"`
 *
 * @example
 * ```typescript
 * const client = createOpenRouterClient({
 *   apiKey: process.env.OPENROUTER_API_KEY!,
 *   defaultModel: 'anthropic/claude-opus-4',
 * });
 *
 * const reply = await client.chatSimple([
 *   { role: 'user', content: 'Hello!' }
 * ]);
 * ```
 */
export class OpenRouterClient extends OpenAIClient {
  constructor(config: OpenRouterClientConfig) {
    const openaiConfig: OpenAIClientConfig = {
      ...config,
      baseUrl: OPENROUTER_BASE_URL,
    };
    super(openaiConfig);
  }
}

/**
 * Create an OpenRouter client.
 */
export function createOpenRouterClient(config: OpenRouterClientConfig): OpenRouterClient {
  return new OpenRouterClient(config);
}
