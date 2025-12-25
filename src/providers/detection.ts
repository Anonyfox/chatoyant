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
    const meta = PROVIDERS[providerId];
    return new ProviderError(
      `${meta.name} is not active (missing ${meta.envKey} environment variable)`,
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
export function isProviderActive(providerId: ProviderId): boolean {
  const envKey = PROVIDERS[providerId].envKey;
  const value = process.env[envKey];
  return typeof value === 'string' && value.length > 0;
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
 * Supports multiple signatures per provider to handle model naming variations:
 * - OpenAI: gpt-*, o1-*, o3-*, chatgpt-*
 * - Anthropic: claude-*
 * - xAI: grok-*
 *
 * @param model - Model identifier (e.g., "gpt-4", "o1-preview", "claude-3-opus", "grok-2")
 * @returns Provider ID if detected, null otherwise
 *
 * @example
 * ```typescript
 * detectProviderByModel('gpt-4-turbo');     // 'openai'
 * detectProviderByModel('o1-preview');      // 'openai'
 * detectProviderByModel('o3-mini');         // 'openai'
 * detectProviderByModel('claude-3-opus');   // 'anthropic'
 * detectProviderByModel('grok-2');          // 'xai'
 * detectProviderByModel('unknown-model');   // null
 * ```
 */
export function detectProviderByModel(model: string): ProviderId | null {
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
  assertProviderActive(providerId);
  return process.env[PROVIDERS[providerId].envKey]!;
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
  return PROVIDERS[providerId].baseUrl;
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
  if (!providerId) {
    throw ProviderError.unknownProvider(model);
  }
  assertProviderActive(providerId);
  return providerId;
}
