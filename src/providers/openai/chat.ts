/**
 * OpenAI Chat Completions API (non-streaming).
 *
 * @module providers/openai/chat
 */

import { type RequestOptions, request } from './request.js';
import type { ChatCompletion, ChatCompletionRequest, Message } from './types.js';

/**
 * Options for chat completion requests.
 */
export interface ChatOptions extends RequestOptions {
  /** Model ID */
  model: string;
  /** Sampling temperature */
  temperature?: number;
  /** Max tokens to generate */
  maxTokens?: number;
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
  const { model, temperature, maxTokens, requestOptions, ...reqOpts } = options;

  const body: ChatCompletionRequest = {
    model,
    messages,
    stream: false,
    ...requestOptions,
  };

  if (temperature !== undefined) {
    body.temperature = temperature;
  }

  if (maxTokens !== undefined) {
    body.max_tokens = maxTokens;
  }

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
