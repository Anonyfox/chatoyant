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
   * Enable prompt caching (Anthropic only).
   * Marks the system prompt for caching.
   */
  cache?: boolean;

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
}

/**
 * Combined options for generation with tools.
 */
export interface GenerateWithToolsOptions extends GenerateOptions, ToolOptions {}

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
export const DEFAULT_MAX_TOOL_ITERATIONS = 5;

/**
 * Default tool timeout.
 */
export const DEFAULT_TOOL_TIMEOUT = 10_000;
