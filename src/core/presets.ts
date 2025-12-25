/**
 * Model presets and unified options for cross-provider consistency.
 *
 * Provides semantic aliases for models, reasoning levels, and creativity
 * that map intelligently to provider-specific implementations.
 *
 * @module core/presets
 */

import type { ProviderId } from '../providers/types.js';

// =============================================================================
// Model Presets
// =============================================================================

/**
 * Intent-based model presets.
 * Users can specify what they want, not which model to use.
 */
export type ModelPreset = 'fast' | 'cheap' | 'best' | 'balanced' | 'reasoning';

/**
 * Model preset definitions per provider.
 */
export const MODEL_PRESETS: Record<ModelPreset, Record<ProviderId, string>> = {
  /** Fastest response time */
  fast: {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-5-haiku-20241022',
    xai: 'grok-4-1-fast-non-reasoning',
  },
  /** Lowest cost per token */
  cheap: {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-5-haiku-20241022',
    xai: 'grok-3-mini',
  },
  /** Highest quality output */
  best: {
    openai: 'gpt-5.1',
    anthropic: 'claude-sonnet-4-20250514',
    xai: 'grok-4-0709',
  },
  /** Good balance of quality/speed/cost */
  balanced: {
    openai: 'gpt-4o',
    anthropic: 'claude-sonnet-4-20250514',
    xai: 'grok-3',
  },
  /** Best reasoning capabilities */
  reasoning: {
    openai: 'gpt-5.1',
    anthropic: 'claude-sonnet-4-20250514',
    xai: 'grok-4-1-fast-reasoning',
  },
};

/**
 * Check if a string is a model preset.
 */
export function isModelPreset(model: string): model is ModelPreset {
  return model in MODEL_PRESETS;
}

/**
 * Resolve a model preset to a specific model ID for a provider.
 *
 * @param preset - The model preset
 * @param provider - The target provider (defaults to 'openai')
 * @returns The resolved model ID
 */
export function resolveModelPreset(preset: ModelPreset, provider: ProviderId = 'openai'): string {
  return MODEL_PRESETS[preset][provider];
}

/**
 * Get the default provider order for fallback/selection.
 */
export function getDefaultProviderOrder(): ProviderId[] {
  return ['openai', 'anthropic', 'xai'];
}

// =============================================================================
// Reasoning Presets
// =============================================================================

/**
 * Unified reasoning levels.
 * Maps to provider-specific implementations automatically.
 */
export type ReasoningLevel = 'off' | 'low' | 'medium' | 'high';

/**
 * Reasoning configuration for each provider.
 */
export interface ReasoningConfig {
  openai: {
    reasoningEffort: 'none' | 'minimal' | 'low' | 'medium' | 'high';
  };
  anthropic: {
    thinking?: {
      type: 'enabled';
      budget_tokens: number;
    };
  };
  xai: {
    /** For xAI, reasoning is controlled by model selection, not parameters */
    preferReasoningModel: boolean;
  };
}

/**
 * Map unified reasoning level to provider-specific configuration.
 */
export const REASONING_PRESETS: Record<ReasoningLevel, ReasoningConfig> = {
  off: {
    openai: { reasoningEffort: 'none' },
    anthropic: {}, // No thinking block
    xai: { preferReasoningModel: false },
  },
  low: {
    openai: { reasoningEffort: 'low' },
    anthropic: {
      thinking: { type: 'enabled', budget_tokens: 2048 },
    },
    xai: { preferReasoningModel: false },
  },
  medium: {
    openai: { reasoningEffort: 'medium' },
    anthropic: {
      thinking: { type: 'enabled', budget_tokens: 8192 },
    },
    xai: { preferReasoningModel: true },
  },
  high: {
    openai: { reasoningEffort: 'high' },
    anthropic: {
      thinking: { type: 'enabled', budget_tokens: 32768 },
    },
    xai: { preferReasoningModel: true },
  },
};

/**
 * Get reasoning configuration for a specific provider.
 */
export function getReasoningConfig<P extends ProviderId>(
  level: ReasoningLevel,
  provider: P,
): ReasoningConfig[P] {
  return REASONING_PRESETS[level][provider];
}

/**
 * Check if a model supports reasoning configuration.
 * Some models (like GPT-4o) don't support reasoning_effort.
 */
export function supportsReasoning(model: string): boolean {
  // OpenAI: Only GPT-5+ and o-series models
  if (
    model.startsWith('gpt-5') ||
    model.startsWith('o1') ||
    model.startsWith('o3') ||
    model.startsWith('o4')
  ) {
    return true;
  }
  // Anthropic: All Claude models support thinking
  if (model.includes('claude')) {
    return true;
  }
  // xAI: Reasoning is model-based, not parameter-based
  // The grok-4-1-fast-* models have explicit reasoning/non-reasoning variants
  return false;
}

/**
 * Swap xAI model to reasoning/non-reasoning variant based on preference.
 */
export function adjustXAIModelForReasoning(model: string, preferReasoning: boolean): string {
  // Handle grok-4-1-fast variants
  if (model === 'grok-4-1-fast-reasoning' && !preferReasoning) {
    return 'grok-4-1-fast-non-reasoning';
  }
  if (model === 'grok-4-1-fast-non-reasoning' && preferReasoning) {
    return 'grok-4-1-fast-reasoning';
  }
  // Handle generic grok-4-fast variants
  if (model === 'grok-4-fast-reasoning' && !preferReasoning) {
    return 'grok-4-fast-non-reasoning';
  }
  if (model === 'grok-4-fast-non-reasoning' && preferReasoning) {
    return 'grok-4-fast-reasoning';
  }
  return model;
}

// =============================================================================
// Creativity/Temperature Presets
// =============================================================================

/**
 * Semantic creativity levels.
 */
export type CreativityLevel = 'precise' | 'balanced' | 'creative' | 'wild';

/**
 * Temperature values for each creativity level.
 */
export const CREATIVITY_PRESETS: Record<CreativityLevel, number> = {
  /** Deterministic, consistent output */
  precise: 0,
  /** Default balanced creativity */
  balanced: 0.7,
  /** More varied and creative */
  creative: 1.0,
  /** Maximum creativity (may be less coherent) */
  wild: 1.5,
};

/**
 * Check if a value is a creativity level.
 */
export function isCreativityLevel(value: unknown): value is CreativityLevel {
  return typeof value === 'string' && value in CREATIVITY_PRESETS;
}

/**
 * Resolve creativity level to temperature value.
 */
export function resolveCreativity(level: CreativityLevel): number {
  return CREATIVITY_PRESETS[level];
}

// =============================================================================
// Response Metadata Types
// =============================================================================

/**
 * Detailed token usage breakdown.
 */
export interface TokenUsage {
  /** Input/prompt tokens */
  inputTokens: number;
  /** Output/completion tokens */
  outputTokens: number;
  /** Reasoning/thinking tokens (if available) */
  reasoningTokens: number;
  /** Cached input tokens (if available) */
  cachedTokens: number;
  /** Total tokens (input + output) */
  totalTokens: number;
}

/**
 * Timing information for the request.
 */
export interface TimingInfo {
  /** Total request latency in milliseconds */
  latencyMs: number;
  /** Time to first token in milliseconds (streaming only) */
  timeToFirstTokenMs?: number;
}

/**
 * Cost information for the request.
 */
export interface CostInfo {
  /** Estimated cost in USD */
  estimatedUsd: number;
}

/**
 * Rich response metadata.
 */
export interface ResponseMetadata {
  /** Token usage breakdown */
  usage: TokenUsage;
  /** Timing information */
  timing: TimingInfo;
  /** Cost information */
  cost: CostInfo;
  /** Provider used */
  provider: ProviderId;
  /** Model used */
  model: string;
  /** Whether response was from cache */
  cached: boolean;
}

/**
 * Create empty token usage object.
 */
export function createEmptyUsage(): TokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    cachedTokens: 0,
    totalTokens: 0,
  };
}

/**
 * Create empty timing info.
 */
export function createEmptyTiming(): TimingInfo {
  return {
    latencyMs: 0,
  };
}

/**
 * Create empty cost info.
 */
export function createEmptyCost(): CostInfo {
  return {
    estimatedUsd: 0,
  };
}
