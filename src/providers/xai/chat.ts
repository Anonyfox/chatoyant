/**
 * xAI Chat Completions API (non-streaming).
 *
 * @module providers/xai/chat
 */

import { type RequestOptions, request } from './request.js';
import type {
  ChatCompletion,
  ChatRequest,
  Message,
  ReasoningEffort,
  ResponseFormat,
  Tool,
  ToolCall,
  ToolChoice,
  Usage,
} from './types.js';

/**
 * Models that support frequency_penalty and presence_penalty.
 * Fast and mini models do not support these parameters.
 */
const MODELS_WITH_PENALTY_SUPPORT = new Set(['grok-2-1212', 'grok-3', 'grok-4-0709']);

/**
 * Check if a model supports frequency/presence penalty parameters.
 */
export function modelSupportsPenalty(model: string): boolean {
  return MODELS_WITH_PENALTY_SUPPORT.has(model);
}

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
    const tips = unsupported.includes('reasoning_effort')
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
 * Options for chat requests.
 */
export interface ChatOptions extends RequestOptions {
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
  /** Number of completions to generate (default: 1) */
  n?: number;
  /** Response format */
  responseFormat?: ResponseFormat;
  /** Reasoning effort for reasoning models (xAI-specific) */
  reasoningEffort?: ReasoningEffort;
  /** Additional request parameters */
  requestOptions?: Partial<Omit<ChatRequest, 'model' | 'messages' | 'stream'>>;
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
 *   [{ role: 'user', content: 'Hello!' }],
 *   { apiKey: 'xai-...', model: 'grok-3' }
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
    user,
    seed,
    logprobs,
    topLogprobs,
    n,
    responseFormat,
    reasoningEffort,
    requestOptions,
    ...reqOpts
  } = options;

  // Filter out unsupported parameters for this model
  const filtered = filterUnsupportedParams(model, requestOptions, reasoningEffort);

  const body: ChatRequest = {
    model,
    messages,
    stream: false,
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
  if (n !== undefined) body.n = n;
  if (responseFormat !== undefined) body.response_format = responseFormat;
  if (filtered.reasoningEffort !== undefined) body.reasoning_effort = filtered.reasoningEffort;

  return request<ChatCompletion>('/chat/completions', body, reqOpts);
}

/**
 * Simple chat helper that returns just the content string.
 *
 * @param messages - Conversation messages
 * @param options - Request options
 * @returns The assistant's response text
 *
 * @example
 * ```typescript
 * const text = await chatSimple(
 *   [{ role: 'user', content: 'Say hello!' }],
 *   { apiKey: 'xai-...', model: 'grok-3' }
 * );
 * console.log(text); // "Hello!"
 * ```
 */
export async function chatSimple(messages: Message[], options: ChatOptions): Promise<string> {
  const response = await chat(messages, options);
  return response.choices[0]?.message.content || '';
}

/**
 * Chat with tools/function calling.
 *
 * @param messages - Conversation messages
 * @param tools - Available tools
 * @param options - Request options
 * @returns Either content or tool calls to process
 */
export async function chatWithTools(
  messages: Message[],
  tools: Tool[],
  options: ChatOptions & { toolChoice?: ToolChoice; parallelToolCalls?: boolean },
): Promise<
  | { type: 'content'; content: string; usage: Usage }
  | { type: 'tool_calls'; toolCalls: ToolCall[]; usage: Usage }
> {
  const { toolChoice, parallelToolCalls, ...chatOpts } = options;

  const response = await chat(messages, {
    ...chatOpts,
    requestOptions: {
      ...chatOpts.requestOptions,
      tools,
      tool_choice: toolChoice,
      parallel_tool_calls: parallelToolCalls,
    },
  });

  const choice = response.choices[0];
  const toolCalls = choice?.message.tool_calls;

  if (toolCalls && toolCalls.length > 0) {
    return {
      type: 'tool_calls',
      toolCalls,
      usage: response.usage,
    };
  }

  return {
    type: 'content',
    content: choice?.message.content || '',
    usage: response.usage,
  };
}

/**
 * Chat with web search enabled.
 * xAI-specific: uses built-in web_search tool.
 *
 * @param messages - Conversation messages
 * @param options - Request options
 * @returns Chat completion with potential web search results
 *
 * @example
 * ```typescript
 * const response = await chatWithWebSearch(
 *   [{ role: 'user', content: 'What happened in the news today?' }],
 *   { apiKey: 'xai-...', model: 'grok-3' }
 * );
 * ```
 */
export async function chatWithWebSearch(
  messages: Message[],
  options: ChatOptions,
): Promise<ChatCompletion> {
  return chat(messages, {
    ...options,
    requestOptions: {
      ...options.requestOptions,
      tools: [{ type: 'web_search' }, ...(options.requestOptions?.tools || [])],
    },
  });
}

/**
 * Chat with structured JSON output.
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
 *     name: 'extract_person',
 *     schema: {
 *       type: 'object',
 *       properties: {
 *         name: { type: 'string' },
 *         age: { type: 'number' }
 *       },
 *       required: ['name', 'age']
 *     }
 *   },
 *   { apiKey: 'xai-...', model: 'grok-3' }
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
    responseFormat: {
      type: 'json_schema',
      json_schema: schema,
    },
  });

  const content = response.choices[0]?.message.content;
  if (!content) {
    throw new Error('No content in response');
  }

  return JSON.parse(content) as T;
}
