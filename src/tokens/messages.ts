/**
 * Token estimation for chat messages.
 *
 * Chat message formats add overhead tokens for role markers,
 * separators, and other metadata. This module accounts for
 * provider-specific formatting.
 *
 * @module tokens/messages
 */

import { estimateTokens } from './estimate.js';
import type { Provider, TokenMessage } from './types.js';

/**
 * Per-message overhead tokens by provider.
 *
 * These account for role markers, separators, and formatting.
 * Based on empirical analysis of each provider's tokenization.
 */
const MESSAGE_OVERHEAD: Record<Provider, number> = {
  // OpenAI: <|im_start|>role\n...<|im_end|>\n
  openai: 4,
  // Anthropic: \n\nHuman: ... \n\nAssistant:
  anthropic: 3,
  // xAI: Similar to OpenAI format
  xai: 4,
} as const;

/**
 * Base overhead for the entire conversation by provider.
 *
 * This is added once per request, not per message.
 */
const CONVERSATION_OVERHEAD: Record<Provider, number> = {
  // OpenAI: <|im_start|>assistant\n at the end
  openai: 3,
  // Anthropic: Final \n\nAssistant:
  anthropic: 3,
  // xAI: Similar to OpenAI
  xai: 3,
} as const;

/**
 * Estimate tokens for a single chat message.
 *
 * Includes provider-specific overhead for role markers.
 *
 * @param message - Message to estimate
 * @param provider - Provider for overhead calculation
 * @returns Estimated token count
 *
 * @example
 * ```typescript
 * const tokens = estimateMessageTokens(
 *   { role: 'user', content: 'Hello!' },
 *   'openai'
 * );
 * // ~6 tokens (2 for content + 4 overhead)
 * ```
 */
export function estimateMessageTokens(
  message: TokenMessage,
  provider: Provider = 'openai',
): number {
  const overhead = MESSAGE_OVERHEAD[provider];
  const contentTokens = message.content ? estimateTokens(message.content) : 0;

  // Name field adds tokens if present
  const nameTokens = message.name ? estimateTokens(message.name) + 1 : 0;

  return overhead + contentTokens + nameTokens;
}

/**
 * Estimate tokens for an array of chat messages.
 *
 * Includes per-message overhead and conversation overhead.
 *
 * @param messages - Messages to estimate
 * @param provider - Provider for overhead calculation
 * @returns Total estimated token count
 *
 * @example
 * ```typescript
 * import { estimateChatTokens } from 'chatoyant/tokens';
 *
 * const tokens = estimateChatTokens([
 *   { role: 'system', content: 'You are helpful.' },
 *   { role: 'user', content: 'Hello!' },
 * ], 'openai');
 * // ~15 tokens
 * ```
 */
export function estimateChatTokens(
  messages: TokenMessage[],
  provider: Provider = 'openai',
): number {
  if (messages.length === 0) return 0;

  const messageTokens = messages.reduce(
    (sum, msg) => sum + estimateMessageTokens(msg, provider),
    0,
  );

  const conversationOverhead = CONVERSATION_OVERHEAD[provider];

  return messageTokens + conversationOverhead;
}

/**
 * Get overhead tokens for the message format.
 *
 * @param provider - Provider to get overhead for
 * @returns Object with per-message and conversation overhead
 */
export function getMessageOverhead(provider: Provider = 'openai'): {
  perMessage: number;
  conversation: number;
} {
  return {
    perMessage: MESSAGE_OVERHEAD[provider],
    conversation: CONVERSATION_OVERHEAD[provider],
  };
}

/**
 * Estimate how many tokens a system prompt will use.
 *
 * System prompts are always included in every request,
 * so this helps budget remaining context.
 *
 * @param systemPrompt - The system prompt content
 * @param provider - Provider for overhead calculation
 * @returns Estimated token count for system prompt
 */
export function estimateSystemPromptTokens(
  systemPrompt: string,
  provider: Provider = 'openai',
): number {
  return estimateMessageTokens({ role: 'system', content: systemPrompt }, provider);
}

/**
 * Calculate remaining tokens for user messages.
 *
 * @param params - Context window and usage parameters
 * @returns Tokens available for user content
 *
 * @example
 * ```typescript
 * const available = calculateAvailableTokens({
 *   contextWindow: 128000,
 *   systemPromptTokens: 500,
 *   reserveForResponse: 4000,
 * });
 * // 123500
 * ```
 */
export function calculateAvailableTokens(params: {
  /** Total context window size */
  contextWindow: number;
  /** Tokens used by system prompt */
  systemPromptTokens?: number;
  /** Tokens to reserve for model response */
  reserveForResponse?: number;
  /** Tokens already used by conversation history */
  historyTokens?: number;
}): number {
  const {
    contextWindow,
    systemPromptTokens = 0,
    reserveForResponse = 0,
    historyTokens = 0,
  } = params;

  return Math.max(0, contextWindow - systemPromptTokens - reserveForResponse - historyTokens);
}

/**
 * Check if messages fit within a token budget.
 *
 * @param messages - Messages to check
 * @param maxTokens - Maximum allowed tokens
 * @param provider - Provider for overhead calculation
 * @returns true if messages fit within budget
 */
export function messagesFitBudget(
  messages: TokenMessage[],
  maxTokens: number,
  provider: Provider = 'openai',
): boolean {
  return estimateChatTokens(messages, provider) <= maxTokens;
}
