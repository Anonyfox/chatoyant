/**
 * Server-Sent Events (SSE) parsing for xAI streaming responses.
 *
 * xAI uses OpenAI-compatible SSE format:
 * - data: {...}
 * - data: [DONE]
 *
 * @module providers/xai/stream
 */

import { XAIError } from './errors.js';
import type { ChatCompletionChunk, FinishReason, ToolCallDelta, Usage } from './types.js';

/**
 * Async generator that parses SSE stream from a Response.
 *
 * @param response - Fetch Response with SSE body
 * @yields Parsed chunks from the stream
 */
export async function* parseSSEStream(
  response: Response,
): AsyncGenerator<ChatCompletionChunk, void, undefined> {
  const body = response.body;
  if (!body) {
    throw XAIError.invalidResponse('Response body is null');
  }

  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith(':')) {
          continue;
        }

        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            return;
          }

          try {
            const chunk = JSON.parse(data) as ChatCompletionChunk;
            yield chunk;
          } catch {
            throw XAIError.invalidResponse(`Failed to parse SSE data: ${data}`);
          }
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const lines = buffer.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            return;
          }

          try {
            const chunk = JSON.parse(data) as ChatCompletionChunk;
            yield chunk;
          } catch {
            throw XAIError.invalidResponse(`Failed to parse SSE data: ${data}`);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Accumulated state from streaming chunks.
 */
export interface StreamAccumulator {
  /** Response ID */
  id: string;
  /** Model used */
  model: string;
  /** Accumulated text content */
  content: string;
  /** Accumulated tool calls */
  toolCalls: Map<
    number,
    { id: string; type: 'function'; function: { name: string; arguments: string } }
  >;
  /** Finish reason */
  finishReason: FinishReason | null;
  /** Usage statistics (from final chunk) */
  usage: Usage | null;
  /** System fingerprint */
  systemFingerprint: string | null;
}

/**
 * Create a new stream accumulator.
 */
export function createAccumulator(): StreamAccumulator {
  return {
    id: '',
    model: '',
    content: '',
    toolCalls: new Map(),
    finishReason: null,
    usage: null,
    systemFingerprint: null,
  };
}

/**
 * Update accumulator with a streaming chunk.
 */
export function updateAccumulator(acc: StreamAccumulator, chunk: ChatCompletionChunk): void {
  if (chunk.id) acc.id = chunk.id;
  if (chunk.model) acc.model = chunk.model;
  if (chunk.system_fingerprint) acc.systemFingerprint = chunk.system_fingerprint;
  if (chunk.usage) acc.usage = chunk.usage;

  for (const choice of chunk.choices) {
    if (choice.finish_reason) {
      acc.finishReason = choice.finish_reason;
    }

    const delta = choice.delta;

    if (delta.content) {
      acc.content += delta.content;
    }

    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const existing = acc.toolCalls.get(tc.index);
        if (existing) {
          if (tc.function?.arguments) {
            existing.function.arguments += tc.function.arguments;
          }
        } else {
          acc.toolCalls.set(tc.index, {
            id: tc.id || '',
            type: 'function',
            function: {
              name: tc.function?.name || '',
              arguments: tc.function?.arguments || '',
            },
          });
        }
      }
    }
  }
}

/**
 * Convert accumulated tool calls to array format.
 */
export function accumulatorToToolCalls(
  acc: StreamAccumulator,
): Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> {
  return Array.from(acc.toolCalls.values());
}

/**
 * Stream delta for simpler content streaming.
 */
export interface StreamDelta {
  /** Incremental text content */
  content: string;
  /** Whether this is the final chunk */
  done: boolean;
  /** Finish reason (only set on final chunk) */
  finishReason: FinishReason | null;
  /** Usage (only set on final chunk if stream_options.include_usage was true) */
  usage: Usage | null;
  /** Tool call deltas if any */
  toolCalls: ToolCallDelta[] | null;
}
