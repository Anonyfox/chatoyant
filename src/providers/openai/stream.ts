/**
 * Server-Sent Events (SSE) parsing for OpenAI streaming responses.
 *
 * @module providers/openai/stream
 */

import { OpenAIError } from './errors.js';
import type { ChatCompletionChunk, Usage } from './types.js';

/**
 * Parse SSE data line into JSON.
 */
function parseSSEData<T>(data: string): T | null {
  if (data === '[DONE]') {
    return null;
  }
  try {
    return JSON.parse(data) as T;
  } catch {
    throw OpenAIError.invalidResponse(`Failed to parse SSE data: ${data}`);
  }
}

/**
 * Async generator that parses SSE stream from a Response.
 *
 * @param response - Fetch Response with SSE body
 * @yields Parsed chunks from the stream
 *
 * @example
 * ```typescript
 * const response = await fetch(...);
 * for await (const chunk of parseSSEStream<ChatCompletionChunk>(response)) {
 *   console.log(chunk.choices[0]?.delta?.content);
 * }
 * ```
 */
export async function* parseSSEStream<T>(response: Response): AsyncGenerator<T, void, undefined> {
  const body = response.body;
  if (!body) {
    throw OpenAIError.invalidResponse('Response body is null');
  }

  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Split buffer into lines
      const lines = buffer.split('\n');
      // Keep incomplete line in buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith(':')) {
          continue;
        }

        // Parse data lines
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          const parsed = parseSSEData<T>(data);
          if (parsed !== null) {
            yield parsed;
          }
        }
      }
    }

    // Process any remaining data in buffer
    if (buffer.trim()) {
      const lines = buffer.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          const parsed = parseSSEData<T>(data);
          if (parsed !== null) {
            yield parsed;
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
  /** Accumulated content text */
  content: string;
  /** Accumulated tool calls */
  toolCalls: Map<number, { id: string; name: string; arguments: string }>;
  /** Finish reason (set when stream ends) */
  finishReason: string | null;
  /** Usage (set in final chunk if include_usage is true) */
  usage: Usage | null;
  /** Model used */
  model: string;
  /** Response ID */
  id: string;
}

/**
 * Create a new stream accumulator.
 */
export function createAccumulator(): StreamAccumulator {
  return {
    content: '',
    toolCalls: new Map(),
    finishReason: null,
    usage: null,
    model: '',
    id: '',
  };
}

/**
 * Update accumulator with a streaming chunk.
 */
export function updateAccumulator(acc: StreamAccumulator, chunk: ChatCompletionChunk): void {
  // Update metadata
  if (chunk.id) acc.id = chunk.id;
  if (chunk.model) acc.model = chunk.model;
  if (chunk.usage) acc.usage = chunk.usage;

  // Process choices
  for (const choice of chunk.choices) {
    // Update finish reason
    if (choice.finish_reason) {
      acc.finishReason = choice.finish_reason;
    }

    // Accumulate content
    if (choice.delta.content) {
      acc.content += choice.delta.content;
    }

    // Accumulate tool calls
    if (choice.delta.tool_calls) {
      for (const tc of choice.delta.tool_calls) {
        const existing = acc.toolCalls.get(tc.index);
        if (existing) {
          // Append to existing tool call
          if (tc.function?.arguments) {
            existing.arguments += tc.function.arguments;
          }
        } else {
          // Start new tool call
          acc.toolCalls.set(tc.index, {
            id: tc.id || '',
            name: tc.function?.name || '',
            arguments: tc.function?.arguments || '',
          });
        }
      }
    }
  }
}

/**
 * Convert accumulator to tool calls array.
 */
export function accumulatorToToolCalls(
  acc: StreamAccumulator,
): Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> {
  return Array.from(acc.toolCalls.values()).map((tc) => ({
    id: tc.id,
    type: 'function' as const,
    function: {
      name: tc.name,
      arguments: tc.arguments,
    },
  }));
}

/**
 * Stream chunks with automatic accumulation.
 *
 * @param response - Fetch Response with SSE body
 * @yields Each chunk plus the current accumulated state
 */
export async function* streamWithAccumulator(
  response: Response,
): AsyncGenerator<{ chunk: ChatCompletionChunk; accumulated: StreamAccumulator }, void, undefined> {
  const acc = createAccumulator();

  for await (const chunk of parseSSEStream<ChatCompletionChunk>(response)) {
    updateAccumulator(acc, chunk);
    yield { chunk, accumulated: acc };
  }
}
