/**
 * OpenAI Chat Completions API (non-streaming).
 *
 * @module providers/openai/chat
 */

import { type RequestOptions, request } from './request.js';
import type { ChatCompletion, ChatCompletionRequest, Message } from './types.js';

/** Reasoning effort level for GPT-5+ models */
export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high';

/**
 * Options for chat completion requests.
 */
export interface ChatOptions extends RequestOptions {
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
  /** Number of completions to generate (default: 1) */
  n?: number;
  /**
   * Reasoning effort for GPT-5+ models.
   * - 'none': Zero reasoning (GPT-5.1+ only) - fastest, cheapest
   * - 'minimal': Minimal reasoning
   * - 'low': Low reasoning effort
   * - 'medium': Medium reasoning effort (default)
   * - 'high': Maximum reasoning effort
   */
  reasoningEffort?: ReasoningEffort;
  /** Additional request parameters */
  requestOptions?: Partial<Omit<ChatCompletionRequest, 'model' | 'messages' | 'stream'>>;
}

/**
 * Create a chat completion (non-streaming).
 *
 * @param messages - Conversation messages
 * @param options - Request options
 * @returns Chat completion response
 *
 * @example
 * ```typescript
 * const response = await chat(
 *   [
 *     { role: 'system', content: 'You are a helpful assistant.' },
 *     { role: 'user', content: 'Hello!' }
 *   ],
 *   { apiKey: 'sk-...', model: 'gpt-4o' }
 * );
 * console.log(response.choices[0].message.content);
 * ```
 */
export async function chat(messages: Message[], options: ChatOptions): Promise<ChatCompletion> {
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
    n,
    reasoningEffort,
    requestOptions,
    ...reqOpts
  } = options;

  const body: ChatCompletionRequest = {
    model,
    messages,
    stream: false,
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
  if (n !== undefined) body.n = n;
  if (reasoningEffort !== undefined) body.reasoning_effort = reasoningEffort;

  return request<ChatCompletion>('/chat/completions', body, reqOpts);
}

/**
 * Simple chat helper that returns just the content string.
 *
 * @param messages - Conversation messages
 * @param options - Request options
 * @returns The assistant's response content
 *
 * @example
 * ```typescript
 * const content = await chatSimple(
 *   [{ role: 'user', content: 'Say hello!' }],
 *   { apiKey: 'sk-...', model: 'gpt-4o' }
 * );
 * console.log(content); // "Hello!"
 * ```
 */
export async function chatSimple(messages: Message[], options: ChatOptions): Promise<string> {
  const response = await chat(messages, options);
  return response.choices[0]?.message?.content ?? '';
}

/**
 * Chat with automatic tool handling.
 *
 * Runs a chat completion and if the model wants to call tools,
 * returns the tool calls for the caller to process.
 *
 * @param messages - Conversation messages
 * @param options - Request options
 * @returns Either content string or tool calls to process
 */
export async function chatWithTools(
  messages: Message[],
  options: ChatOptions,
): Promise<
  | { type: 'content'; content: string; usage: ChatCompletion['usage'] }
  | {
      type: 'tool_calls';
      toolCalls: NonNullable<ChatCompletion['choices'][0]['message']['tool_calls']>;
      usage: ChatCompletion['usage'];
    }
> {
  const response = await chat(messages, options);
  const choice = response.choices[0];

  if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
    return {
      type: 'tool_calls',
      toolCalls: choice.message.tool_calls,
      usage: response.usage,
    };
  }

  return {
    type: 'content',
    content: choice?.message?.content ?? '',
    usage: response.usage,
  };
}

/**
 * Create a structured output chat completion.
 *
 * @param messages - Conversation messages
 * @param schema - JSON Schema for the response
 * @param options - Request options
 * @returns Parsed JSON response matching the schema
 *
 * @example
 * ```typescript
 * const result = await chatStructured<{ name: string; age: number }>(
 *   [{ role: 'user', content: 'Extract: John is 25 years old' }],
 *   {
 *     name: 'person',
 *     schema: {
 *       type: 'object',
 *       properties: {
 *         name: { type: 'string' },
 *         age: { type: 'number' }
 *       },
 *       required: ['name', 'age']
 *     }
 *   },
 *   { apiKey: 'sk-...', model: 'gpt-4o' }
 * );
 * console.log(result); // { name: 'John', age: 25 }
 * ```
 */
export async function chatStructured<T>(
  messages: Message[],
  schema: { name: string; description?: string; schema: Record<string, unknown>; strict?: boolean },
  options: ChatOptions,
): Promise<T> {
  const response = await chat(messages, {
    ...options,
    requestOptions: {
      ...options.requestOptions,
      response_format: {
        type: 'json_schema',
        json_schema: schema,
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No content in response');
  }

  return JSON.parse(content) as T;
}
