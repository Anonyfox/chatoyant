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
 * Streaming state for fallback <think> tag parsing.
 *
 * Some local servers (e.g. older oMLX configs) emit thinking as
 * <think>...</think> blocks inside the content stream instead of
 * the separate reasoning_content field. This parser detects and
 * extracts those blocks transparently.
 */
interface ThinkingStreamState {
  inThinking: boolean;
  pendingTag: string;
}

const THINK_OPEN = '<think>';
const THINK_CLOSE = '</think>';
const MAX_TAG_LEN = Math.max(THINK_OPEN.length, THINK_CLOSE.length); // 8

/**
 * Process a content chunk, separating thinking from regular content.
 *
 * If reasoning_content is already present in the delta, it is used as-is.
 * Otherwise, falls back to detecting <think>...</think> tags in the content stream.
 */
function splitThinkingAndContent(
  delta: { content?: string; reasoning_content?: string },
  state: ThinkingStreamState,
): { content: string; reasoningContent: string } {
  // If the server already emits reasoning_content, use it directly
  if (delta.reasoning_content) {
    return { content: delta.content ?? '', reasoningContent: delta.reasoning_content };
  }

  const raw = delta.content ?? '';
  if (!raw) return { content: '', reasoningContent: '' };

  let content = '';
  let reasoning = '';
  let i = 0;

  while (i < raw.length) {
    if (!state.inThinking) {
      // Look for <think> opening tag
      if (state.pendingTag) {
        // We have a partial tag prefix buffered
        const combined = state.pendingTag + raw[i];
        state.pendingTag = '';

        if (THINK_OPEN.startsWith(combined)) {
          // Still could be the tag
          if (combined === THINK_OPEN) {
            state.inThinking = true;
            i++;
            continue;
          }
          state.pendingTag = combined;
          i++;
          continue;
        }
        // Not a tag start — emit the buffered chars + current char as content
        content += combined;
        i++;
        continue;
      }

      if (raw[i] === '<') {
        // Check if this could start <think>
        const remaining = raw.slice(i, i + MAX_TAG_LEN);
        if (THINK_OPEN.startsWith(remaining) || remaining.startsWith(THINK_OPEN)) {
          if (raw.slice(i, i + THINK_OPEN.length) === THINK_OPEN) {
            state.inThinking = true;
            i += THINK_OPEN.length;
            continue;
          }
          state.pendingTag = raw[i];
          i++;
          continue;
        }
        content += raw[i];
        i++;
      } else {
        content += raw[i];
        i++;
      }
    } else {
      // Inside thinking block — look for </think>
      if (state.pendingTag) {
        const combined = state.pendingTag + raw[i];
        state.pendingTag = '';

        if (THINK_CLOSE.startsWith(combined)) {
          if (combined === THINK_CLOSE) {
            state.inThinking = false;
            i++;
            continue;
          }
          state.pendingTag = combined;
          i++;
          continue;
        }
        reasoning += combined;
        i++;
        continue;
      }

      if (raw[i] === '<') {
        const remaining = raw.slice(i, i + MAX_TAG_LEN);
        if (THINK_CLOSE.startsWith(remaining) || remaining.startsWith(THINK_CLOSE)) {
          if (raw.slice(i, i + THINK_CLOSE.length) === THINK_CLOSE) {
            state.inThinking = false;
            i += THINK_CLOSE.length;
            continue;
          }
          state.pendingTag = raw[i];
          i++;
          continue;
        }
        reasoning += raw[i];
        i++;
      } else {
        reasoning += raw[i];
        i++;
      }
    }
  }

  return { content, reasoningContent: reasoning };
}

/** Reasoning effort level for GPT-5+ models */
export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high';

/**
 * Options for streaming chat completion requests.
 */
export interface ChatStreamOptions extends RequestOptions {
  /** Model ID */
  model: string;
  /** Sampling temperature (0-2) */
  temperature?: number;
  /** Max tokens to generate */
  maxTokens?: number;
  /** Top-p (nucleus) sampling threshold (0-1) */
  topP?: number;
  /** Stop sequences - generation stops before these strings appear */
  stop?: string | string[];
  /** Deterministic sampling seed for reproducibility */
  seed?: number;
  /** End-user identifier for abuse monitoring */
  user?: string;
  /** Frequency penalty (-2.0 to 2.0) - reduces repetition of frequent tokens */
  frequencyPenalty?: number;
  /** Presence penalty (-2.0 to 2.0) - reduces repetition of any repeated tokens */
  presencePenalty?: number;
  /** Whether to return log probabilities of output tokens */
  logprobs?: boolean;
  /** Number of most likely tokens to return at each position (1-20, requires logprobs) */
  topLogprobs?: number;
  /**
   * Reasoning effort for GPT-5+ models.
   * - 'none': Zero reasoning (GPT-5.1+ only) - fastest, cheapest
   * - 'minimal': Minimal reasoning
   * - 'low': Low reasoning effort
   * - 'medium': Medium reasoning effort (default)
   * - 'high': Maximum reasoning effort
   */
  reasoningEffort?: ReasoningEffort;
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
  /** Incremental reasoning/thinking text (empty when model is not in thinking mode) */
  reasoningContent: string;
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
  const {
    model,
    temperature,
    maxTokens,
    topP,
    stop,
    seed,
    user,
    frequencyPenalty,
    presencePenalty,
    logprobs,
    topLogprobs,
    reasoningEffort,
    includeUsage,
    requestOptions,
    ...reqOpts
  } = options;

  const body: ChatCompletionRequest = {
    model,
    messages,
    stream: true,
    ...requestOptions,
  };

  if (temperature !== undefined) body.temperature = temperature;
  if (maxTokens !== undefined) body.max_tokens = maxTokens;
  if (topP !== undefined) body.top_p = topP;
  if (stop !== undefined) body.stop = stop;
  if (seed !== undefined) body.seed = seed;
  if (user !== undefined) body.user = user;
  if (frequencyPenalty !== undefined) body.frequency_penalty = frequencyPenalty;
  if (presencePenalty !== undefined) body.presence_penalty = presencePenalty;
  if (logprobs !== undefined) body.logprobs = logprobs;
  if (topLogprobs !== undefined) body.top_logprobs = topLogprobs;
  if (reasoningEffort !== undefined) body.reasoning_effort = reasoningEffort;

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
  const thinkingState: ThinkingStreamState = { inThinking: false, pendingTag: '' };

  for await (const chunk of chatStream(messages, { ...options, includeUsage: true })) {
    if (chunk.usage) {
      lastUsage = chunk.usage;
    }

    for (const choice of chunk.choices) {
      const { content, reasoningContent } = splitThinkingAndContent(choice.delta, thinkingState);

      yield {
        content,
        reasoningContent,
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
  reasoningContent: string;
  toolCalls: ReturnType<typeof accumulatorToToolCalls>;
  finishReason: string | null;
  usage: Usage | null;
  model: string;
  id: string;
}> {
  const acc = createAccumulator();
  const thinkingState: ThinkingStreamState = { inThinking: false, pendingTag: '' };

  for await (const chunk of chatStream(messages, { ...options, includeUsage: true })) {
    // Apply fallback <think> parsing before accumulation
    for (const choice of chunk.choices) {
      const { content, reasoningContent } = splitThinkingAndContent(choice.delta, thinkingState);
      // Override delta fields so updateAccumulator gets the split values
      choice.delta.content = content || undefined;
      choice.delta.reasoning_content = reasoningContent || undefined;
    }

    const prevContent = acc.content;
    updateAccumulator(acc, chunk);
    const newContent = acc.content.slice(prevContent.length);

    if (onChunk && newContent) {
      onChunk({ content: newContent, chunk });
    }
  }

  return {
    content: acc.content,
    reasoningContent: acc.reasoningContent,
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
  const thinkingState: ThinkingStreamState = { inThinking: false, pendingTag: '' };

  try {
    for await (const chunk of chatStream(messages, { ...options, includeUsage: true })) {
      for (const choice of chunk.choices) {
        const { content, reasoningContent } = splitThinkingAndContent(choice.delta, thinkingState);
        choice.delta.content = content || undefined;
        choice.delta.reasoning_content = reasoningContent || undefined;
      }

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
      const thinkingState: ThinkingStreamState = { inThinking: false, pendingTag: '' };
      try {
        for await (const chunk of chatStream(messages, options)) {
          for (const choice of chunk.choices) {
            const { content } = splitThinkingAndContent(choice.delta, thinkingState);
            if (content) {
              controller.enqueue(content);
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
