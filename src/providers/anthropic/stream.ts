/**
 * Server-Sent Events (SSE) parsing for Anthropic streaming responses.
 *
 * @module providers/anthropic/stream
 */

import { AnthropicError } from './errors.js';
import type {
  ResponseContentBlock,
  StopReason,
  StreamEvent,
  ToolUseBlock,
  Usage,
} from './types.js';

/**
 * Parse SSE event from data line.
 */
function parseSSEEvent(eventType: string, data: string): StreamEvent | null {
  if (!data) return null;

  try {
    const parsed = JSON.parse(data);
    return { type: eventType, ...parsed } as StreamEvent;
  } catch {
    throw AnthropicError.invalidResponse(`Failed to parse SSE data: ${data}`);
  }
}

/**
 * Async generator that parses SSE stream from a Response.
 *
 * Anthropic uses a different SSE format than OpenAI:
 * - event: message_start
 * - data: {...}
 *
 * @param response - Fetch Response with SSE body
 * @yields Parsed events from the stream
 */
export async function* parseSSEStream(
  response: Response,
): AsyncGenerator<StreamEvent, void, undefined> {
  const body = response.body;
  if (!body) {
    throw AnthropicError.invalidResponse('Response body is null');
  }

  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let currentEvent = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed) {
          continue;
        }

        if (trimmed.startsWith('event: ')) {
          currentEvent = trimmed.slice(7);
        } else if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          if (currentEvent) {
            const event = parseSSEEvent(currentEvent, data);
            if (event && event.type !== 'ping') {
              yield event;
            }
            currentEvent = '';
          }
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const lines = buffer.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('event: ')) {
          currentEvent = trimmed.slice(7);
        } else if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          if (currentEvent) {
            const event = parseSSEEvent(currentEvent, data);
            if (event && event.type !== 'ping') {
              yield event;
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Accumulated state from streaming events.
 */
export interface StreamAccumulator {
  /** Response ID */
  id: string;
  /** Model used */
  model: string;
  /** Accumulated text content */
  content: string;
  /** Accumulated thinking content (extended thinking) */
  thinking: string;
  /** Accumulated tool uses */
  toolUses: Map<number, ToolUseBlock>;
  /** Tool use JSON being built */
  toolInputJson: Map<number, string>;
  /** Stop reason */
  stopReason: StopReason | null;
  /** Stop sequence */
  stopSequence: string | null;
  /** Usage statistics */
  usage: Usage | null;
  /** Content blocks as they're completed */
  contentBlocks: ResponseContentBlock[];
}

/**
 * Create a new stream accumulator.
 */
export function createAccumulator(): StreamAccumulator {
  return {
    id: '',
    model: '',
    content: '',
    thinking: '',
    toolUses: new Map(),
    toolInputJson: new Map(),
    stopReason: null,
    stopSequence: null,
    usage: null,
    contentBlocks: [],
  };
}

/**
 * Update accumulator with a streaming event.
 */
export function updateAccumulator(acc: StreamAccumulator, event: StreamEvent): void {
  switch (event.type) {
    case 'message_start':
      acc.id = event.message.id;
      acc.model = event.message.model;
      acc.usage = event.message.usage;
      break;

    case 'content_block_start':
      if (event.content_block.type === 'tool_use') {
        acc.toolUses.set(event.index, event.content_block);
        acc.toolInputJson.set(event.index, '');
      }
      break;

    case 'content_block_delta':
      if (event.delta.type === 'text_delta') {
        acc.content += event.delta.text;
      } else if (event.delta.type === 'thinking_delta') {
        acc.thinking += event.delta.thinking;
      } else if (event.delta.type === 'input_json_delta') {
        const existing = acc.toolInputJson.get(event.index) || '';
        acc.toolInputJson.set(event.index, existing + event.delta.partial_json);
      }
      break;

    case 'content_block_stop': {
      // Finalize tool use input
      const toolUse = acc.toolUses.get(event.index);
      const jsonStr = acc.toolInputJson.get(event.index);
      if (toolUse && jsonStr) {
        try {
          toolUse.input = JSON.parse(jsonStr);
        } catch {
          toolUse.input = {};
        }
        acc.contentBlocks.push(toolUse);
      }
      break;
    }

    case 'message_delta':
      acc.stopReason = event.delta.stop_reason;
      acc.stopSequence = event.delta.stop_sequence;
      if (acc.usage && event.usage) {
        acc.usage = {
          ...acc.usage,
          output_tokens: event.usage.output_tokens,
        };
      }
      break;

    case 'error':
      throw new AnthropicError(event.error.message, 0, 'api_error');
  }
}

/**
 * Convert accumulator to tool uses array.
 */
export function accumulatorToToolUses(acc: StreamAccumulator): ToolUseBlock[] {
  return Array.from(acc.toolUses.values());
}

/**
 * Stream events with automatic accumulation.
 */
export async function* streamWithAccumulator(
  response: Response,
): AsyncGenerator<{ event: StreamEvent; accumulated: StreamAccumulator }, void, undefined> {
  const acc = createAccumulator();

  for await (const event of parseSSEStream(response)) {
    updateAccumulator(acc, event);
    yield { event, accumulated: acc };
  }
}
