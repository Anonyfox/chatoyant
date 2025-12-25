/**
 * Anthropic Messages API (streaming).
 *
 * @module providers/anthropic/messages-stream
 */

import { type RequestOptions, requestRaw } from './request.js';
import {
  accumulatorToToolUses,
  createAccumulator,
  parseSSEStream,
  type StreamAccumulator,
  updateAccumulator,
} from './stream.js';
import type {
  Message,
  MessagesRequest,
  StreamEvent,
  SystemPrompt,
  ToolUseBlock,
  Usage,
} from './types.js';

/**
 * Options for streaming messages requests.
 */
export interface MessagesStreamOptions extends RequestOptions {
  /** Model ID */
  model: string;
  /** Maximum tokens to generate */
  maxTokens: number;
  /** System prompt */
  system?: SystemPrompt;
  /** Sampling temperature (0-1) */
  temperature?: number;
  /**
   * Top-p (nucleus) sampling threshold (0-1).
   * Maps to Anthropic's `top_p` parameter.
   */
  topP?: number;
  /**
   * Top-k sampling - only sample from the top K options.
   * Anthropic-specific feature not available in OpenAI/xAI.
   * Maps to Anthropic's `top_k` parameter.
   */
  topK?: number;
  /**
   * Stop sequences - stops generation when any of these strings are encountered.
   * Alias for Anthropic's `stop_sequences` parameter for API consistency with OpenAI/xAI.
   */
  stop?: string[];
  /**
   * End-user identifier for abuse monitoring and analytics.
   * Maps to Anthropic's `metadata.user_id` parameter.
   */
  user?: string;
  /** Additional request parameters */
  requestOptions?: Partial<Omit<MessagesRequest, 'model' | 'messages' | 'max_tokens' | 'stream'>>;
}

/**
 * Streamed content delta.
 */
export interface StreamDelta {
  /** Incremental text content */
  text: string;
  /** Incremental thinking content (extended thinking) */
  thinking: string;
  /** Whether this is the final event */
  done: boolean;
  /** Stop reason (only set on final event) */
  stopReason: string | null;
  /** Usage (only set on final event) */
  usage: Usage | null;
}

/**
 * Stream message events.
 *
 * @param messages - Conversation messages
 * @param options - Request options
 * @yields Stream events as they arrive
 *
 * @example
 * ```typescript
 * for await (const event of messageStream(messages, options)) {
 *   if (event.type === 'content_block_delta') {
 *     process.stdout.write(event.delta.text || '');
 *   }
 * }
 * ```
 */
export async function* messageStream(
  messages: Message[],
  options: MessagesStreamOptions,
): AsyncGenerator<StreamEvent, void, undefined> {
  const {
    model,
    maxTokens,
    system,
    temperature,
    topP,
    topK,
    stop,
    user,
    requestOptions,
    ...reqOpts
  } = options;

  // Validate max_tokens > budget_tokens when using extended thinking
  const thinking = requestOptions?.thinking;
  if (thinking && thinking.type === 'enabled' && thinking.budget_tokens >= maxTokens) {
    throw new Error(
      `[chatoyant/anthropic] max_tokens (${maxTokens}) must be greater than thinking.budget_tokens (${thinking.budget_tokens}). ` +
        `Increase maxTokens to at least ${thinking.budget_tokens + 1}.`,
    );
  }

  const body: MessagesRequest = {
    model,
    messages,
    max_tokens: maxTokens,
    stream: true,
    ...requestOptions,
  };

  if (system !== undefined) {
    body.system = system;
  }

  if (temperature !== undefined) {
    body.temperature = temperature;
  }

  // Map topP/topK to Anthropic's parameter names
  if (topP !== undefined) {
    body.top_p = topP;
  }

  if (topK !== undefined) {
    body.top_k = topK;
  }

  // Map `stop` to Anthropic's `stop_sequences` for API consistency
  if (stop !== undefined && stop.length > 0) {
    body.stop_sequences = stop;
  }

  // Map `user` to Anthropic's `metadata.user_id` for API consistency with OpenAI/xAI
  if (user !== undefined) {
    body.metadata = { ...body.metadata, user_id: user };
  }

  const response = await requestRaw('/messages', body, reqOpts);

  for await (const event of parseSSEStream(response)) {
    yield event;
  }
}

/**
 * Stream just the content deltas (simplified interface).
 *
 * @param messages - Conversation messages
 * @param options - Request options
 * @yields Content deltas as they arrive
 *
 * @example
 * ```typescript
 * for await (const delta of messageStreamContent(messages, options)) {
 *   process.stdout.write(delta.text);
 *   if (delta.done) {
 *     console.log('\nUsage:', delta.usage);
 *   }
 * }
 * ```
 */
export async function* messageStreamContent(
  messages: Message[],
  options: MessagesStreamOptions,
): AsyncGenerator<StreamDelta, void, undefined> {
  let usage: Usage | null = null;
  let stopReason: string | null = null;

  for await (const event of messageStream(messages, options)) {
    if (event.type === 'message_start') {
      usage = event.message.usage;
    } else if (event.type === 'content_block_delta') {
      yield {
        text: event.delta.type === 'text_delta' ? event.delta.text : '',
        thinking: event.delta.type === 'thinking_delta' ? event.delta.thinking : '',
        done: false,
        stopReason: null,
        usage: null,
      };
    } else if (event.type === 'message_delta') {
      stopReason = event.delta.stop_reason;
      if (usage) {
        usage = {
          input_tokens: usage.input_tokens,
          output_tokens: event.usage.output_tokens,
          cache_creation_input_tokens: usage.cache_creation_input_tokens,
          cache_read_input_tokens: usage.cache_read_input_tokens,
        };
      }
    } else if (event.type === 'message_stop') {
      yield {
        text: '',
        thinking: '',
        done: true,
        stopReason,
        usage,
      };
    }
  }
}

/**
 * Stream and accumulate the full response.
 *
 * @param messages - Conversation messages
 * @param options - Request options
 * @param onDelta - Optional callback for each text delta
 * @returns Accumulated response
 *
 * @example
 * ```typescript
 * const result = await messageStreamAccumulate(
 *   messages,
 *   options,
 *   (delta) => process.stdout.write(delta)
 * );
 * console.log('Full content:', result.content);
 * console.log('Usage:', result.usage);
 * ```
 */
export async function messageStreamAccumulate(
  messages: Message[],
  options: MessagesStreamOptions,
  onDelta?: (delta: string) => void,
): Promise<{
  content: string;
  thinking: string;
  toolUses: ToolUseBlock[];
  stopReason: string | null;
  usage: Usage | null;
  model: string;
  id: string;
}> {
  const acc = createAccumulator();

  for await (const event of messageStream(messages, options)) {
    const prevContent = acc.content;
    updateAccumulator(acc, event);
    const newContent = acc.content.slice(prevContent.length);

    if (onDelta && newContent) {
      onDelta(newContent);
    }
  }

  return {
    content: acc.content,
    thinking: acc.thinking,
    toolUses: accumulatorToToolUses(acc),
    stopReason: acc.stopReason,
    usage: acc.usage,
    model: acc.model,
    id: acc.id,
  };
}

/**
 * Stream to a writable stream.
 *
 * @param messages - Conversation messages
 * @param options - Request options
 * @param writable - WritableStream to pipe content to
 * @returns Final accumulated state
 */
export async function messageStreamToWritable(
  messages: Message[],
  options: MessagesStreamOptions,
  writable: WritableStream<string>,
): Promise<StreamAccumulator> {
  const writer = writable.getWriter();
  const acc = createAccumulator();

  try {
    for await (const event of messageStream(messages, options)) {
      const prevContent = acc.content;
      updateAccumulator(acc, event);
      const newContent = acc.content.slice(prevContent.length);

      if (newContent) {
        await writer.write(newContent);
      }
    }
  } finally {
    await writer.close();
  }

  return acc;
}

/**
 * Create a ReadableStream from message streaming.
 *
 * @param messages - Conversation messages
 * @param options - Request options
 * @returns ReadableStream of content strings
 */
export function messageStreamReadable(
  messages: Message[],
  options: MessagesStreamOptions,
): ReadableStream<string> {
  return new ReadableStream<string>({
    async start(controller) {
      try {
        for await (const event of messageStream(messages, options)) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(event.delta.text);
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
