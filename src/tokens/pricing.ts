/**
 * Pricing information for known models.
 *
 * All prices are in USD per 1 million tokens.
 * Update this file when pricing changes.
 *
 * @module tokens/pricing
 *
 * ## Official Pricing Pages
 *
 * - **OpenAI**: https://platform.openai.com/docs/pricing
 * - **Anthropic**: https://www.anthropic.com/pricing#anthropic-api
 * - **xAI**: https://docs.x.ai/docs/models
 */

import type { ModelPricing } from './types.js';

/**
 * Model pricing per 1 million tokens.
 *
 * @example
 * ```typescript
 * import { PRICING } from 'chatoyant/tokens';
 *
 * const gpt4oPrice = PRICING['gpt-4o'];
 * // { input: 2.50, output: 10.00, cached: 1.25 }
 * ```
 */
export const PRICING: Record<string, ModelPricing> = {
  // ==========================================================================
  // OpenAI
  // https://platform.openai.com/docs/pricing
  // ==========================================================================

  // GPT-5.x family (latest)
  'gpt-5.2': { input: 1.75, output: 14.0, cached: 0.175 },

  // GPT-4o family
  'gpt-4o': { input: 2.5, output: 10.0, cached: 1.25 },
  'gpt-4o-2024-11-20': { input: 2.5, output: 10.0, cached: 1.25 },
  'gpt-4o-2024-08-06': { input: 2.5, output: 10.0, cached: 1.25 },
  'gpt-4o-2024-05-13': { input: 5.0, output: 15.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6, cached: 0.075 },
  'gpt-4o-mini-2024-07-18': { input: 0.15, output: 0.6, cached: 0.075 },

  // GPT-4.1 family
  'gpt-4.1': { input: 2.0, output: 8.0, cached: 0.5 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6, cached: 0.1 },
  'gpt-4.1-nano': { input: 0.1, output: 0.4, cached: 0.025 },

  // GPT-4 Turbo
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'gpt-4-turbo-2024-04-09': { input: 10.0, output: 30.0 },
  'gpt-4-turbo-preview': { input: 10.0, output: 30.0 },
  'gpt-4-1106-preview': { input: 10.0, output: 30.0 },
  'gpt-4-0125-preview': { input: 10.0, output: 30.0 },

  // GPT-4
  'gpt-4': { input: 30.0, output: 60.0 },
  'gpt-4-0613': { input: 30.0, output: 60.0 },
  'gpt-4-32k': { input: 60.0, output: 120.0 },
  'gpt-4-32k-0613': { input: 60.0, output: 120.0 },

  // GPT-3.5 Turbo
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'gpt-3.5-turbo-0125': { input: 0.5, output: 1.5 },
  'gpt-3.5-turbo-1106': { input: 1.0, output: 2.0 },
  'gpt-3.5-turbo-16k': { input: 3.0, output: 4.0 },

  // o1 family (reasoning) - note: no cached pricing
  o1: { input: 15.0, output: 60.0 },
  'o1-2024-12-17': { input: 15.0, output: 60.0 },
  'o1-preview': { input: 15.0, output: 60.0 },
  'o1-preview-2024-09-12': { input: 15.0, output: 60.0 },
  'o1-mini': { input: 3.0, output: 12.0 },
  'o1-mini-2024-09-12': { input: 3.0, output: 12.0 },
  'o1-pro': { input: 150.0, output: 600.0 },
  'o1-pro-2025-03-19': { input: 150.0, output: 600.0 },

  // o3 family (reasoning)
  o3: { input: 10.0, output: 40.0 },
  'o3-2025-04-16': { input: 10.0, output: 40.0 },
  'o3-mini': { input: 1.1, output: 4.4 },
  'o3-mini-2025-01-31': { input: 1.1, output: 4.4 },
  'o4-mini': { input: 1.1, output: 4.4 },

  // Embeddings
  'text-embedding-3-small': { input: 0.02, output: 0 },
  'text-embedding-3-large': { input: 0.13, output: 0 },
  'text-embedding-ada-002': { input: 0.1, output: 0 },

  // ==========================================================================
  // Anthropic
  // https://www.anthropic.com/pricing#anthropic-api
  // ==========================================================================

  // Claude 4.5 (latest)
  'claude-4.5-sonnet': { input: 3.0, output: 15.0, cached: 0.3 },
  'claude-4.5-haiku': { input: 0.8, output: 4.0, cached: 0.08 },

  // Claude 4
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0, cached: 0.3 },
  'claude-sonnet-4': { input: 3.0, output: 15.0, cached: 0.3 },

  // Claude 3.5
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0, cached: 0.3 },
  'claude-3-5-sonnet-20240620': { input: 3.0, output: 15.0, cached: 0.3 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0, cached: 0.08 },
  'claude-3.5-sonnet': { input: 3.0, output: 15.0, cached: 0.3 },
  'claude-3.5-haiku': { input: 0.8, output: 4.0, cached: 0.08 },

  // Claude 3
  'claude-3-opus-20240229': { input: 15.0, output: 75.0, cached: 1.5 },
  'claude-3-sonnet-20240229': { input: 3.0, output: 15.0, cached: 0.3 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25, cached: 0.03 },
  'claude-3-opus': { input: 15.0, output: 75.0, cached: 1.5 },
  'claude-3-sonnet': { input: 3.0, output: 15.0, cached: 0.3 },
  'claude-3-haiku': { input: 0.25, output: 1.25, cached: 0.03 },

  // ==========================================================================
  // xAI (Grok)
  // https://docs.x.ai/docs/models
  // ==========================================================================

  // Grok 4.1 family (latest)
  'grok-4-1-fast-reasoning': { input: 0.2, output: 0.5 },
  'grok-4-1-fast-non-reasoning': { input: 0.2, output: 0.5 },
  'grok-4.1-fast': { input: 0.2, output: 0.5 },

  // Grok 4 family
  'grok-4-fast-reasoning': { input: 0.2, output: 0.5 },
  'grok-4-fast-non-reasoning': { input: 0.2, output: 0.5 },
  'grok-4-0709': { input: 3.0, output: 15.0 },
  'grok-4': { input: 3.0, output: 15.0 },

  // Grok Code
  'grok-code-fast-1': { input: 0.2, output: 1.5 },

  // Grok 3
  'grok-3': { input: 3.0, output: 15.0 },
  'grok-3-fast': { input: 5.0, output: 25.0 },
  'grok-3-mini': { input: 0.3, output: 0.5 },
  'grok-3-mini-fast': { input: 0.6, output: 4.0 },

  // Grok 2
  'grok-2': { input: 2.0, output: 10.0 },
  'grok-2-1212': { input: 2.0, output: 10.0 },
  'grok-2-vision': { input: 2.0, output: 10.0 },
  'grok-2-vision-1212': { input: 2.0, output: 10.0 },

  // Embeddings
  'grok-embedding-1': { input: 0.0, output: 0 }, // Free during beta
} as const;

/**
 * Type for known model IDs with pricing.
 */
export type KnownPricingModel = keyof typeof PRICING;

/**
 * Get pricing for a model, with optional fallback.
 *
 * @param model - Model ID
 * @param fallback - Fallback pricing if model not found
 * @returns Model pricing or fallback
 */
export function getPricing(model: string, fallback?: ModelPricing): ModelPricing | undefined {
  return PRICING[model] ?? fallback;
}

/**
 * Check if a model has known pricing.
 *
 * @param model - Model ID to check
 * @returns true if model has known pricing
 */
export function hasPricing(model: string): model is KnownPricingModel {
  return model in PRICING;
}
