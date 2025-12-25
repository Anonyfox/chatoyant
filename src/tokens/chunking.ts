/**
 * Text chunking utilities for context management.
 *
 * Split long texts into token-sized chunks for embeddings,
 * or truncate message histories to fit context windows.
 *
 * @module tokens/chunking
 */

import { estimateTokens } from './estimate.js';
import { estimateChatTokens, estimateMessageTokens } from './messages.js';
import type { ChunkOptions, FitOptions, Provider, TokenMessage } from './types.js';

/**
 * Split text into chunks of approximately maxTokens each.
 *
 * Attempts to split on natural boundaries (paragraphs, sentences)
 * rather than mid-word.
 *
 * @param text - Text to split
 * @param options - Chunking options
 * @returns Array of text chunks
 *
 * @example
 * ```typescript
 * import { splitText } from 'chatoyant/tokens';
 *
 * const chunks = splitText(longDocument, {
 *   maxTokens: 512,
 *   overlap: 50,
 * });
 * ```
 */
export function splitText(text: string, options: ChunkOptions): string[] {
  const { maxTokens, overlap = 0, separator } = options;

  if (!text) return [];

  const totalTokens = estimateTokens(text);
  if (totalTokens <= maxTokens) {
    return [text];
  }

  // Determine split points
  const splitPattern =
    separator instanceof RegExp
      ? separator
      : separator
        ? new RegExp(separator, 'g')
        : /\n\n+|\n|(?<=[.!?])\s+/g;

  // Split into segments
  const segments = text.split(splitPattern).filter((s) => s.trim());

  const chunks: string[] = [];
  let currentChunk = '';
  let currentTokens = 0;

  for (const segment of segments) {
    const segmentTokens = estimateTokens(segment);

    // If single segment exceeds max, split it further
    if (segmentTokens > maxTokens) {
      // Flush current chunk
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
        currentTokens = 0;
      }

      // Split large segment by words
      const words = segment.split(/\s+/);
      let wordChunk = '';
      let wordTokens = 0;

      for (const word of words) {
        const wordTokenCount = estimateTokens(`${word} `);
        if (wordTokens + wordTokenCount > maxTokens && wordChunk) {
          chunks.push(wordChunk.trim());
          wordChunk = overlap > 0 ? getOverlapText(wordChunk, overlap) : '';
          wordTokens = estimateTokens(wordChunk);
        }
        wordChunk += `${word} `;
        wordTokens += wordTokenCount;
      }

      if (wordChunk.trim()) {
        currentChunk = wordChunk;
        currentTokens = wordTokens;
      }
      continue;
    }

    // Check if adding this segment exceeds max
    const newTokens = currentTokens + segmentTokens + 1; // +1 for separator
    if (newTokens > maxTokens && currentChunk) {
      chunks.push(currentChunk.trim());

      // Start new chunk with overlap from previous
      if (overlap > 0) {
        currentChunk = `${getOverlapText(currentChunk, overlap)} ${segment}`;
        currentTokens = estimateTokens(currentChunk);
      } else {
        currentChunk = segment;
        currentTokens = segmentTokens;
      }
    } else {
      currentChunk += (currentChunk ? ' ' : '') + segment;
      currentTokens = newTokens;
    }
  }

  // Add remaining chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Get overlap text from the end of a chunk.
 */
function getOverlapText(text: string, overlapTokens: number): string {
  const words = text.trim().split(/\s+/);
  let result = '';
  let tokens = 0;

  // Work backwards to get overlap tokens worth of text
  for (let i = words.length - 1; i >= 0 && tokens < overlapTokens; i--) {
    const wordTokens = estimateTokens(words[i]);
    result = words[i] + (result ? ` ${result}` : '');
    tokens += wordTokens;
  }

  return result;
}

/**
 * Truncate messages to fit within a token budget.
 *
 * Removes oldest messages first (except system message).
 *
 * @param messages - Messages to truncate
 * @param options - Fit options
 * @returns Truncated messages that fit within budget
 *
 * @example
 * ```typescript
 * import { fitMessages } from 'chatoyant/tokens';
 *
 * const fitted = fitMessages(conversationHistory, {
 *   maxTokens: 4000,
 *   reserveForResponse: 1000,
 * });
 * ```
 */
export function fitMessages(messages: TokenMessage[], options: FitOptions): TokenMessage[] {
  const { maxTokens, reserveForResponse = 0, provider = 'openai' } = options;

  const budget = maxTokens - reserveForResponse;

  if (budget <= 0) return [];
  if (messages.length === 0) return [];

  // Check if already fits
  const totalTokens = estimateChatTokens(messages, provider);
  if (totalTokens <= budget) {
    return messages;
  }

  // Separate system message (if any) from rest
  const systemMessage = messages[0]?.role === 'system' ? messages[0] : null;
  const otherMessages = systemMessage ? messages.slice(1) : messages;

  const systemTokens = systemMessage ? estimateMessageTokens(systemMessage, provider) : 0;
  const remainingBudget = budget - systemTokens;

  if (remainingBudget <= 0) {
    // Can't even fit system message
    return systemMessage ? [systemMessage] : [];
  }

  // Add messages from the end (most recent first)
  const result: TokenMessage[] = [];
  let usedTokens = 0;

  for (let i = otherMessages.length - 1; i >= 0; i--) {
    const msg = otherMessages[i];
    const msgTokens = estimateMessageTokens(msg, provider);

    if (usedTokens + msgTokens <= remainingBudget) {
      result.unshift(msg);
      usedTokens += msgTokens;
    } else {
      // Can't fit more messages
      break;
    }
  }

  // Add system message back at the start
  if (systemMessage) {
    result.unshift(systemMessage);
  }

  return result;
}

/**
 * Truncate a single message content to fit token limit.
 *
 * @param content - Message content to truncate
 * @param maxTokens - Maximum tokens allowed
 * @param ellipsis - String to append when truncated (default: '...')
 * @returns Truncated content
 */
export function truncateContent(
  content: string,
  maxTokens: number,
  ellipsis: string = '...',
): string {
  if (!content) return content;

  const tokens = estimateTokens(content);
  if (tokens <= maxTokens) return content;

  // Estimate characters to keep
  const ratio = maxTokens / tokens;
  const targetChars = Math.floor(content.length * ratio) - ellipsis.length;

  if (targetChars <= 0) return ellipsis;

  // Try to break at word boundary
  let truncated = content.slice(0, targetChars);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > targetChars * 0.8) {
    truncated = truncated.slice(0, lastSpace);
  }

  return truncated.trim() + ellipsis;
}

/**
 * Split messages at a token boundary for pagination.
 *
 * @param messages - Messages to split
 * @param tokensPerPage - Tokens per page
 * @param provider - Provider for overhead calculation
 * @returns Array of message page arrays
 */
export function paginateMessages(
  messages: TokenMessage[],
  tokensPerPage: number,
  provider: Provider = 'openai',
): TokenMessage[][] {
  if (messages.length === 0) return [];

  const pages: TokenMessage[][] = [];
  let currentPage: TokenMessage[] = [];
  let currentTokens = 0;

  for (const msg of messages) {
    const msgTokens = estimateMessageTokens(msg, provider);

    if (currentTokens + msgTokens > tokensPerPage && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      currentTokens = 0;
    }

    currentPage.push(msg);
    currentTokens += msgTokens;
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

/**
 * Calculate how many chunks a text will produce.
 *
 * @param text - Text to analyze
 * @param chunkSize - Target tokens per chunk
 * @returns Estimated number of chunks
 */
export function estimateChunkCount(text: string, chunkSize: number): number {
  if (!text || chunkSize <= 0) return 0;
  const tokens = estimateTokens(text);
  return Math.ceil(tokens / chunkSize);
}
