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
 * console.log(PROVIDERS.anthropic.envKey); // "ANTHROPIC_API_KEY"
 * ```
 */
export const PROVIDERS: ProviderRegistry = {
  openai: {
    name: 'OpenAI',
    // Covers: gpt-*, o1-*, o3-*, chatgpt-*
    signatures: ['gpt', 'o1', 'o3', 'chatgpt'],
    envKey: 'OPENAI_API_KEY',
    envKeyLegacy: 'API_KEY_OPENAI',
    baseUrl: 'https://api.openai.com/v1',
  },
  anthropic: {
    name: 'Anthropic',
    // Covers: claude-*
    signatures: ['claude'],
    envKey: 'ANTHROPIC_API_KEY',
    envKeyLegacy: 'API_KEY_ANTHROPIC',
    baseUrl: 'https://api.anthropic.com/v1',
  },
  xai: {
    name: 'xAI',
    // Covers: grok-*
    signatures: ['grok'],
    envKey: 'XAI_API_KEY',
    envKeyLegacy: 'API_KEY_XAI',
    baseUrl: 'https://api.x.ai/v1',
  },
  local: {
    name: 'Local',
    // No model name signatures — any unknown model falls through to local
    // when LOCAL_BASE_URL is set. See detection.ts for the fallback logic.
    signatures: [],
    // LOCAL_API_KEY is optional; defaults to "local" for servers that
    // don't validate it. LOCAL_BASE_URL is what actually activates the provider.
    envKey: 'LOCAL_API_KEY',
    // baseUrl is dynamic — read at runtime from LOCAL_BASE_URL env var
    // or from localBaseUrl option passed to Chat / genText.
    baseUrl: '',
  },
} as const;

/**
 * Array of all provider IDs for iteration.
 */
export const PROVIDER_IDS = Object.keys(PROVIDERS) as ReadonlyArray<keyof typeof PROVIDERS>;
