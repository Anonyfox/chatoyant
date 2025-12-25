/**
 * Chatoyant Core - Unified LLM interface.
 *
 * Provides a high-level, provider-agnostic API for LLM interactions
 * with support for conversations, streaming, structured output, and tools.
 *
 * @example
 * ```typescript
 * import { Chat, genText, genData, Tool } from 'chatoyant/core';
 * import { Schema } from 'chatoyant/schema';
 *
 * // One-shot text generation
 * const answer = await genText("What is 2+2?");
 *
 * // Conversation with streaming
 * const chat = new Chat({ model: "gpt-4o" });
 * chat.system("You are helpful");
 *
 * for await (const chunk of chat.user("Hello!").stream()) {
 *   process.stdout.write(chunk);
 * }
 *
 * // Structured output
 * class Person extends Schema {
 *   name = Schema.String();
 *   age = Schema.Integer();
 * }
 * const person = await genData("Extract: Alice is 30", Person);
 *
 * // Serialization
 * const json = chat.toJSON();
 * const restored = Chat.fromJSON(json);
 * ```
 *
 * @module core
 */

// =============================================================================
// Main Classes
// =============================================================================

export { Chat, type ChatJSON, type GenerateResult, type StreamDelta } from './chat.js';

export {
  Message,
  type MessageJSON,
  type MessageRole,
} from './message.js';

export {
  createTool,
  Tool,
  type ToolCall,
  type ToolContext,
  type ToolDefinition,
  type ToolInput,
  type ToolResult,
} from './tool.js';

// =============================================================================
// One-Shot Functions
// =============================================================================

export {
  type GenDataOptions,
  type GenStreamOptions,
  type GenTextOptions,
  genData,
  genStream,
  genStreamAccumulate,
  genText,
} from './shortcuts.js';

// =============================================================================
// Options Types
// =============================================================================

export type {
  ChatConfig,
  CommonOptions,
  GenerateOptions,
  GenerateWithToolsOptions,
  StreamOptions,
  ToolOptions,
} from './options.js';

export {
  DEFAULT_MAX_TOOL_ITERATIONS,
  DEFAULT_RETRIES,
  DEFAULT_TIMEOUT,
  DEFAULT_TOOL_TIMEOUT,
  mergeOptions,
} from './options.js';

// =============================================================================
// Presets and Rich Metadata Types
// =============================================================================

export type {
  CostInfo,
  CreativityLevel,
  ModelPreset,
  ReasoningLevel,
  ResponseMetadata,
  TimingInfo,
  TokenUsage,
} from './presets.js';

export {
  adjustXAIModelForReasoning,
  createEmptyCost,
  createEmptyTiming,
  createEmptyUsage,
  CREATIVITY_PRESETS,
  getReasoningConfig,
  isCreativityLevel,
  isModelPreset,
  MODEL_PRESETS,
  REASONING_PRESETS,
  resolveCreativity,
  resolveModelPreset,
  supportsReasoning,
} from './presets.js';
