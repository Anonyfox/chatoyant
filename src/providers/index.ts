/**
 * Provider detection and configuration utilities.
 *
 * This module provides smart defaults for LLM provider configuration,
 * with automatic detection based on model names and environment variables.
 *
 * **Security by design**: API keys are read exclusively from environment
 * variables. This prevents hardcoded secrets from leaking into version control.
 *
 * @example
 * ```typescript
 * import {
 *   PROVIDERS,
 *   activeProviders,
 *   detectProviderByModel,
 *   resolveProvider,
 *   getApiKey,
 * } from 'chatoyant';
 *
 * // List providers with API keys configured
 * const active = activeProviders(); // ['openai', 'anthropic']
 *
 * // Auto-detect provider from model name
 * const provider = detectProviderByModel('gpt-4-turbo'); // 'openai'
 *
 * // Get API key (throws if not configured)
 * const key = getApiKey('openai');
 *
 * // Detect + assert in one step
 * const resolved = resolveProvider('claude-3-opus');
 * ```
 *
 * @module providers
 */

// Detection & utilities
export {
  activeProviders,
  assertProviderActive,
  detectProviderByModel,
  getApiKey,
  getBaseUrl,
  isProviderActive,
  ProviderError,
  resolveProvider,
} from './detection.js';
export type { AnthropicModel, KnownModel, OpenAIModel, XAIModel } from './models.js';

// Models
export {
  ANTHROPIC_MODELS,
  getAllKnownModels,
  getModelsForProvider,
  isKnownModel,
  MODELS_BY_PROVIDER,
  OPENAI_MODELS,
  XAI_MODELS,
} from './models.js';
// Registry
export { PROVIDER_IDS, PROVIDERS } from './registry.js';

// Types
export type { ProviderId, ProviderMeta, ProviderRegistry } from './types.js';
