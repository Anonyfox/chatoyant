/**
 * Unified options for Chat operations.
 *
 * Provides provider-agnostic options with optional provider-specific
 * extensions that are passed through when supported.
 *
 * @module core/options
 */

import type { ProviderId } from '../providers/types.js';
import type { CreativityLevel, ReasoningLevel } from './presets.js';
import type { ToolCall, ToolResult } from './tool.js';

/**
 * Common options shared across all generation methods.
 */
export interface CommonOptions {
  /**
   * Override the provider (auto-detected from model by default).
   */
  provider?: ProviderId;

  /**
   * Request timeout in milliseconds.
   * @default 120000
   */
  timeout?: number;

  /**
   * Number of retries on failure.
   * @default 3
   */
  retries?: number;

  /**
   * Base URL for the local provider.
   * Overrides the LOCAL_BASE_URL environment variable.
   * Required when using provider: 'local' without LOCAL_BASE_URL set.
   *
   * @example 'http://127.0.0.1:11434/v1'  // Ollama
   * @example 'http://127.0.0.1:8765/v1'   // mlx-lm / omlx
   */
  localBaseUrl?: string;

  /**
   * API key for the local provider.
   * Overrides the LOCAL_API_KEY environment variable.
   * Defaults to "local" for servers that don't validate keys.
   */
  localApiKey?: string;

  /**
   * Request timeout in ms for the local provider.
   * Defaults to 60 000 ms. Increase for slow or large local models.
   */
  localTimeout?: number;
}

/**
 * Generation options for text/structured output.
 */
export interface GenerateOptions extends CommonOptions {
  /**
   * Sampling temperature (0-2).
   * Lower = more deterministic, higher = more creative.
   * undefined = provider default.
   *
   * Can also use semantic presets via `creativity` option.
   */
  temperature?: number;

  /**
   * Semantic creativity level.
   * Alternative to raw temperature values.
   * - 'precise': Temperature 0 (deterministic)
   * - 'balanced': Temperature 0.7 (default)
   * - 'creative': Temperature 1.0
   * - 'wild': Temperature 1.5
   *
   * If both `temperature` and `creativity` are set, `temperature` takes precedence.
   */
  creativity?: CreativityLevel;

  /**
   * Maximum tokens to generate.
   * undefined = provider default.
   */
  maxTokens?: number;

  /**
   * Top-p (nucleus) sampling.
   * undefined = provider default.
   */
  topP?: number;

  /**
   * Stop sequences.
   */
  stop?: string | string[];

  /**
   * Frequency penalty (-2 to 2).
   */
  frequencyPenalty?: number;

  /**
   * Presence penalty (-2 to 2).
   */
  presencePenalty?: number;

  // ===========================================================================
  // Unified Reasoning Control
  // ===========================================================================

  /**
   * Unified reasoning level across providers.
   * Maps automatically to provider-specific implementations:
   *
   * - 'off': No reasoning (OpenAI: none, Anthropic: no thinking, xAI: *-non-reasoning)
   * - 'low': Light reasoning (OpenAI: low, Anthropic: 2048 tokens)
   * - 'medium': Moderate reasoning (OpenAI: medium, Anthropic: 8192 tokens)
   * - 'high': Deep reasoning (OpenAI: high, Anthropic: 32768 tokens, xAI: *-reasoning)
   *
   * Note: Not all models support reasoning. For unsupported models, this is ignored.
   */
  reasoning?: ReasoningLevel;

  // ===========================================================================
  // Provider-Specific Options (passed through if supported)
  // ===========================================================================

  /**
   * Enable web search (xAI only).
   * Ignored for other providers.
   */
  webSearch?: boolean;

  /**
   * Thinking budget in tokens for local models that support it (e.g. Qwen3.5 via oMLX).
   * When set, the model will produce reasoning/thinking content before the final answer.
   * Thinking content is streamed separately via `reasoningContent` and does not mix
   * with the visible response.
   *
   * Only applies to local provider. Ignored for cloud providers.
   */
  thinkingBudget?: number;

  /**
   * Arbitrary additional options passed to the provider.
   * Use for bleeding-edge features not yet in the typed interface.
   */
  extra?: Record<string, unknown>;
}

/**
 * Options for streaming generation.
 */
export interface StreamOptions extends GenerateOptions {
  /**
   * Callback for each content delta.
   */
  onDelta?: (delta: string) => void;

  /**
   * Callback when streaming completes.
   */
  onComplete?: (fullContent: string) => void;

  /**
   * Callback on error during streaming.
   */
  onError?: (error: Error) => void;
}

/**
 * Options for tool execution.
 */
export interface ToolOptions {
  /**
   * Maximum tool call iterations before stopping.
   * @default 5
   */
  maxIterations?: number;

  /**
   * Timeout for each tool execution in milliseconds.
   * @default 10000
   */
  toolTimeout?: number;

  /**
   * How to handle tool execution errors.
   * - 'respond': Send error back to model (default)
   * - 'throw': Throw immediately
   * @default 'respond'
   */
  onToolError?: 'respond' | 'throw';

  /**
   * Callback fired when the model issues tool calls, before execution begins.
   * Useful for showing tool activity indicators in UIs.
   */
  onToolCallStart?: (calls: ToolCall[]) => void;

  /**
   * Callback fired after all tool calls in an iteration have been executed.
   * Receives the results (including success/failure status) for each call.
   */
  onToolCallComplete?: (results: ToolResult[]) => void;
}

/**
 * Combined options for generation with tools.
 */
export interface GenerateWithToolsOptions extends GenerateOptions, ToolOptions {}

/**
 * Combined options for streaming with tools.
 */
export interface StreamWithToolsOptions extends StreamOptions, ToolOptions {}

/**
 * Chat configuration options.
 */
export interface ChatConfig {
  /**
   * Model to use (e.g., "gpt-4o", "claude-sonnet-4-20250514", "grok-3").
   * @default "gpt-4o"
   */
  model?: string;

  /**
   * Default generation options applied to all calls.
   */
  defaults?: GenerateOptions;

  /**
   * Base URL for the local provider.
   * Sets the endpoint for all calls in this Chat instance when the
   * local provider is used (either explicitly via `provider: 'local'` or
   * via automatic fallback for unrecognised model names).
   * Overrides the LOCAL_BASE_URL environment variable.
   *
   * @example
   * ```typescript
   * new Chat({
   *   model: 'Qwen3.5-9B-MLX-4bit',
   *   localBaseUrl: 'http://127.0.0.1:8765/v1',
   * })
   * ```
   */
  localBaseUrl?: string;

  /**
   * API key for the local provider.
   * Overrides the LOCAL_API_KEY environment variable.
   * Defaults to "local" for servers that don't validate keys.
   */
  localApiKey?: string;

  /**
   * Request timeout in ms for the local provider.
   * Defaults to 60 000 ms. Increase for slow or large local models.
   */
  localTimeout?: number;
}

/**
 * Merge two option objects, with overrides taking precedence.
 */
export function mergeOptions<T extends CommonOptions>(
  defaults: T | undefined,
  overrides: Partial<T> | undefined,
): T {
  if (!defaults && !overrides) return {} as T;
  if (!defaults) return overrides as T;
  if (!overrides) return defaults;

  const merged = { ...defaults, ...overrides } as T & GenerateOptions;

  // Merge extra options if both have them
  const defaultsWithExtra = defaults as GenerateOptions;
  const overridesWithExtra = overrides as Partial<GenerateOptions>;
  if (defaultsWithExtra.extra || overridesWithExtra.extra) {
    (merged as GenerateOptions).extra = {
      ...defaultsWithExtra.extra,
      ...overridesWithExtra.extra,
    };
  }

  return merged as T;
}

/**
 * Default timeout in milliseconds.
 */
export const DEFAULT_TIMEOUT = 120_000;

/**
 * Default retry count.
 */
export const DEFAULT_RETRIES = 3;

/**
 * Default max tool iterations.
 */
export const DEFAULT_MAX_TOOL_ITERATIONS = 50;

/**
 * Default tool timeout.
 */
export const DEFAULT_TOOL_TIMEOUT = 10_000;
