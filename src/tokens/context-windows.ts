/**
 * Context window sizes for known models.
 *
 * Values represent maximum tokens (input + output combined).
 * Update this file when new models are released or limits change.
 *
 * @module tokens/context-windows
 *
 * ## Official Documentation
 *
 * - **OpenAI**: https://platform.openai.com/docs/models
 * - **Anthropic**: https://docs.anthropic.com/en/docs/about-claude/models
 * - **xAI**: https://docs.x.ai/docs/models
 */

/**
 * Context window sizes by model ID.
 *
 * @example
 * ```typescript
 * import { CONTEXT_WINDOWS } from 'chatoyant/tokens';
 *
 * const maxTokens = CONTEXT_WINDOWS['gpt-4o']; // 128000
 * ```
 */
export const CONTEXT_WINDOWS = {
  // ==========================================================================
  // OpenAI
  // https://platform.openai.com/docs/models
  // ==========================================================================

  // GPT-5.x family (latest)
  'gpt-5.2': 128_000,

  // GPT-4o family
  'gpt-4o': 128_000,
  'gpt-4o-2024-11-20': 128_000,
  'gpt-4o-2024-08-06': 128_000,
  'gpt-4o-2024-05-13': 128_000,
  'gpt-4o-mini': 128_000,
  'gpt-4o-mini-2024-07-18': 128_000,

  // GPT-4.1 family
  'gpt-4.1': 1_047_576, // ~1M tokens
  'gpt-4.1-mini': 1_047_576,
  'gpt-4.1-nano': 1_047_576,

  // GPT-4 Turbo
  'gpt-4-turbo': 128_000,
  'gpt-4-turbo-2024-04-09': 128_000,
  'gpt-4-turbo-preview': 128_000,
  'gpt-4-1106-preview': 128_000,
  'gpt-4-0125-preview': 128_000,

  // GPT-4
  'gpt-4': 8_192,
  'gpt-4-0613': 8_192,
  'gpt-4-32k': 32_768,
  'gpt-4-32k-0613': 32_768,

  // GPT-3.5 Turbo
  'gpt-3.5-turbo': 16_385,
  'gpt-3.5-turbo-0125': 16_385,
  'gpt-3.5-turbo-1106': 16_385,
  'gpt-3.5-turbo-16k': 16_385,

  // o1 family (reasoning)
  o1: 200_000,
  'o1-2024-12-17': 200_000,
  'o1-preview': 128_000,
  'o1-preview-2024-09-12': 128_000,
  'o1-mini': 128_000,
  'o1-mini-2024-09-12': 128_000,
  'o1-pro': 200_000,
  'o1-pro-2025-03-19': 200_000,

  // o3 family (reasoning)
  o3: 200_000,
  'o3-2025-04-16': 200_000,
  'o3-mini': 200_000,
  'o3-mini-2025-01-31': 200_000,
  'o4-mini': 200_000,

  // ==========================================================================
  // Anthropic
  // https://docs.anthropic.com/en/docs/about-claude/models
  // ==========================================================================

  // Claude 4.5 (latest)
  'claude-4.5-sonnet': 200_000,
  'claude-4.5-haiku': 200_000,

  // Claude 4
  'claude-sonnet-4-20250514': 200_000,
  'claude-sonnet-4': 200_000,

  // Claude 3.5
  'claude-3-5-sonnet-20241022': 200_000,
  'claude-3-5-sonnet-20240620': 200_000,
  'claude-3-5-haiku-20241022': 200_000,
  'claude-3.5-sonnet': 200_000,
  'claude-3.5-haiku': 200_000,

  // Claude 3
  'claude-3-opus-20240229': 200_000,
  'claude-3-sonnet-20240229': 200_000,
  'claude-3-haiku-20240307': 200_000,
  'claude-3-opus': 200_000,
  'claude-3-sonnet': 200_000,
  'claude-3-haiku': 200_000,

  // ==========================================================================
  // xAI (Grok)
  // https://docs.x.ai/docs/models
  // ==========================================================================

  // Grok 4.1 family (latest) - 2M context
  'grok-4-1-fast-reasoning': 2_000_000,
  'grok-4-1-fast-non-reasoning': 2_000_000,
  'grok-4.1-fast': 2_000_000,

  // Grok 4 family
  'grok-4-fast-reasoning': 2_000_000,
  'grok-4-fast-non-reasoning': 2_000_000,
  'grok-4-0709': 256_000,
  'grok-4': 256_000,

  // Grok Code
  'grok-code-fast-1': 256_000,

  // Grok 3
  'grok-3': 131_072,
  'grok-3-fast': 131_072,
  'grok-3-mini': 131_072,
  'grok-3-mini-fast': 131_072,

  // Grok 2
  'grok-2': 131_072,
  'grok-2-1212': 131_072,
  'grok-2-vision': 32_768,
  'grok-2-vision-1212': 32_768,
} as const;

/**
 * Type for known model IDs with context windows.
 */
export type KnownContextModel = keyof typeof CONTEXT_WINDOWS;

/**
 * Get context window for a model, with optional fallback.
 *
 * @param model - Model ID
 * @param fallback - Fallback value if model not found (default: undefined)
 * @returns Context window size or fallback
 */
export function getContextWindow(model: string, fallback?: number): number | undefined {
  return (CONTEXT_WINDOWS as Record<string, number>)[model] ?? fallback;
}

/**
 * Check if a model has a known context window.
 *
 * @param model - Model ID to check
 * @returns true if model has known context window
 */
export function hasContextWindow(model: string): model is KnownContextModel {
  return model in CONTEXT_WINDOWS;
}
