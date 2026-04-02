/**
 * OpenRouter Provider Module.
 *
 * Provides an OpenAI-compatible client for OpenRouter — a unified gateway
 * to hundreds of models (OpenAI, Anthropic, Meta, Mistral, Google, etc.)
 * via a single API key.
 *
 * Configuration:
 * - `OPENROUTER_API_KEY` — required
 *
 * Model names use `org/model` slash notation, e.g.:
 * - `"anthropic/claude-opus-4"`
 * - `"openai/gpt-4o"`
 * - `"meta-llama/llama-3.1-8b-instruct"`
 *
 * The slash notation is auto-detected by chatoyant — no explicit
 * `provider: 'openrouter'` needed unless you want to force routing
 * for a model name without a slash.
 *
 * @example
 * ```typescript
 * import { createOpenRouterClient } from 'chatoyant/providers/openrouter';
 *
 * const client = createOpenRouterClient({
 *   apiKey: process.env.OPENROUTER_API_KEY!,
 *   defaultModel: 'anthropic/claude-opus-4',
 * });
 *
 * const reply = await client.chatSimple([
 *   { role: 'user', content: 'Hello!' }
 * ]);
 * ```
 *
 * @module providers/openrouter
 */

export {
  createOpenRouterClient,
  OPENROUTER_BASE_URL,
  OpenRouterClient,
  type OpenRouterClientConfig,
} from './client.js';
