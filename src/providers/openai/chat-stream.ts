/**
 * OpenAI Chat Completions API (streaming).
 *
 * @module providers/openai/chat-stream
 */

import { type RequestOptions, requestRaw } from './request.js';
import {
  accumulatorToToolCalls,
  createAccumulator,
  parseSSEStream,
  type StreamAccumulator,
  updateAccumulator,
} from './stream.js';
import type { ChatCompletionChunk, ChatCompletionRequest, Message, Usage } from './types.js';

/**
 * Options for streaming chat completion requests.
 */
export interface ChatStreamOptions extends RequestOptions {
  /** Model ID */
  model: string;
  /** Sampling temperature */
  temperature?: number;
  /** Max tokens to generate */
  maxTokens?: number;
  /** Include usage in final chunk */
  includeUsage?: boolean;
  /** Additional request parameters */
  requestOptions?: Partial<Omit<ChatCompletionRequest, 'model' | 'messages' | 'stream'>>;
}

/**
 * Streamed content delta.
 */
export interface StreamDelta {
  /** Incremental content text */
  content: string;
  /** Whether this is the final chunk */
  done: boolean;
  /** Finish reason (only set on final chunk) */
  finishReason: string | null;
  /** Usage (only set if includeUsage was true) */
  usage: Usage | null;
}

/**
 * Stream chat completion chunks.
 *
 * @param messages - Conversation messages
 * @param options - Request options
 * @yields Chat completion chunks as they arrive
 *
 * @example
 * ```typescript
 * for await (const chunk of chatStream(messages, options)) {
 *   const content = chunk.choices[0]?.delta?.content;
 *   if (content) process.stdout.write(content);
 * }
 * ```
 */
export async function* chatStream(
  messages: Message[],
  options: ChatStreamOptions,
): AsyncGenerator<ChatCompletionChunk, void, undefined> {
  const { model, temperature, maxTokens, includeUsage, requestOptions, ...reqOpts } = options;

  const body: ChatCompletionRequest = {
    model,
    messages,
    stream: true,
    ...requestOptions,
  };

  if (temperature !== undefined) {
    body.temperature = temperature;
  }

  if (maxTokens !== undefined) {
    body.max_tokens = maxTokens;
  }

  if (includeUsage) {
    body.stream_options = { include_usage: true };
  }

  const response = await requestRaw('/chat/completions', body, reqOpts);

  for await (const chunk of parseSSEStream<ChatCompletionChunk>(response)) {
    yield chunk;
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
 * for await (const delta of chatStreamContent(messages, options)) {
 *   process.stdout.write(delta.content);
 *   if (delta.done) {
 *     console.log('\nUsage:', delta.usage);
 *   }
 * }
 * ```
 */
export async function* chatStreamContent(
  messages: Message[],
  options: ChatStreamOptions,
): AsyncGenerator<StreamDelta, void, undefined> {
  let lastUsage: Usage | null = null;

  for await (const chunk of chatStream(messages, { ...options, includeUsage: true })) {
    if (chunk.usage) {
      lastUsage = chunk.usage;
    }

    for (const choice of chunk.choices) {
      const content = choice.delta.content ?? '';

      yield {
        content,
        done: choice.finish_reason !== null,
        finishReason: choice.finish_reason,
        usage: choice.finish_reason !== null ? lastUsage : null,
      };
    }
  }
}

/**
 * Stream and accumulate the full response.
 *
 * @param messages - Conversation messages
 * @param options - Request options
 * @param onChunk - Optional callback for each chunk
 * @returns Accumulated response
 *
 * @example
 * ```typescript
 * const result = await chatStreamAccumulate(
 *   messages,
 *   options,
 *   (chunk) => process.stdout.write(chunk.content)
 * );
 * console.log('Full content:', result.content);
 * console.log('Usage:', result.usage);
 * ```
 */
export async function chatStreamAccumulate(
  messages: Message[],
  options: ChatStreamOptions,
  onChunk?: (delta: { content: string; chunk: ChatCompletionChunk }) => void,
): Promise<{
  content: string;
  toolCalls: ReturnType<typeof accumulatorToToolCalls>;
  finishReason: string | null;
  usage: Usage | null;
  model: string;
  id: string;
}> {
  const acc = createAccumulator();

  for await (const chunk of chatStream(messages, { ...options, includeUsage: true })) {
    const prevContent = acc.content;
    updateAccumulator(acc, chunk);
    const newContent = acc.content.slice(prevContent.length);

    if (onChunk && newContent) {
      onChunk({ content: newContent, chunk });
    }
  }

  return {
    content: acc.content,
    toolCalls: accumulatorToToolCalls(acc),
    finishReason: acc.finishReason,
    usage: acc.usage,
    model: acc.model,
    id: acc.id,
  };
}

/**
 * Stream to a writable stream (e.g., HTTP response).
 *
 * @param messages - Conversation messages
 * @param options - Request options
 * @param writable - WritableStream to pipe content to
 * @returns Final accumulated state
 */
export async function chatStreamToWritable(
  messages: Message[],
  options: ChatStreamOptions,
  writable: WritableStream<string>,
): Promise<StreamAccumulator> {
  const writer = writable.getWriter();
  const acc = createAccumulator();

  try {
    for await (const chunk of chatStream(messages, { ...options, includeUsage: true })) {
      const prevContent = acc.content;
      updateAccumulator(acc, chunk);
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
 * Create a ReadableStream from chat streaming.
 *
 * @param messages - Conversation messages
 * @param options - Request options
 * @returns ReadableStream of content strings
 */
export function chatStreamReadable(
  messages: Message[],
  options: ChatStreamOptions,
): ReadableStream<string> {
  return new ReadableStream<string>({
    async start(controller) {
      try {
        for await (const chunk of chatStream(messages, options)) {
          for (const choice of chunk.choices) {
            if (choice.delta.content) {
              controller.enqueue(choice.delta.content);
            }
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
