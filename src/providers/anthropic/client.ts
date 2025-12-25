/**
 * Anthropic API Client.
 *
 * Central client that wires together all Anthropic API functionality.
 *
 * @module providers/anthropic/client
 */

import {
  createMessage,
  extractText,
  extractToolUses,
  type MessagesOptions,
  messageSimple,
  messageStructured,
  messageWithTools,
} from './messages.js';
import {
  type MessagesStreamOptions,
  messageStream,
  messageStreamAccumulate,
  messageStreamContent,
  messageStreamReadable,
} from './messages-stream.js';
import { BASE_URL, DEFAULT_TIMEOUT, type RequestOptions } from './request.js';
import type {
  AnyTool,
  Message,
  MessagesResponse,
  StreamEvent,
  ToolUseBlock,
  Usage,
} from './types.js';

/**
 * Anthropic client configuration.
 */
export interface AnthropicClientConfig {
  /** API key (required) */
  apiKey: string;
  /** Base URL override */
  baseUrl?: string;
  /** Default timeout in ms */
  timeout?: number;
  /** Default model */
  defaultModel?: string;
  /** Default max tokens */
  defaultMaxTokens?: number;
  /** Additional headers */
  headers?: Record<string, string>;
  /** Beta features to enable */
  betas?: string[];
}

/**
 * Anthropic API client.
 *
 * @example
 * ```typescript
 * const client = new AnthropicClient({
 *   apiKey: process.env.API_KEY_ANTHROPIC!,
 *   defaultModel: 'claude-sonnet-4-20250514',
 * });
 *
 * // Message
 * const response = await client.message([
 *   { role: 'user', content: 'Hello!' }
 * ]);
 *
 * // Stream
 * for await (const delta of client.streamContent([
 *   { role: 'user', content: 'Tell me a story' }
 * ])) {
 *   process.stdout.write(delta.text);
 * }
 *
 * // Simple
 * const text = await client.messageSimple([
 *   { role: 'user', content: 'Say hi!' }
 * ]);
 * ```
 */
export class AnthropicClient {
  private readonly config: Required<Pick<AnthropicClientConfig, 'apiKey' | 'baseUrl' | 'timeout'>> &
    AnthropicClientConfig;

  constructor(config: AnthropicClientConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl ?? BASE_URL,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
    };
  }

  /**
   * Get base request options.
   */
  private getRequestOptions(): RequestOptions {
    return {
      apiKey: this.config.apiKey,
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: this.config.headers,
      betas: this.config.betas,
    };
  }

  /**
   * Get messages options with defaults.
   */
  private getMessagesOptions(overrides?: Partial<MessagesOptions>): MessagesOptions {
    return {
      ...this.getRequestOptions(),
      model: overrides?.model ?? this.config.defaultModel ?? 'claude-sonnet-4-20250514',
      maxTokens: overrides?.maxTokens ?? this.config.defaultMaxTokens ?? 4096,
      ...overrides,
    };
  }

  // ==========================================================================
  // Message Methods
  // ==========================================================================

  /**
   * Create a message.
   */
  async message(
    messages: Message[],
    options?: Partial<MessagesOptions>,
  ): Promise<MessagesResponse> {
    return createMessage(messages, this.getMessagesOptions(options));
  }

  /**
   * Create a message and return just the text content.
   */
  async messageSimple(messages: Message[], options?: Partial<MessagesOptions>): Promise<string> {
    return messageSimple(messages, this.getMessagesOptions(options));
  }

  /**
   * Message with tool handling.
   */
  async messageWithTools(
    messages: Message[],
    tools: AnyTool[],
    options?: Partial<MessagesOptions>,
  ): Promise<
    | { type: 'text'; text: string; usage: Usage }
    | { type: 'tool_use'; toolUses: ToolUseBlock[]; usage: Usage }
  > {
    return messageWithTools(messages, {
      ...this.getMessagesOptions(options),
      requestOptions: { tools, ...options?.requestOptions },
    });
  }

  /**
   * Message with structured output.
   */
  async messageStructured<T>(
    messages: Message[],
    schema: {
      name: string;
      description?: string;
      schema: Record<string, unknown>;
    },
    options?: Partial<MessagesOptions>,
  ): Promise<T> {
    return messageStructured<T>(messages, schema, this.getMessagesOptions(options));
  }

  // ==========================================================================
  // Streaming Methods
  // ==========================================================================

  /**
   * Stream message events.
   */
  stream(
    messages: Message[],
    options?: Partial<MessagesStreamOptions>,
  ): AsyncGenerator<StreamEvent, void, undefined> {
    return messageStream(messages, {
      ...this.getRequestOptions(),
      model: options?.model ?? this.config.defaultModel ?? 'claude-sonnet-4-20250514',
      maxTokens: options?.maxTokens ?? this.config.defaultMaxTokens ?? 4096,
      ...options,
    });
  }

  /**
   * Stream content deltas.
   */
  streamContent(messages: Message[], options?: Partial<MessagesStreamOptions>) {
    return messageStreamContent(messages, {
      ...this.getRequestOptions(),
      model: options?.model ?? this.config.defaultModel ?? 'claude-sonnet-4-20250514',
      maxTokens: options?.maxTokens ?? this.config.defaultMaxTokens ?? 4096,
      ...options,
    });
  }

  /**
   * Stream and accumulate full response.
   */
  async streamAccumulate(
    messages: Message[],
    options?: Partial<MessagesStreamOptions>,
    onDelta?: (delta: string) => void,
  ) {
    return messageStreamAccumulate(
      messages,
      {
        ...this.getRequestOptions(),
        model: options?.model ?? this.config.defaultModel ?? 'claude-sonnet-4-20250514',
        maxTokens: options?.maxTokens ?? this.config.defaultMaxTokens ?? 4096,
        ...options,
      },
      onDelta,
    );
  }

  /**
   * Create a readable stream of content.
   */
  streamReadable(
    messages: Message[],
    options?: Partial<MessagesStreamOptions>,
  ): ReadableStream<string> {
    return messageStreamReadable(messages, {
      ...this.getRequestOptions(),
      model: options?.model ?? this.config.defaultModel ?? 'claude-sonnet-4-20250514',
      maxTokens: options?.maxTokens ?? this.config.defaultMaxTokens ?? 4096,
      ...options,
    });
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Extract text from response content blocks.
   */
  extractText = extractText;

  /**
   * Extract tool uses from response content blocks.
   */
  extractToolUses = extractToolUses;
}

/**
 * Create an Anthropic client.
 *
 * @param config - Client configuration
 * @returns Anthropic client instance
 */
export function createAnthropicClient(config: AnthropicClientConfig): AnthropicClient {
  return new AnthropicClient(config);
}
