/**
 * Provider detection and activation utilities.
 *
 * API keys are read exclusively from environment variables.
 * This is a deliberate security design to prevent hardcoded secrets.
 *
 * @module providers/detection
 */

import { PROVIDER_IDS, PROVIDERS } from './registry.js';
import type { ProviderId } from './types.js';

/** Environment variable that activates the local provider. */
const LOCAL_BASE_URL_KEY = 'LOCAL_BASE_URL';
/** Environment variable for the local provider API key (optional). */
const LOCAL_API_KEY_KEY = 'LOCAL_API_KEY';

/**
 * Error thrown when a provider operation fails.
 */
export class ProviderError extends Error {
  readonly providerId?: ProviderId;
  readonly envKey?: string;

  constructor(message: string, providerId?: ProviderId, envKey?: string) {
    super(message);
    this.name = 'ProviderError';
    this.providerId = providerId;
    this.envKey = envKey;
  }

  /**
   * Create error for missing API key.
   */
  static missingApiKey(providerId: ProviderId): ProviderError {
    if (providerId === 'local') {
      return new ProviderError(
        'Local provider is not active (missing LOCAL_BASE_URL environment variable)',
        'local',
        LOCAL_BASE_URL_KEY,
      );
    }
    const meta = PROVIDERS[providerId];
    const envInfo = meta.envKeyLegacy
      ? `${meta.envKey} (or legacy ${meta.envKeyLegacy})`
      : meta.envKey;
    return new ProviderError(
      `${meta.name} is not active (missing ${envInfo} environment variable)`,
      providerId,
      meta.envKey,
    );
  }

  /**
   * Create error for unknown provider.
   */
  static unknownProvider(model: string): ProviderError {
    const allSignatures = PROVIDER_IDS.flatMap((id) => PROVIDERS[id].signatures);
    return new ProviderError(
      `Could not detect provider for model "${model}". ` +
        `Known signatures: ${allSignatures.join(', ')}`,
    );
  }
}

/**
 * Check if a provider's API key is set in environment.
 *
 * @param providerId - The provider to check
 * @returns true if the provider's env key is set and non-empty
 *
 * @example
 * ```typescript
 * if (isProviderActive('openai')) {
 *   // Safe to use OpenAI
 * }
 * ```
 */
function resolveEnvValue(providerId: ProviderId): string | undefined {
  // Local provider: activated by LOCAL_BASE_URL, not an API key.
  if (providerId === 'local') {
    const baseUrl = process.env[LOCAL_BASE_URL_KEY];
    return typeof baseUrl === 'string' && baseUrl.length > 0 ? baseUrl : undefined;
  }
  const meta = PROVIDERS[providerId];
  const primary = process.env[meta.envKey];
  if (typeof primary === 'string' && primary.length > 0) return primary;
  if (meta.envKeyLegacy) {
    const legacy = process.env[meta.envKeyLegacy];
    if (typeof legacy === 'string' && legacy.length > 0) return legacy;
  }
  return undefined;
}

export function isProviderActive(providerId: ProviderId): boolean {
  return resolveEnvValue(providerId) !== undefined;
}

/**
 * List all providers that have their API key set in environment.
 *
 * @returns Array of active provider IDs
 *
 * @example
 * ```typescript
 * const active = activeProviders();
 * // ['openai', 'anthropic'] if both keys are set
 * ```
 */
export function activeProviders(): ProviderId[] {
  return PROVIDER_IDS.filter(isProviderActive);
}

/**
 * Detect provider from a model name using signature matching.
 *
 * Detection priority (first match wins):
 * 1. **OpenRouter**: model contains `/` — OpenRouter uses org/model notation
 *    (e.g. "anthropic/claude-opus-4", "meta-llama/llama-3.1-8b"). This check
 *    runs BEFORE signature matching so that e.g. "anthropic/claude-opus-4"
 *    routes to OpenRouter, not the native Anthropic API.
 * 2. **Native providers**: model name matches a known signature
 *    - OpenAI: gpt-*, o1-*, o3-*, chatgpt-*
 *    - Anthropic: claude-*
 *    - xAI: grok-*
 * 3. **No match**: returns null — caller falls back to local if LOCAL_BASE_URL is set.
 *
 * @param model - Model identifier
 * @returns Provider ID if detected, null otherwise
 *
 * @example
 * ```typescript
 * detectProviderByModel('gpt-4-turbo');              // 'openai'
 * detectProviderByModel('claude-3-opus');            // 'anthropic'
 * detectProviderByModel('grok-2');                   // 'xai'
 * detectProviderByModel('anthropic/claude-opus-4');  // 'openrouter' (slash notation)
 * detectProviderByModel('openai/gpt-4o');            // 'openrouter' (slash notation)
 * detectProviderByModel('meta-llama/llama-3.1-8b'); // 'openrouter' (slash notation)
 * detectProviderByModel('Qwen3-4B-MLX');             // null (unknown → local fallback)
 * ```
 */
export function detectProviderByModel(model: string): ProviderId | null {
  // OpenRouter uses org/model slash notation. Check BEFORE signature matching
  // so "anthropic/claude-opus-4" → openrouter, not anthropic.
  if (model.includes('/')) {
    return 'openrouter';
  }

  const lower = model.toLowerCase();
  for (const id of PROVIDER_IDS) {
    for (const signature of PROVIDERS[id].signatures) {
      if (lower.includes(signature)) {
        return id;
      }
    }
  }
  return null;
}

/**
 * Assert that a provider's API key is active, throwing if not.
 *
 * @param providerId - The provider to assert
 * @throws ProviderError if the provider's API key is not set
 *
 * @example
 * ```typescript
 * assertProviderActive('openai');
 * // Throws if API_KEY_OPENAI is not set
 * ```
 */
export function assertProviderActive(providerId: ProviderId): void {
  if (!isProviderActive(providerId)) {
    throw ProviderError.missingApiKey(providerId);
  }
}

/**
 * Get the API key for a provider from environment.
 *
 * @param providerId - The provider to get the key for
 * @returns The API key
 * @throws ProviderError if the API key is not set
 *
 * @example
 * ```typescript
 * const key = getApiKey('openai');
 * // Returns value of API_KEY_OPENAI, or throws
 * ```
 */
export function getApiKey(providerId: ProviderId): string {
  if (providerId === 'local') {
    assertProviderActive('local');
    // API key is optional — default to 'local' for servers that don't validate it.
    const key = process.env[LOCAL_API_KEY_KEY];
    return typeof key === 'string' && key.length > 0 ? key : 'local';
  }
  assertProviderActive(providerId);
  return resolveEnvValue(providerId)!;
}

/**
 * Get the base URL for a provider's API.
 *
 * @param providerId - The provider
 * @returns The base URL
 *
 * @example
 * ```typescript
 * getBaseUrl('openai'); // 'https://api.openai.com/v1'
 * ```
 */
export function getBaseUrl(providerId: ProviderId): string {
  if (providerId === 'local') {
    return process.env[LOCAL_BASE_URL_KEY] ?? '';
  }
  return PROVIDERS[providerId].baseUrl;
}

/**
 * Get the API key for OpenRouter from environment.
 * Exported for use in client creation.
 */
export function getOpenRouterApiKey(): string {
  const key =
    process.env[PROVIDERS.openrouter.envKey] ?? process.env[PROVIDERS.openrouter.envKeyLegacy!];
  if (!key) throw ProviderError.missingApiKey('openrouter');
  return key;
}

/**
 * Auto-detect provider from model and assert it's active.
 * Convenience function combining detection and assertion.
 *
 * @param model - Model identifier
 * @returns The detected provider ID
 * @throws ProviderError if provider cannot be detected or is not active
 *
 * @example
 * ```typescript
 * const provider = resolveProvider('gpt-4');
 * // Returns 'openai' if API_KEY_OPENAI is set, throws otherwise
 * ```
 */
export function resolveProvider(model: string): ProviderId {
  const providerId = detectProviderByModel(model);
  if (providerId) {
    assertProviderActive(providerId);
    return providerId;
  }
  // Unknown model name (no slash, no known signature):
  // fall back to local if LOCAL_BASE_URL is configured.
  if (isProviderActive('local')) {
    return 'local';
  }
  throw ProviderError.unknownProvider(model);
}
