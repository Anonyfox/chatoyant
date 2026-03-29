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

  // GPT-5.4 family (flagship as of March 2026)
  'gpt-5.4': 1_050_000,
  'gpt-5.4-mini': 400_000,
  'gpt-5.4-nano': 400_000,
  'gpt-5.4-pro': 1_050_000,

  // GPT-5.2 family (400K context)
  'gpt-5.2': 400_000,
  'gpt-5.2-pro': 400_000,
  'gpt-5.2-codex': 400_000,

  // GPT-5.1 family (400K context)
  'gpt-5.1': 400_000,
  'gpt-5.1-codex': 400_000,
  'gpt-5.1-codex-max': 400_000,
  'gpt-5.1-codex-mini': 400_000,

  // GPT-5 family (400K context)
  'gpt-5': 400_000,
  'gpt-5-pro': 400_000,
  'gpt-5-mini': 400_000,
  'gpt-5-nano': 400_000,
  'gpt-5-codex': 400_000,
  'gpt-5-image': 400_000,
  'gpt-5-image-mini': 400_000,

  // GPT-4o family
  'gpt-4o': 128_000,
  'gpt-4o-2024-11-20': 128_000,
  'gpt-4o-2024-08-06': 128_000,
  'gpt-4o-2024-05-13': 128_000,
  'gpt-4o-mini': 128_000,
  'gpt-4o-mini-2024-07-18': 128_000,

  // GPT-4.1 family (~1M tokens)
  'gpt-4.1': 1_047_576,
  'gpt-4.1-mini': 1_047_576,
  'gpt-4.1-nano': 1_047_576,

  // GPT-4 Turbo
  'gpt-4-turbo': 128_000,
  'gpt-4-turbo-2024-04-09': 128_000,
  'gpt-4-turbo-preview': 128_000,

  // GPT-4
  'gpt-4': 8_192,
  'gpt-4-0613': 8_192,
  'gpt-4-32k': 32_768,

  // GPT-3.5 Turbo
  'gpt-3.5-turbo': 16_385,
  'gpt-3.5-turbo-0125': 16_385,
  'gpt-3.5-turbo-16k': 16_385,

  // o1 family (reasoning)
  o1: 200_000,
  'o1-2024-12-17': 200_000,
  'o1-preview': 128_000,
  'o1-mini': 128_000,
  'o1-pro': 200_000,

  // o3 family (reasoning)
  o3: 200_000,
  'o3-2025-04-16': 200_000,
  'o3-mini': 200_000,
  'o3-mini-2025-01-31': 200_000,
  'o3-pro': 200_000,
  'o3-deep-research': 200_000,

  // o4 family (reasoning)
  'o4-mini': 200_000,
  'o4-mini-deep-research': 200_000,

  // Open-source models
  'gpt-oss-120b': 131_072,
  'gpt-oss-20b': 131_072,

  // ==========================================================================
  // Anthropic
  // https://docs.anthropic.com/en/docs/about-claude/models
  // ==========================================================================

  // Claude 4.6 (1M native context)
  'claude-opus-4-6': 1_000_000,
  'claude-sonnet-4-6': 1_000_000,

  // Claude 4.5
  'claude-opus-4-5-20251101': 200_000,
  'claude-opus-4-5': 200_000,
  'claude-sonnet-4-5-20250929': 200_000,
  'claude-sonnet-4-5': 200_000,
  'claude-haiku-4-5-20251001': 200_000,
  'claude-haiku-4-5': 200_000,

  // Claude 4.1
  'claude-opus-4-1-20250805': 200_000,
  'claude-opus-4-1': 200_000,

  // Claude 4
  'claude-sonnet-4-20250514': 200_000,
  'claude-sonnet-4-0': 200_000,
  'claude-opus-4-20250514': 200_000,
  'claude-opus-4-0': 200_000,

  // Claude 3.5
  'claude-3-5-sonnet-20241022': 200_000,
  'claude-3-5-sonnet-20240620': 200_000,
  'claude-3-5-haiku-20241022': 200_000,

  // Claude 3
  'claude-3-opus-20240229': 200_000,
  'claude-3-haiku-20240307': 200_000,

  // ==========================================================================
  // xAI (Grok)
  // https://docs.x.ai/docs/models
  // ==========================================================================

  // Grok 4.20 series (2M context, current as of March 2026)
  'grok-4.20-0309-reasoning': 2_000_000,
  'grok-4.20-0309-non-reasoning': 2_000_000,
  'grok-4.20-multi-agent-0309': 2_000_000,

  // Grok 4.1 fast series (2M context)
  'grok-4-1-fast-reasoning': 2_000_000,
  'grok-4-1-fast-non-reasoning': 2_000_000,

  // Grok 4 family
  'grok-4-fast-reasoning': 2_000_000,
  'grok-4-fast-non-reasoning': 2_000_000,
  'grok-4-0709': 256_000,
  'grok-4': 256_000,

  // Grok Code
  'grok-code-fast-1': 256_000,

  // Grok 3
  'grok-3': 131_072,
  'grok-3-mini': 131_072,

  // Grok 2
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
