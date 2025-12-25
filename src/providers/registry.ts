/**
 * Provider registry with metadata for each supported provider.
 *
 * @module providers/registry
 */

import type { ProviderRegistry } from './types.js';

/**
 * Registry of supported LLM providers.
 *
 * Each provider entry contains:
 * - `name`: Human-readable name
 * - `signatures`: Model name patterns for auto-detection
 * - `envKey`: Environment variable for API key (security by design)
 * - `baseUrl`: API endpoint base URL
 *
 * @example
 * ```typescript
 * import { PROVIDERS } from 'chatoyant';
 *
 * console.log(PROVIDERS.openai.name); // "OpenAI"
 * console.log(PROVIDERS.anthropic.envKey); // "API_KEY_ANTHROPIC"
 * ```
 */
export const PROVIDERS: ProviderRegistry = {
  openai: {
    name: 'OpenAI',
    // Covers: gpt-*, o1-*, o3-*, chatgpt-*
    signatures: ['gpt', 'o1', 'o3', 'chatgpt'],
    envKey: 'API_KEY_OPENAI',
    baseUrl: 'https://api.openai.com/v1',
  },
  anthropic: {
    name: 'Anthropic',
    // Covers: claude-*
    signatures: ['claude'],
    envKey: 'API_KEY_ANTHROPIC',
    baseUrl: 'https://api.anthropic.com/v1',
  },
  xai: {
    name: 'xAI',
    // Covers: grok-*
    signatures: ['grok'],
    envKey: 'API_KEY_XAI',
    baseUrl: 'https://api.x.ai/v1',
  },
} as const;

/**
 * Array of all provider IDs for iteration.
 */
export const PROVIDER_IDS = Object.keys(PROVIDERS) as ReadonlyArray<keyof typeof PROVIDERS>;
