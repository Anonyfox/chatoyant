/**
 * Chatoyant - Typesafe LLM provider clients for TypeScript.
 *
 * Native fetch, streaming, structured outputs, zero dependencies.
 *
 * @example
 * ```typescript
 * // Import provider clients directly
 * import { createOpenAIClient } from 'chatoyant/providers/openai';
 * import { createAnthropicClient } from 'chatoyant/providers/anthropic';
 * import { createXAIClient } from 'chatoyant/providers/xai';
 *
 * // Or import the Schema utility
 * import { Schema } from 'chatoyant/schema';
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// Schema (re-exported for convenience)
// =============================================================================

export type {
  ArrayFieldOptions,
  BaseFieldOptions,
  BooleanFieldOptions,
  EnumFieldOptions,
  FieldDescriptor,
  InferSchema,
  IntegerFieldOptions,
  JSONSchemaDocument,
  JSONSchemaProperty,
  JSONSchemaType,
  LiteralFieldOptions,
  NumberFieldOptions,
  ObjectFieldOptions,
  Proxied,
  SchemaConstructor,
  SchemaInstance,
  StringFieldOptions,
  StringFormat,
} from './schema/index.js';
export { Schema, SchemaError } from './schema/index.js';

// =============================================================================
// Provider Clients (factory functions for convenience)
// =============================================================================

export {
  AnthropicClient,
  type AnthropicClientConfig,
  createAnthropicClient,
} from './providers/anthropic/index.js';
export {
  createOpenAIClient,
  OpenAIClient,
  type OpenAIClientConfig,
} from './providers/openai/index.js';

export {
  createXAIClient,
  XAIClient,
  type XAIClientConfig,
} from './providers/xai/index.js';

// =============================================================================
// Provider Detection Utilities
// =============================================================================

export type { KnownModel, ProviderId, ProviderMeta, ProviderRegistry } from './providers/index.js';

export {
  activeProviders,
  assertProviderActive,
  detectProviderByModel,
  getApiKey,
  getBaseUrl,
  isProviderActive,
  PROVIDER_IDS,
  PROVIDERS,
  ProviderError,
  resolveProvider,
} from './providers/index.js';

// =============================================================================
// Known Models
// =============================================================================

export type { AnthropicModel, OpenAIModel, XAIModel } from './providers/index.js';

export {
  ANTHROPIC_MODELS,
  getAllKnownModels,
  getModelsForProvider,
  isKnownModel,
  MODELS_BY_PROVIDER,
  OPENAI_MODELS,
  XAI_MODELS,
} from './providers/index.js';
