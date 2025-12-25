/**
 * OpenAI API Client.
 *
 * Central client that wires together all OpenAI API functionality.
 *
 * @module providers/openai/client
 */

import { type ChatOptions, chat, chatSimple, chatStructured, chatWithTools } from './chat.js';
import {
  type ChatStreamOptions,
  chatStream,
  chatStreamAccumulate,
  chatStreamContent,
  chatStreamReadable,
} from './chat-stream.js';
import { type EmbeddingOptions, embed, embedMany, embedOne } from './embeddings.js';
import {
  generateImage,
  generateImageBase64,
  generateImages,
  generateImageUrl,
  type ImageGenerationOptions,
} from './images.js';
import { getModel, listModelIds, listModels, modelExists } from './models.js';
import { BASE_URL, DEFAULT_TIMEOUT, type RequestOptions } from './request.js';
import type {
  ChatCompletion,
  ChatCompletionChunk,
  EmbeddingResponse,
  ImageGenerationResponse,
  Message,
  Model,
  ModelsResponse,
  Tool,
} from './types.js';

/**
 * OpenAI client configuration.
 */
export interface OpenAIClientConfig {
  /** API key (required) */
  apiKey: string;
  /** Base URL override */
  baseUrl?: string;
  /** Default timeout in ms */
  timeout?: number;
  /** Default model for chat */
  defaultModel?: string;
  /** Default model for embeddings */
  defaultEmbeddingModel?: string;
  /** Default model for images */
  defaultImageModel?: string;
  /** Additional headers */
  headers?: Record<string, string>;
}

/**
 * OpenAI API client.
 *
 * @example
 * ```typescript
 * const client = new OpenAIClient({
 *   apiKey: process.env.API_KEY_OPENAI!,
 *   defaultModel: 'gpt-4o',
 * });
 *
 * // Chat
 * const response = await client.chat([
 *   { role: 'user', content: 'Hello!' }
 * ]);
 *
 * // Stream
 * for await (const chunk of client.stream([
 *   { role: 'user', content: 'Tell me a story' }
 * ])) {
 *   process.stdout.write(chunk.content);
 * }
 *
 * // Embeddings
 * const vector = await client.embedOne('Hello, world!');
 *
 * // Images
 * const url = await client.generateImageUrl('A sunset over mountains');
 * ```
 */
export class OpenAIClient {
  private readonly config: Required<Pick<OpenAIClientConfig, 'apiKey' | 'baseUrl' | 'timeout'>> &
    OpenAIClientConfig;

  constructor(config: OpenAIClientConfig) {
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
    };
  }

  /**
   * Get chat options with defaults.
   */
  private getChatOptions(overrides?: Partial<ChatOptions>): ChatOptions {
    return {
      ...this.getRequestOptions(),
      model: overrides?.model ?? this.config.defaultModel ?? 'gpt-4o',
      ...overrides,
    };
  }

  /**
   * Get embedding options with defaults.
   */
  private getEmbeddingOptions(overrides?: Partial<EmbeddingOptions>): EmbeddingOptions {
    return {
      ...this.getRequestOptions(),
      model: overrides?.model ?? this.config.defaultEmbeddingModel ?? 'text-embedding-3-small',
      ...overrides,
    };
  }

  /**
   * Get image options with defaults.
   */
  private getImageOptions(overrides?: Partial<ImageGenerationOptions>): ImageGenerationOptions {
    return {
      ...this.getRequestOptions(),
      model: overrides?.model ?? this.config.defaultImageModel,
      ...overrides,
    };
  }

  // ==========================================================================
  // Chat Methods
  // ==========================================================================

  /**
   * Create a chat completion.
   */
  async chat(messages: Message[], options?: Partial<ChatOptions>): Promise<ChatCompletion> {
    return chat(messages, this.getChatOptions(options));
  }

  /**
   * Create a chat completion and return just the content.
   */
  async chatSimple(messages: Message[], options?: Partial<ChatOptions>): Promise<string> {
    return chatSimple(messages, this.getChatOptions(options));
  }

  /**
   * Chat with tool handling.
   */
  async chatWithTools(messages: Message[], tools: Tool[], options?: Partial<ChatOptions>) {
    return chatWithTools(messages, {
      ...this.getChatOptions(options),
      requestOptions: { tools, ...options?.requestOptions },
    });
  }

  /**
   * Chat with structured output.
   */
  async chatStructured<T>(
    messages: Message[],
    schema: {
      name: string;
      description?: string;
      schema: Record<string, unknown>;
      strict?: boolean;
    },
    options?: Partial<ChatOptions>,
  ): Promise<T> {
    return chatStructured<T>(messages, schema, this.getChatOptions(options));
  }

  // ==========================================================================
  // Streaming Methods
  // ==========================================================================

  /**
   * Stream chat completion chunks.
   */
  stream(
    messages: Message[],
    options?: Partial<ChatStreamOptions>,
  ): AsyncGenerator<ChatCompletionChunk, void, undefined> {
    return chatStream(messages, {
      ...this.getRequestOptions(),
      model: options?.model ?? this.config.defaultModel ?? 'gpt-4o',
      ...options,
    });
  }

  /**
   * Stream content deltas.
   */
  streamContent(messages: Message[], options?: Partial<ChatStreamOptions>) {
    return chatStreamContent(messages, {
      ...this.getRequestOptions(),
      model: options?.model ?? this.config.defaultModel ?? 'gpt-4o',
      ...options,
    });
  }

  /**
   * Stream and accumulate full response.
   */
  async streamAccumulate(
    messages: Message[],
    options?: Partial<ChatStreamOptions>,
    onChunk?: (delta: { content: string; chunk: ChatCompletionChunk }) => void,
  ) {
    return chatStreamAccumulate(
      messages,
      {
        ...this.getRequestOptions(),
        model: options?.model ?? this.config.defaultModel ?? 'gpt-4o',
        ...options,
      },
      onChunk,
    );
  }

  /**
   * Create a readable stream of content.
   */
  streamReadable(
    messages: Message[],
    options?: Partial<ChatStreamOptions>,
  ): ReadableStream<string> {
    return chatStreamReadable(messages, {
      ...this.getRequestOptions(),
      model: options?.model ?? this.config.defaultModel ?? 'gpt-4o',
      ...options,
    });
  }

  // ==========================================================================
  // Embedding Methods
  // ==========================================================================

  /**
   * Create embeddings.
   */
  async embed(
    input: string | string[],
    options?: Partial<EmbeddingOptions>,
  ): Promise<EmbeddingResponse> {
    return embed(input, this.getEmbeddingOptions(options));
  }

  /**
   * Create embedding for single text.
   */
  async embedOne(input: string, options?: Partial<EmbeddingOptions>): Promise<number[]> {
    return embedOne(input, this.getEmbeddingOptions(options));
  }

  /**
   * Create embeddings for multiple texts.
   */
  async embedMany(inputs: string[], options?: Partial<EmbeddingOptions>): Promise<number[][]> {
    return embedMany(inputs, this.getEmbeddingOptions(options));
  }

  // ==========================================================================
  // Image Methods
  // ==========================================================================

  /**
   * Generate images.
   */
  async generateImage(
    prompt: string,
    options?: Partial<ImageGenerationOptions>,
  ): Promise<ImageGenerationResponse> {
    return generateImage(prompt, this.getImageOptions(options));
  }

  /**
   * Generate a single image URL.
   */
  async generateImageUrl(
    prompt: string,
    options?: Partial<ImageGenerationOptions>,
  ): Promise<string> {
    return generateImageUrl(prompt, this.getImageOptions(options));
  }

  /**
   * Generate a single image as base64.
   */
  async generateImageBase64(
    prompt: string,
    options?: Partial<ImageGenerationOptions>,
  ): Promise<string> {
    return generateImageBase64(prompt, this.getImageOptions(options));
  }

  /**
   * Generate multiple images.
   */
  async generateImages(prompt: string, count: number, options?: Partial<ImageGenerationOptions>) {
    return generateImages(prompt, count, this.getImageOptions(options));
  }

  // ==========================================================================
  // Model Methods
  // ==========================================================================

  /**
   * List all available models.
   */
  async listModels(): Promise<ModelsResponse> {
    return listModels(this.getRequestOptions());
  }

  /**
   * Get model details.
   */
  async getModel(modelId: string): Promise<Model> {
    return getModel(modelId, this.getRequestOptions());
  }

  /**
   * List model IDs.
   */
  async listModelIds(): Promise<string[]> {
    return listModelIds(this.getRequestOptions());
  }

  /**
   * Check if a model exists.
   */
  async modelExists(modelId: string): Promise<boolean> {
    return modelExists(modelId, this.getRequestOptions());
  }
}

/**
 * Create an OpenAI client.
 *
 * @param config - Client configuration
 * @returns OpenAI client instance
 */
export function createOpenAIClient(config: OpenAIClientConfig): OpenAIClient {
  return new OpenAIClient(config);
}
