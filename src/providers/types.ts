/**
 * Provider types and interfaces.
 *
 * @module providers/types
 */

/**
 * Supported provider identifiers.
 */
export type ProviderId = 'openai' | 'anthropic' | 'xai';

/**
 * Provider metadata for configuration and detection.
 */
export interface ProviderMeta {
  /** Human-readable provider name */
  readonly name: string;
  /** Model name signatures for auto-detection (e.g., ["gpt", "o1", "o3"] for OpenAI) */
  readonly signatures: readonly string[];
  /** Environment variable name for the API key */
  readonly envKey: string;
  /** Base URL for the provider's API */
  readonly baseUrl: string;
}

/**
 * Registry type mapping provider IDs to their metadata.
 */
export type ProviderRegistry = Readonly<Record<ProviderId, ProviderMeta>>;
