/**
 * Token counting and cost calculation utilities.
 *
 * Zero-dependency utilities for estimating tokens, calculating costs,
 * and managing context windows across LLM providers.
 *
 * @example
 * ```typescript
 * import {
 *   estimateTokens,
 *   estimateChatTokens,
 *   calculateCost,
 *   CONTEXT_WINDOWS,
 *   PRICING,
 *   splitText,
 *   fitMessages,
 * } from 'chatoyant/tokens';
 *
 * // Estimate tokens for text
 * const tokens = estimateTokens("Hello, world!");
 *
 * // Estimate tokens for chat messages
 * const chatTokens = estimateChatTokens([
 *   { role: 'user', content: 'Hello!' }
 * ], 'openai');
 *
 * // Calculate cost
 * const cost = calculateCost({
 *   model: 'gpt-4o',
 *   inputTokens: 1000,
 *   outputTokens: 500,
 * });
 *
 * // Check context window
 * const maxTokens = CONTEXT_WINDOWS['gpt-4o']; // 128000
 *
 * // Split text for embeddings
 * const chunks = splitText(longDocument, { maxTokens: 512 });
 *
 * // Truncate conversation to fit context
 * const fitted = fitMessages(history, {
 *   maxTokens: 4000,
 *   reserveForResponse: 1000,
 * });
 * ```
 *
 * @module tokens
 */

// Text chunking
export {
  estimateChunkCount,
  fitMessages,
  paginateMessages,
  splitText,
  truncateContent,
} from './chunking.js';

// Context windows
export {
  CONTEXT_WINDOWS,
  getContextWindow,
  hasContextWindow,
  type KnownContextModel,
} from './context-windows.js';
// Cost calculation
export {
  calculateBatchCost,
  calculateCost,
  calculateCostCustom,
  estimateCost,
  getCostPerToken,
} from './cost.js';

// Token estimation
export {
  estimatePromptTokens,
  estimateTokens,
  estimateTokensMany,
  estimateTokensWithRatio,
  TOKEN_RATIOS,
} from './estimate.js';
// Message token estimation
export {
  calculateAvailableTokens,
  estimateChatTokens,
  estimateMessageTokens,
  estimateSystemPromptTokens,
  getMessageOverhead,
  messagesFitBudget,
} from './messages.js';
// Pricing
export {
  getPricing,
  hasPricing,
  type KnownPricingModel,
  PRICING,
} from './pricing.js';
// Types
export type {
  ChunkOptions,
  CostResult,
  FitOptions,
  ModelPricing,
  Provider,
  TokenMessage,
} from './types.js';
