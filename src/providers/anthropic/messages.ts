/**
 * Anthropic Messages API (non-streaming).
 *
 * @module providers/anthropic/messages
 */

import { type RequestOptions, request } from './request.js';
import type {
  Message,
  MessagesRequest,
  MessagesResponse,
  ResponseContentBlock,
  SystemPrompt,
  TextBlock,
  ToolUseBlock,
} from './types.js';

/**
 * Options for messages requests.
 */
export interface MessagesOptions extends RequestOptions {
  /** Model ID */
  model: string;
  /** Maximum tokens to generate */
  maxTokens: number;
  /** System prompt */
  system?: SystemPrompt;
  /** Sampling temperature */
  temperature?: number;
  /** Additional request parameters */
  requestOptions?: Partial<Omit<MessagesRequest, 'model' | 'messages' | 'max_tokens' | 'stream'>>;
}

/**
 * Create a message (non-streaming).
 *
 * @param messages - Conversation messages
 * @param options - Request options
 * @returns Messages response
 *
 * @example
 * ```typescript
 * const response = await createMessage(
 *   [{ role: 'user', content: 'Hello!' }],
 *   { apiKey: 'sk-...', model: 'claude-sonnet-4-20250514', maxTokens: 1024 }
 * );
 * console.log(response.content[0]);
 * ```
 */
export async function createMessage(
  messages: Message[],
  options: MessagesOptions,
): Promise<MessagesResponse> {
  const { model, maxTokens, system, temperature, requestOptions, ...reqOpts } = options;

  const body: MessagesRequest = {
    model,
    messages,
    max_tokens: maxTokens,
    stream: false,
    ...requestOptions,
  };

  if (system !== undefined) {
    body.system = system;
  }

  if (temperature !== undefined) {
    body.temperature = temperature;
  }

  return request<MessagesResponse>('/messages', body, reqOpts);
}

/**
 * Extract text content from response content blocks.
 */
export function extractText(content: ResponseContentBlock[]): string {
  return content
    .filter((block): block is TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

/**
 * Extract tool uses from response content blocks.
 */
export function extractToolUses(content: ResponseContentBlock[]): ToolUseBlock[] {
  return content.filter((block): block is ToolUseBlock => block.type === 'tool_use');
}

/**
 * Simple message helper that returns just the text content.
 *
 * @param messages - Conversation messages
 * @param options - Request options
 * @returns The assistant's response text
 *
 * @example
 * ```typescript
 * const text = await messageSimple(
 *   [{ role: 'user', content: 'Say hello!' }],
 *   { apiKey: 'sk-...', model: 'claude-sonnet-4-20250514', maxTokens: 1024 }
 * );
 * console.log(text); // "Hello!"
 * ```
 */
export async function messageSimple(
  messages: Message[],
  options: MessagesOptions,
): Promise<string> {
  const response = await createMessage(messages, options);
  return extractText(response.content);
}

/**
 * Message with automatic tool handling.
 *
 * @param messages - Conversation messages
 * @param options - Request options
 * @returns Either text content or tool uses to process
 */
export async function messageWithTools(
  messages: Message[],
  options: MessagesOptions,
): Promise<
  | { type: 'text'; text: string; usage: MessagesResponse['usage'] }
  | { type: 'tool_use'; toolUses: ToolUseBlock[]; usage: MessagesResponse['usage'] }
> {
  const response = await createMessage(messages, options);
  const toolUses = extractToolUses(response.content);

  if (toolUses.length > 0) {
    return {
      type: 'tool_use',
      toolUses,
      usage: response.usage,
    };
  }

  return {
    type: 'text',
    text: extractText(response.content),
    usage: response.usage,
  };
}

/**
 * Create a structured output message using tool use pattern.
 *
 * Anthropic doesn't have native structured outputs, but we can use
 * the tool use pattern to get structured JSON.
 *
 * @param messages - Conversation messages
 * @param schema - JSON Schema for the response
 * @param options - Request options
 * @returns Parsed JSON response matching the schema
 *
 * @example
 * ```typescript
 * const result = await messageStructured<{ name: string; age: number }>(
 *   [{ role: 'user', content: 'Extract: John is 25 years old' }],
 *   {
 *     name: 'extract_person',
 *     description: 'Extract person information',
 *     schema: {
 *       type: 'object',
 *       properties: {
 *         name: { type: 'string' },
 *         age: { type: 'number' }
 *       },
 *       required: ['name', 'age']
 *     }
 *   },
 *   { apiKey: 'sk-...', model: 'claude-sonnet-4-20250514', maxTokens: 1024 }
 * );
 * console.log(result); // { name: 'John', age: 25 }
 * ```
 */
export async function messageStructured<T>(
  messages: Message[],
  schema: { name: string; description?: string; schema: Record<string, unknown> },
  options: MessagesOptions,
): Promise<T> {
  const response = await createMessage(messages, {
    ...options,
    requestOptions: {
      ...options.requestOptions,
      tools: [
        {
          name: schema.name,
          description: schema.description,
          input_schema: {
            type: 'object',
            ...schema.schema,
          },
        },
      ],
      tool_choice: { type: 'tool', name: schema.name },
    },
  });

  const toolUses = extractToolUses(response.content);
  if (toolUses.length === 0) {
    throw new Error('No tool use in response');
  }

  return toolUses[0].input as T;
}
