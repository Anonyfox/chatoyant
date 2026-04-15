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

// ---------------------------------------------------------------------------
// Pricing data (internal — access via the PRICING proxy export)
// ---------------------------------------------------------------------------

const PRICING_DATA: Record<string, ModelPricing> = {
  // ==========================================================================
  // OpenAI
  // https://platform.openai.com/docs/pricing
  // ==========================================================================

  // GPT-5.4 family (flagship as of March 2026)
  'gpt-5.4': { input: 2.5, output: 15.0, cached: 0.25 },
  'gpt-5.4-mini': { input: 0.75, output: 4.5, cached: 0.075 },
  'gpt-5.4-nano': { input: 0.2, output: 1.25, cached: 0.02 },
  'gpt-5.4-pro': { input: 30.0, output: 180.0 },

  // GPT-5.2 family
  'gpt-5.2': { input: 1.75, output: 14.0, cached: 0.175 },
  'gpt-5.2-pro': { input: 21.0, output: 168.0 },
  'gpt-5.2-codex': { input: 1.75, output: 14.0, cached: 0.175 },

  // GPT-5.1 family
  'gpt-5.1': { input: 1.25, output: 10.0, cached: 0.125 },
  'gpt-5.1-codex': { input: 1.25, output: 10.0, cached: 0.125 },
  'gpt-5.1-codex-max': { input: 1.25, output: 10.0, cached: 0.125 },
  'gpt-5.1-codex-mini': { input: 0.25, output: 2.0, cached: 0.025 },

  // GPT-5 family
  'gpt-5': { input: 1.25, output: 10.0, cached: 0.125 },
  'gpt-5-pro': { input: 15.0, output: 120.0 },
  'gpt-5-mini': { input: 0.25, output: 2.0, cached: 0.025 },
  'gpt-5-nano': { input: 0.05, output: 0.4, cached: 0.005 },
  'gpt-5-codex': { input: 1.25, output: 10.0, cached: 0.125 },
  'gpt-5-image': { input: 10.0, output: 10.0, cached: 1.25 },
  'gpt-5-image-mini': { input: 2.5, output: 2.0, cached: 0.25 },

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
  'gpt-4-turbo': { input: 5.0, output: 15.0 },
  'gpt-4-turbo-2024-04-09': { input: 5.0, output: 15.0 },
  'gpt-4-turbo-preview': { input: 5.0, output: 15.0 },

  // GPT-4
  'gpt-4': { input: 30.0, output: 60.0 },
  'gpt-4-0613': { input: 30.0, output: 60.0 },
  'gpt-4-32k': { input: 60.0, output: 120.0 },

  // GPT-3.5 Turbo
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'gpt-3.5-turbo-0125': { input: 0.5, output: 1.5 },
  'gpt-3.5-turbo-16k': { input: 3.0, output: 4.0 },

  // o1 family (reasoning)
  o1: { input: 15.0, output: 60.0, cached: 7.5 },
  'o1-2024-12-17': { input: 15.0, output: 60.0, cached: 7.5 },
  'o1-preview': { input: 15.0, output: 60.0 },
  'o1-mini': { input: 3.0, output: 12.0 },
  'o1-pro': { input: 150.0, output: 600.0 },

  // o3 family (reasoning)
  o3: { input: 2.0, output: 8.0, cached: 0.5 },
  'o3-2025-04-16': { input: 2.0, output: 8.0, cached: 0.5 },
  'o3-mini': { input: 1.1, output: 4.4, cached: 0.55 },
  'o3-mini-2025-01-31': { input: 1.1, output: 4.4, cached: 0.55 },
  'o3-pro': { input: 20.0, output: 80.0 },
  'o3-deep-research': { input: 10.0, output: 40.0, cached: 2.5 },

  // o4 family (reasoning)
  'o4-mini': { input: 1.1, output: 4.4, cached: 0.275 },
  'o4-mini-deep-research': { input: 2.0, output: 8.0 },

  // Open-source models
  'gpt-oss-120b': { input: 0.039, output: 0.19 },
  'gpt-oss-20b': { input: 0.03, output: 0.14 },

  // Embeddings
  'text-embedding-3-small': { input: 0.02, output: 0 },
  'text-embedding-3-large': { input: 0.13, output: 0 },
  'text-embedding-ada-002': { input: 0.1, output: 0 },

  // ==========================================================================
  // Anthropic
  // https://www.anthropic.com/pricing#anthropic-api
  // ==========================================================================

  // Claude 4.6
  'claude-opus-4-6': {
    input: 5.0,
    output: 25.0,
    cached: 0.5,
    cacheWrite5m: 6.25,
    cacheWrite1h: 10.0,
  },
  'claude-sonnet-4-6': {
    input: 3.0,
    output: 15.0,
    cached: 0.3,
    cacheWrite5m: 3.75,
    cacheWrite1h: 6.0,
  },

  // Claude 4.5
  'claude-opus-4-5-20251101': {
    input: 5.0,
    output: 25.0,
    cached: 0.5,
    cacheWrite5m: 6.25,
    cacheWrite1h: 10.0,
  },
  'claude-opus-4-5': {
    input: 5.0,
    output: 25.0,
    cached: 0.5,
    cacheWrite5m: 6.25,
    cacheWrite1h: 10.0,
  },
  'claude-sonnet-4-5-20250929': {
    input: 3.0,
    output: 15.0,
    cached: 0.3,
    cacheWrite5m: 3.75,
    cacheWrite1h: 6.0,
  },
  'claude-sonnet-4-5': {
    input: 3.0,
    output: 15.0,
    cached: 0.3,
    cacheWrite5m: 3.75,
    cacheWrite1h: 6.0,
  },
  'claude-haiku-4-5-20251001': {
    input: 1.0,
    output: 5.0,
    cached: 0.1,
    cacheWrite5m: 1.25,
    cacheWrite1h: 2.0,
  },
  'claude-haiku-4-5': {
    input: 1.0,
    output: 5.0,
    cached: 0.1,
    cacheWrite5m: 1.25,
    cacheWrite1h: 2.0,
  },

  // Claude 4.1
  'claude-opus-4-1-20250805': {
    input: 15.0,
    output: 75.0,
    cached: 1.5,
    cacheWrite5m: 18.75,
    cacheWrite1h: 30.0,
  },
  'claude-opus-4-1': {
    input: 15.0,
    output: 75.0,
    cached: 1.5,
    cacheWrite5m: 18.75,
    cacheWrite1h: 30.0,
  },

  // Claude 4
  'claude-sonnet-4-20250514': {
    input: 3.0,
    output: 15.0,
    cached: 0.3,
    cacheWrite5m: 3.75,
    cacheWrite1h: 6.0,
  },
  'claude-sonnet-4-0': {
    input: 3.0,
    output: 15.0,
    cached: 0.3,
    cacheWrite5m: 3.75,
    cacheWrite1h: 6.0,
  },
  'claude-opus-4-20250514': {
    input: 15.0,
    output: 75.0,
    cached: 1.5,
    cacheWrite5m: 18.75,
    cacheWrite1h: 30.0,
  },
  'claude-opus-4-0': {
    input: 15.0,
    output: 75.0,
    cached: 1.5,
    cacheWrite5m: 18.75,
    cacheWrite1h: 30.0,
  },

  // Claude 3.5
  'claude-3-5-sonnet-20241022': {
    input: 3.0,
    output: 15.0,
    cached: 0.3,
    cacheWrite5m: 3.75,
    cacheWrite1h: 6.0,
  },
  'claude-3-5-sonnet-20240620': {
    input: 3.0,
    output: 15.0,
    cached: 0.3,
    cacheWrite5m: 3.75,
    cacheWrite1h: 6.0,
  },
  'claude-3-5-haiku-20241022': {
    input: 0.8,
    output: 4.0,
    cached: 0.08,
    cacheWrite5m: 1.0,
    cacheWrite1h: 1.6,
  },

  // Claude 3
  'claude-3-opus-20240229': {
    input: 15.0,
    output: 75.0,
    cached: 1.5,
    cacheWrite5m: 18.75,
    cacheWrite1h: 30.0,
  },
  'claude-3-haiku-20240307': {
    input: 0.25,
    output: 1.25,
    cached: 0.03,
    cacheWrite5m: 0.3,
    cacheWrite1h: 0.5,
  },

  // ==========================================================================
  // xAI (Grok)
  // https://docs.x.ai/docs/models
  // ==========================================================================

  // Grok 4.20 series (current flagship as of March 2026)
  'grok-4.20-0309-reasoning': { input: 2.0, output: 6.0, cached: 0.2 },
  'grok-4.20-0309-non-reasoning': { input: 2.0, output: 6.0, cached: 0.2 },
  'grok-4.20-multi-agent-0309': { input: 2.0, output: 6.0, cached: 0.2 },

  // Grok 4.1 fast series
  'grok-4-1-fast-reasoning': { input: 0.2, output: 0.5, cached: 0.05 },
  'grok-4-1-fast-non-reasoning': { input: 0.2, output: 0.5, cached: 0.05 },

  // Grok 4 family (legacy)
  'grok-4-fast-reasoning': { input: 0.2, output: 0.5, cached: 0.05 },
  'grok-4-fast-non-reasoning': { input: 0.2, output: 0.5, cached: 0.05 },
  'grok-4-0709': { input: 3.0, output: 15.0, cached: 0.75 },
  'grok-4': { input: 3.0, output: 15.0, cached: 0.75 },

  // Grok Code (legacy)
  'grok-code-fast-1': { input: 0.2, output: 1.5, cached: 0.02 },

  // Grok 3 (legacy)
  'grok-3': { input: 3.0, output: 15.0, cached: 0.75 },
  'grok-3-mini': { input: 0.3, output: 0.5, cached: 0.07 },

  // Grok 2 (legacy)
  'grok-2-vision-1212': { input: 2.0, output: 10.0 },

  // Image generation
  'grok-imagine-image': { input: 0, output: 0, perImage: 0.02 },
  'grok-imagine-image-pro': { input: 0, output: 0, perImage: 0.07 },

  // Video generation
  'grok-imagine-video': { input: 0, output: 0, perSecond: 0.05 },

  // Embeddings
  'grok-embedding-1': { input: 0.0, output: 0 },
};

// ---------------------------------------------------------------------------
// Fallback resolution for unknown models
// ---------------------------------------------------------------------------

/**
 * Family patterns mapping model name patterns to a reference model whose
 * pricing is used as a fallback. Ordered: specific patterns first.
 */
const PRICING_FAMILIES: [RegExp, string][] = [
  // Anthropic — tier keyword is always present in the model name
  [/^claude.*opus/, 'claude-opus-4-6'],
  [/^claude.*sonnet/, 'claude-sonnet-4-6'],
  [/^claude.*haiku/, 'claude-haiku-4-5'],

  // OpenAI — sub-variant patterns before the general GPT catch-all
  [/^gpt-.*-nano/, 'gpt-5.4-nano'],
  [/^gpt-.*-mini/, 'gpt-5.4-mini'],
  [/^gpt-.*-pro/, 'gpt-5.4-pro'],
  [/^gpt-.*-codex/, 'gpt-5.2-codex'],
  [/^gpt-\d+o/, 'gpt-4o'],
  [/^gpt-/, 'gpt-5.4'],

  // OpenAI o-series reasoning
  [/^o\d+-mini/, 'o4-mini'],
  [/^o\d+-pro/, 'o3-pro'],
  [/^o\d+/, 'o3'],

  // xAI
  [/^grok-4\.20/, 'grok-4.20-0309-reasoning'],
  [/^grok-.*fast-reasoning/, 'grok-4-1-fast-reasoning'],
  [/^grok-.*fast-non-reasoning/, 'grok-4-1-fast-non-reasoning'],
  [/^grok-.*mini/, 'grok-3-mini'],
  [/^grok-.*code/, 'grok-code-fast-1'],
  [/^grok-imagine-image-pro/, 'grok-imagine-image-pro'],
  [/^grok-imagine-image/, 'grok-imagine-image'],
  [/^grok-imagine-video/, 'grok-imagine-video'],
  [/^grok-/, 'grok-4.20-0309-reasoning'],
];

/**
 * Most expensive known model per provider — the ultimate conservative
 * fallback when a model is recognized as belonging to a provider but
 * doesn't match any family pattern.
 */
const PROVIDER_MAX_MODEL: Record<string, string> = {
  openai: 'o1-pro',
  anthropic: 'claude-opus-4-1',
  xai: 'grok-4-0709',
};

function detectProviderFromName(model: string): string | null {
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('gpt-') || model.startsWith('chatgpt') || /^o\d/.test(model))
    return 'openai';
  if (model.startsWith('grok')) return 'xai';
  return null;
}

function resolveFallbackPricing(model: string): ModelPricing | undefined {
  const lower = model.toLowerCase();

  for (const [pattern, refModel] of PRICING_FAMILIES) {
    if (pattern.test(lower)) {
      return PRICING_DATA[refModel];
    }
  }

  const provider = detectProviderFromName(lower);
  if (provider) {
    const maxModel = PROVIDER_MAX_MODEL[provider];
    if (maxModel) return PRICING_DATA[maxModel];
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Model pricing per 1 million tokens.
 *
 * Backed by a {@link Proxy} so that unknown future models are resolved
 * automatically: first via family-pattern matching (e.g. any future
 * `claude-haiku-*` returns the latest known Haiku pricing), then via
 * the most expensive known model for the detected provider.
 *
 * Enumeration (`Object.keys`, `Object.entries`, `for...in`) only yields
 * explicitly listed models — the fallback is transparent.
 *
 * @example
 * ```typescript
 * import { PRICING } from 'chatoyant/tokens';
 *
 * PRICING['gpt-4o'];            // exact match
 * PRICING['claude-haiku-9-0'];  // family fallback → Haiku 4.5 pricing
 * PRICING['gpt-99'];            // provider fallback → most expensive OpenAI
 * ```
 */
export const PRICING: Record<string, ModelPricing> = new Proxy(PRICING_DATA, {
  get(target, prop, receiver) {
    if (typeof prop !== 'string') {
      return Reflect.get(target, prop, receiver);
    }
    if (prop in target) {
      return target[prop];
    }
    return resolveFallbackPricing(prop);
  },
});

/**
 * Type for known model IDs with explicit pricing entries.
 */
export type KnownPricingModel = keyof typeof PRICING_DATA;

/**
 * Get pricing for a model, with optional fallback.
 *
 * Unknown models are resolved via family-pattern matching first, then
 * via the provider's most expensive known model. The explicit `fallback`
 * parameter is only used when even that resolution yields nothing
 * (i.e. a completely unrecognized model name).
 *
 * @param model - Model ID
 * @param fallback - Fallback pricing if model not found at all
 * @returns Model pricing or fallback
 */
export function getPricing(model: string, fallback?: ModelPricing): ModelPricing | undefined {
  return PRICING[model] ?? fallback;
}

/**
 * Check if a model has explicit pricing in the known models table.
 *
 * Returns `false` for models that would be resolved via fallback.
 * Use `getPricing(model) !== undefined` to check whether *any* pricing
 * (including fallback) is available.
 *
 * @param model - Model ID to check
 * @returns true if model has explicit known pricing
 */
export function hasPricing(model: string): model is KnownPricingModel {
  return model in PRICING_DATA;
}
