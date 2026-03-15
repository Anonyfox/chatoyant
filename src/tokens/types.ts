/**
 * Types for token counting and cost calculation.
 *
 * @module tokens/types
 */

/**
 * Supported LLM providers.
 */
export type Provider = 'openai' | 'anthropic' | 'xai';

/**
 * Model pricing information (per 1 million tokens).
 *
 * For media generation models (image, video), token-based fields
 * (`input`, `output`) are 0 and pricing is via `perImage` or `perSecond`.
 */
export interface ModelPricing {
  /** Cost per 1M input tokens in USD */
  input: number;
  /** Cost per 1M output tokens in USD */
  output: number;
  /** Cost per 1M cached input tokens in USD (if supported) */
  cached?: number;
  /** Cost per generated image in USD (for image generation models) */
  perImage?: number;
  /** Cost per second of generated video in USD (for video generation models) */
  perSecond?: number;
}

/**
 * Result of a cost calculation.
 * All values are in USD.
 */
export interface CostResult {
  /** Cost for input tokens */
  input: number;
  /** Cost for output tokens */
  output: number;
  /** Cost for cached tokens (0 if not applicable) */
  cached: number;
  /** Total cost (input + output + cached) */
  total: number;
}

/**
 * Options for text chunking.
 */
export interface ChunkOptions {
  /** Target maximum tokens per chunk */
  maxTokens: number;
  /** Number of tokens to overlap between chunks (default: 0) */
  overlap?: number;
  /** Preferred separator to split on (default: paragraph, then sentence) */
  separator?: string | RegExp;
}

/**
 * Options for fitting messages to context.
 */
export interface FitOptions {
  /** Maximum total tokens allowed */
  maxTokens: number;
  /** Tokens to reserve for model response (default: 0) */
  reserveForResponse?: number;
  /** Provider for accurate overhead calculation (default: 'openai') */
  provider?: Provider;
}

/**
 * A chat message for token estimation.
 */
export interface TokenMessage {
  role: string;
  content: string | null;
  name?: string;
}
