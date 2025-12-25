/**
 * xAI Chat Completions API (streaming).
 *
 * @module providers/xai/chat-stream
 */

import { modelSupportsPenalty } from './chat.js';
import { type RequestOptions, requestRaw } from './request.js';
import {
  accumulatorToToolCalls,
  createAccumulator,
  parseSSEStream,
  type StreamDelta,
  updateAccumulator,
} from './stream.js';
import type {
  ChatCompletionChunk,
  ChatRequest,
  Message,
  ReasoningEffort,
  ResponseFormat,
  Tool,
  ToolChoice,
  Usage,
} from './types.js';

/**
 * Filter out unsupported parameters for a given model.
 * Logs a warning if parameters are removed.
 *
 * - `frequency_penalty` / `presence_penalty`: Only supported by grok-2, grok-3, grok-4-0709
 * - `reasoning_effort`: Not supported by any xAI model (reasoning is baked into model choice)
 */
function filterUnsupportedParams(
  model: string,
  requestOptions?: Partial<ChatRequest>,
  reasoningEffort?: ReasoningEffort,
): { requestOptions?: Partial<ChatRequest>; reasoningEffort?: ReasoningEffort } {
  const filtered: Partial<ChatRequest> = requestOptions ? { ...requestOptions } : {};
  const unsupported: string[] = [];
  let filteredReasoning = reasoningEffort;

  // Filter penalty params for unsupported models
  if (!modelSupportsPenalty(model)) {
    if (filtered.frequency_penalty !== undefined) {
      unsupported.push('frequency_penalty');
      delete filtered.frequency_penalty;
    }
    if (filtered.presence_penalty !== undefined) {
      unsupported.push('presence_penalty');
      delete filtered.presence_penalty;
    }
  }

  // reasoning_effort is not supported by any xAI model - reasoning is baked into model choice
  if (reasoningEffort !== undefined) {
    unsupported.push('reasoning_effort');
    filteredReasoning = undefined;
  }

  if (unsupported.length > 0) {
    const tips =
      unsupported.includes('reasoning_effort')
        ? ' Tip: Use model names like "grok-4-1-fast-reasoning" or "grok-4-1-fast-non-reasoning" to control reasoning.'
        : '';
    console.warn(
      `[chatoyant/xai] Model "${model}" does not support: ${unsupported.join(', ')}. These parameters were ignored.${tips}`,
    );
  }

  return {
    requestOptions: Object.keys(filtered).length > 0 ? filtered : undefined,
    reasoningEffort: filteredReasoning,
  };
}

/**
 * Options for streaming chat requests.
 */
export interface ChatStreamOptions extends RequestOptions {
  /** Model ID */
  model: string;
  /** Sampling temperature */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Top-p sampling */
  topP?: number;
  /** Stop sequences */
  stop?: string | string[];
  /** End-user identifier */
  user?: string;
  /** Deterministic sampling seed */
  seed?: number;
  /** Whether to return log probabilities of output tokens */
  logprobs?: boolean;
  /** Number of most likely tokens to return at each position (1-20, requires logprobs) */
  topLogprobs?: number;
  /** Include usage in final chunk */
  includeUsage?: boolean;
  /** Response format */
  responseFormat?: ResponseFormat;
  /** Reasoning effort for reasoning models (xAI-specific) */
  reasoningEffort?: ReasoningEffort;
  /** Tools for function calling */
  tools?: Tool[];
  /** Tool selection strategy */
  toolChoice?: ToolChoice;
  /** Additional request parameters */
  requestOptions?: Partial<Omit<ChatRequest, 'model' | 'messages' | 'stream'>>;
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
    user,
    seed,
    logprobs,
    topLogprobs,
    includeUsage,
    responseFormat,
    reasoningEffort,
    tools,
    toolChoice,
    requestOptions,
    ...reqOpts
  } = options;

  // Filter out unsupported parameters for this model
  const filtered = filterUnsupportedParams(model, requestOptions, reasoningEffort);

  const body: ChatRequest = {
    model,
    messages,
    stream: true,
    ...filtered.requestOptions,
  };

  if (temperature !== undefined) body.temperature = temperature;
  if (maxTokens !== undefined) body.max_tokens = maxTokens;
  if (topP !== undefined) body.top_p = topP;
  if (stop !== undefined) body.stop = stop;
  if (user !== undefined) body.user = user;
  if (seed !== undefined) body.seed = seed;
  if (logprobs !== undefined) body.logprobs = logprobs;
  if (topLogprobs !== undefined) body.top_logprobs = topLogprobs;
  if (includeUsage) body.stream_options = { include_usage: true };
  if (responseFormat !== undefined) body.response_format = responseFormat;
  if (filtered.reasoningEffort !== undefined) body.reasoning_effort = filtered.reasoningEffort;
  if (tools !== undefined) body.tools = tools;
  if (toolChoice !== undefined) body.tool_choice = toolChoice;

  const response = await requestRaw('/chat/completions', body, reqOpts);

  for await (const chunk of parseSSEStream(response)) {
    yield chunk;
  }
}

/**
 * Stream just content deltas (simplified interface).
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
  for await (const chunk of chatStream(messages, { ...options, includeUsage: true })) {
    const choice = chunk.choices[0];
    if (!choice) continue;

    yield {
      content: choice.delta.content || '',
      done: choice.finish_reason !== null,
      finishReason: choice.finish_reason,
      usage: chunk.usage || null,
      toolCalls: choice.delta.tool_calls || null,
    };
  }
}

/**
 * Stream and accumulate the full response.
 *
 * @param messages - Conversation messages
 * @param options - Request options
 * @param onDelta - Optional callback for each content delta
 * @returns Accumulated response
 *
 * @example
 * ```typescript
 * const result = await chatStreamAccumulate(
 *   messages,
 *   options,
 *   (delta) => process.stdout.write(delta)
 * );
 * console.log('Full content:', result.content);
 * console.log('Usage:', result.usage);
 * ```
 */
export async function chatStreamAccumulate(
  messages: Message[],
  options: ChatStreamOptions,
  onDelta?: (delta: string) => void,
): Promise<{
  content: string;
  toolCalls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
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

    if (onDelta && newContent) {
      onDelta(newContent);
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
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            controller.enqueue(content);
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
