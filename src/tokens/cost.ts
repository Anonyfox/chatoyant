/**
 * Cost calculation for LLM API usage.
 *
 * @module tokens/cost
 */

import { getPricing, PRICING } from './pricing.js';
import type { CostResult, ModelPricing } from './types.js';

/**
 * Calculate cost for token usage.
 *
 * @param params - Token counts and model
 * @returns Cost breakdown in USD
 *
 * @example
 * ```typescript
 * import { calculateCost } from 'chatoyant/tokens';
 *
 * const cost = calculateCost({
 *   model: 'gpt-4o',
 *   inputTokens: 1000,
 *   outputTokens: 500,
 * });
 * // { input: 0.0025, output: 0.005, cached: 0, total: 0.0075 }
 * ```
 */
export function calculateCost(params: {
  /** Model ID for pricing lookup */
  model: string;
  /** Number of input tokens */
  inputTokens: number;
  /** Number of output tokens */
  outputTokens: number;
  /** Number of cached input tokens (subtracted from inputTokens for billing) */
  cachedTokens?: number;
}): CostResult {
  const { model, inputTokens, outputTokens, cachedTokens = 0 } = params;

  const pricing = getPricing(model);
  if (!pricing) {
    return { input: 0, output: 0, cached: 0, total: 0 };
  }

  // Calculate costs (pricing is per 1M tokens)
  const billableInputTokens = Math.max(0, inputTokens - cachedTokens);
  const inputCost = (billableInputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const cachedCost = pricing.cached ? (cachedTokens / 1_000_000) * pricing.cached : 0;

  return {
    input: inputCost,
    output: outputCost,
    cached: cachedCost,
    total: inputCost + outputCost + cachedCost,
  };
}

/**
 * Calculate cost with custom pricing.
 *
 * Use this when you have custom pricing (e.g., Azure, self-hosted).
 *
 * @param params - Token counts and custom pricing
 * @returns Cost breakdown in USD
 *
 * @example
 * ```typescript
 * const cost = calculateCostCustom({
 *   inputTokens: 1000,
 *   outputTokens: 500,
 *   pricing: { input: 5.00, output: 15.00 }, // per 1M tokens
 * });
 * ```
 */
export function calculateCostCustom(params: {
  /** Number of input tokens */
  inputTokens: number;
  /** Number of output tokens */
  outputTokens: number;
  /** Number of cached input tokens */
  cachedTokens?: number;
  /** Custom pricing per 1M tokens */
  pricing: ModelPricing;
}): CostResult {
  const { inputTokens, outputTokens, cachedTokens = 0, pricing } = params;

  const billableInputTokens = Math.max(0, inputTokens - cachedTokens);
  const inputCost = (billableInputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const cachedCost = pricing.cached ? (cachedTokens / 1_000_000) * pricing.cached : 0;

  return {
    input: inputCost,
    output: outputCost,
    cached: cachedCost,
    total: inputCost + outputCost + cachedCost,
  };
}

/**
 * Estimate cost before making an API call.
 *
 * Combines token estimation with cost calculation.
 *
 * @param params - Model and content to estimate
 * @returns Estimated cost breakdown
 *
 * @example
 * ```typescript
 * import { estimateCost } from 'chatoyant/tokens';
 *
 * const estimated = estimateCost({
 *   model: 'gpt-4o',
 *   inputText: "Explain quantum computing",
 *   expectedOutputTokens: 500,
 * });
 * ```
 */
export function estimateCost(params: {
  /** Model ID for pricing lookup */
  model: string;
  /** Estimated input tokens (or use inputText) */
  inputTokens?: number;
  /** Input text to estimate tokens from */
  inputText?: string;
  /** Expected output tokens */
  expectedOutputTokens: number;
}): CostResult {
  const { model, inputTokens, inputText, expectedOutputTokens } = params;

  // Estimate input tokens if text provided
  let estimatedInput = inputTokens ?? 0;
  if (inputText && !inputTokens) {
    // Simple estimation: ~4 chars per token
    estimatedInput = Math.ceil(inputText.length / 4);
  }

  return calculateCost({
    model,
    inputTokens: estimatedInput,
    outputTokens: expectedOutputTokens,
  });
}

/**
 * Get the cost per token for a model.
 *
 * @param model - Model ID
 * @returns Cost per single token (not per million)
 */
export function getCostPerToken(
  model: string,
): { input: number; output: number; cached: number } | undefined {
  const pricing = getPricing(model);
  if (!pricing) return undefined;

  return {
    input: pricing.input / 1_000_000,
    output: pricing.output / 1_000_000,
    cached: (pricing.cached ?? 0) / 1_000_000,
  };
}

/**
 * Calculate cost for a batch of requests.
 *
 * @param requests - Array of { inputTokens, outputTokens, cachedTokens? }
 * @param model - Model ID for pricing
 * @returns Aggregated cost breakdown
 */
export function calculateBatchCost(
  requests: Array<{
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
  }>,
  model: string,
): CostResult {
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedTokens = 0;

  for (const req of requests) {
    inputTokens += req.inputTokens;
    outputTokens += req.outputTokens;
    cachedTokens += req.cachedTokens ?? 0;
  }

  return calculateCost({
    model,
    inputTokens,
    outputTokens,
    cachedTokens,
  });
}

// Re-export PRICING for convenience
export { PRICING };
