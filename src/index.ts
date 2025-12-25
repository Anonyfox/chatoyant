/**
 * Chatoyant - Typesafe LLM provider clients for TypeScript.
 *
 * Native fetch, streaming, structured outputs, zero dependencies.
 *
 * @example
 * ```typescript
 * // Unified high-level API (recommended)
 * import { Chat, genText, genData } from 'chatoyant';
 *
 * const answer = await genText("What is 2+2?");
 *
 * const chat = new Chat({ model: "gpt-4o" });
 * for await (const chunk of chat.user("Hello").stream()) {
 *   process.stdout.write(chunk);
 * }
 *
 * // Low-level provider clients
 * import { createOpenAIClient } from 'chatoyant/providers/openai';
 * import { createAnthropicClient } from 'chatoyant/providers/anthropic';
 * import { createXAIClient } from 'chatoyant/providers/xai';
 *
 * // Utilities
 * import { Schema } from 'chatoyant/schema';
 * import { estimateTokens, calculateCost } from 'chatoyant/tokens';
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// Core - High-Level Unified API (Primary Exports)
// =============================================================================

export type {
  // Chat types
  ChatConfig,
  ChatJSON,
  // Options types
  CommonOptions,
  GenDataOptions,
  GenerateOptions,
  GenerateResult,
  GenerateWithToolsOptions,
  GenStreamOptions,
  // Shortcut option types
  GenTextOptions,
  // Message types
  MessageJSON,
  MessageRole,
  StreamDelta,
  StreamOptions,
  // Tool types
  ToolCall,
  ToolContext,
  ToolDefinition,
  ToolInput,
  ToolOptions,
  ToolResult,
} from './core/index.js';
export {
  // Main classes
  Chat,
  createTool,
  DEFAULT_MAX_TOOL_ITERATIONS,
  DEFAULT_RETRIES,
  DEFAULT_TIMEOUT,
  DEFAULT_TOOL_TIMEOUT,
  genData,
  genStream,
  genStreamAccumulate,
  // One-shot functions
  genText,
  Message,
  // Options & constants
  mergeOptions,
  Tool,
} from './core/index.js';

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
