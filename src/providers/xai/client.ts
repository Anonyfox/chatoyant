/**
 * xAI API Client.
 *
 * Central client that wires together all xAI API functionality.
 *
 * @module providers/xai/client
 */

import {
  type ChatOptions,
  chat,
  chatSimple,
  chatStructured,
  chatWithTools,
  chatWithWebSearch,
} from './chat.js';
import {
  type ChatStreamOptions,
  chatStream,
  chatStreamAccumulate,
  chatStreamContent,
  chatStreamReadable,
} from './chat-stream.js';
import {
  cosineSimilarity,
  type EmbeddingOptions,
  embed,
  embedMany,
  embedOne,
  findSimilar,
} from './embeddings.js';
import {
  editImage,
  editImageBase64,
  editImageUrl,
  editMultipleImages,
  generateImage,
  generateImageBase64,
  generateImages,
  generateImageUrl,
  generateImageWithPrompt,
  type ImageEditOptions,
  type ImageGenerationOptions,
} from './images.js';
import {
  getImageGenerationModel,
  getLanguageModel,
  getModel,
  listImageGenerationModels,
  listLanguageModels,
  listModels,
  modelExists,
} from './models.js';
import { BASE_URL, DEFAULT_TIMEOUT, type RequestOptions } from './request.js';
import type {
  ChatCompletion,
  ChatCompletionChunk,
  EmbeddingResponse,
  ImageData,
  ImageGenerationModel,
  ImageGenerationModelsResponse,
  ImageGenerationResponse,
  LanguageModel,
  LanguageModelsResponse,
  Message,
  Model,
  ModelsResponse,
  Tool,
  ToolCall,
  ToolChoice,
  Usage,
  VideoGenerationStatusResponse,
} from './types.js';
import {
  editVideo,
  generateVideo,
  generateVideoFromImage,
  generateVideoUrl,
  getVideoStatus,
  startVideoGeneration,
  type VideoGenerationOptions,
  type VideoGenerationResult,
  type VideoPollingOptions,
} from './videos.js';

/**
 * xAI client configuration.
 */
export interface XAIClientConfig {
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
  /** Default model for image generation */
  defaultImageModel?: string;
  /** Default model for video generation */
  defaultVideoModel?: string;
  /** Additional headers */
  headers?: Record<string, string>;
}

/**
 * xAI API client.
 *
 * @example
 * ```typescript
 * const client = new XAIClient({
 *   apiKey: process.env.API_KEY_XAI!,
 *   defaultModel: 'grok-3',
 * });
 *
 * // Chat
 * const text = await client.chatSimple([
 *   { role: 'user', content: 'Hello!' }
 * ]);
 *
 * // Stream
 * for await (const delta of client.streamContent([
 *   { role: 'user', content: 'Tell me a story' }
 * ])) {
 *   process.stdout.write(delta.content);
 * }
 *
 * // Web search (xAI-specific)
 * const response = await client.chatWithWebSearch([
 *   { role: 'user', content: 'What happened in the news today?' }
 * ]);
 * ```
 */
export class XAIClient {
  private readonly config: Required<Pick<XAIClientConfig, 'apiKey' | 'baseUrl' | 'timeout'>> &
    XAIClientConfig;

  constructor(config: XAIClientConfig) {
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
      model: overrides?.model ?? this.config.defaultModel ?? 'grok-3',
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
   * Create a chat completion and return just the text content.
   */
  async chatSimple(messages: Message[], options?: Partial<ChatOptions>): Promise<string> {
    return chatSimple(messages, this.getChatOptions(options));
  }

  /**
   * Chat with tools/function calling.
   */
  async chatWithTools(
    messages: Message[],
    tools: Tool[],
    options?: Partial<ChatOptions> & { toolChoice?: ToolChoice; parallelToolCalls?: boolean },
  ): Promise<
    | { type: 'content'; content: string; usage: Usage }
    | { type: 'tool_calls'; toolCalls: ToolCall[]; usage: Usage }
  > {
    const { toolChoice, parallelToolCalls, ...chatOpts } = options || {};
    return chatWithTools(messages, tools, {
      ...this.getChatOptions(chatOpts),
      toolChoice,
      parallelToolCalls,
    });
  }

  /**
   * Chat with web search enabled (xAI-specific).
   */
  async chatWithWebSearch(
    messages: Message[],
    options?: Partial<ChatOptions>,
  ): Promise<ChatCompletion> {
    return chatWithWebSearch(messages, this.getChatOptions(options));
  }

  /**
   * Chat with structured JSON output.
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
      model: options?.model ?? this.config.defaultModel ?? 'grok-3',
      ...options,
    });
  }

  /**
   * Stream content deltas.
   */
  streamContent(messages: Message[], options?: Partial<ChatStreamOptions>) {
    return chatStreamContent(messages, {
      ...this.getRequestOptions(),
      model: options?.model ?? this.config.defaultModel ?? 'grok-3',
      ...options,
    });
  }

  /**
   * Stream and accumulate full response.
   */
  async streamAccumulate(
    messages: Message[],
    options?: Partial<ChatStreamOptions>,
    onDelta?: (delta: string) => void,
  ) {
    return chatStreamAccumulate(
      messages,
      {
        ...this.getRequestOptions(),
        model: options?.model ?? this.config.defaultModel ?? 'grok-3',
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
    options?: Partial<ChatStreamOptions>,
  ): ReadableStream<string> {
    return chatStreamReadable(messages, {
      ...this.getRequestOptions(),
      model: options?.model ?? this.config.defaultModel ?? 'grok-3',
      ...options,
    });
  }

  // ==========================================================================
  // Embedding Methods
  // ==========================================================================

  /**
   * Generate embeddings for text input.
   */
  async embed(
    input: string | string[],
    options?: Partial<EmbeddingOptions>,
  ): Promise<EmbeddingResponse> {
    return embed(input, {
      ...this.getRequestOptions(),
      model: options?.model ?? this.config.defaultEmbeddingModel ?? 'grok-embedding-1',
      ...options,
    });
  }

  /**
   * Generate embedding for a single text.
   */
  async embedOne(text: string, options?: Partial<EmbeddingOptions>): Promise<number[]> {
    return embedOne(text, {
      ...this.getRequestOptions(),
      model: options?.model ?? this.config.defaultEmbeddingModel ?? 'grok-embedding-1',
      ...options,
    });
  }

  /**
   * Generate embeddings for multiple texts.
   */
  async embedMany(texts: string[], options?: Partial<EmbeddingOptions>): Promise<number[][]> {
    return embedMany(texts, {
      ...this.getRequestOptions(),
      model: options?.model ?? this.config.defaultEmbeddingModel ?? 'grok-embedding-1',
      ...options,
    });
  }

  // ==========================================================================
  // Image Generation Methods
  // ==========================================================================

  private getImageOptions(overrides?: Partial<ImageGenerationOptions>): ImageGenerationOptions {
    return {
      ...this.getRequestOptions(),
      model: overrides?.model ?? this.config.defaultImageModel ?? 'grok-imagine-image',
      ...overrides,
    };
  }

  /**
   * Generate images from a prompt.
   */
  async generateImage(
    prompt: string,
    options?: Partial<ImageGenerationOptions>,
  ): Promise<ImageGenerationResponse> {
    return generateImage(prompt, this.getImageOptions(options));
  }

  /**
   * Generate a single image and return its URL.
   */
  async generateImageUrl(
    prompt: string,
    options?: Partial<ImageGenerationOptions>,
  ): Promise<string> {
    return generateImageUrl(prompt, this.getImageOptions(options));
  }

  /**
   * Generate a single image and return its base64 data.
   */
  async generateImageBase64(
    prompt: string,
    options?: Partial<ImageGenerationOptions>,
  ): Promise<string> {
    return generateImageBase64(prompt, this.getImageOptions(options));
  }

  /**
   * Generate multiple images from a single prompt.
   */
  async generateImages(
    prompt: string,
    count: number,
    options?: Partial<ImageGenerationOptions>,
  ): Promise<ImageData[]> {
    return generateImages(prompt, count, this.getImageOptions(options));
  }

  /**
   * Generate image and return both URL and revised prompt.
   */
  async generateImageWithPrompt(
    prompt: string,
    options?: Partial<ImageGenerationOptions>,
  ): Promise<{ url: string; revisedPrompt: string }> {
    return generateImageWithPrompt(prompt, this.getImageOptions(options));
  }

  // ==========================================================================
  // Image Editing Methods
  // ==========================================================================

  private getImageEditOptions(overrides?: Partial<ImageEditOptions>): ImageEditOptions {
    return {
      ...this.getRequestOptions(),
      model: overrides?.model ?? this.config.defaultImageModel ?? 'grok-imagine-image',
      ...overrides,
    };
  }

  /**
   * Edit an existing image with natural language instructions.
   */
  async editImage(
    prompt: string,
    imageUrl: string,
    options?: Partial<ImageEditOptions>,
  ): Promise<ImageGenerationResponse> {
    return editImage(prompt, imageUrl, this.getImageEditOptions(options));
  }

  /**
   * Edit an image and return just the URL.
   */
  async editImageUrl(
    prompt: string,
    imageUrl: string,
    options?: Partial<ImageEditOptions>,
  ): Promise<string> {
    return editImageUrl(prompt, imageUrl, this.getImageEditOptions(options));
  }

  /**
   * Edit an image and return base64 data.
   */
  async editImageBase64(
    prompt: string,
    imageUrl: string,
    options?: Partial<ImageEditOptions>,
  ): Promise<string> {
    return editImageBase64(prompt, imageUrl, this.getImageEditOptions(options));
  }

  /**
   * Edit with multiple source images (up to 3).
   */
  async editMultipleImages(
    prompt: string,
    imageUrls: string[],
    options?: Partial<ImageEditOptions>,
  ): Promise<ImageGenerationResponse> {
    return editMultipleImages(prompt, imageUrls, this.getImageEditOptions(options));
  }

  // ==========================================================================
  // Model Methods
  // ==========================================================================

  /**
   * List all models (OpenAI-compatible).
   */
  async listModels(): Promise<ModelsResponse> {
    return listModels(this.getRequestOptions());
  }

  /**
   * Get a specific model (OpenAI-compatible).
   */
  async getModel(modelId: string): Promise<Model> {
    return getModel(modelId, this.getRequestOptions());
  }

  /**
   * Check if a model exists.
   */
  async modelExists(modelId: string): Promise<boolean> {
    return modelExists(modelId, this.getRequestOptions());
  }

  /**
   * List language models with detailed information (xAI-specific).
   */
  async listLanguageModels(): Promise<LanguageModelsResponse> {
    return listLanguageModels(this.getRequestOptions());
  }

  /**
   * Get a specific language model (xAI-specific).
   */
  async getLanguageModel(modelId: string): Promise<LanguageModel> {
    return getLanguageModel(modelId, this.getRequestOptions());
  }

  /**
   * List image generation models (xAI-specific).
   */
  async listImageGenerationModels(): Promise<ImageGenerationModelsResponse> {
    return listImageGenerationModels(this.getRequestOptions());
  }

  /**
   * Get a specific image generation model (xAI-specific).
   */
  async getImageGenerationModel(modelId: string): Promise<ImageGenerationModel> {
    return getImageGenerationModel(modelId, this.getRequestOptions());
  }

  // ==========================================================================
  // Video Generation Methods
  // ==========================================================================

  private getVideoOptions(overrides?: Partial<VideoGenerationOptions>): VideoGenerationOptions {
    return {
      ...this.getRequestOptions(),
      model: overrides?.model ?? this.config.defaultVideoModel ?? 'grok-imagine-video',
      ...overrides,
    };
  }

  /**
   * Generate a video and wait for completion (handles polling automatically).
   *
   * Video generation is asynchronous and can take several minutes.
   * This method handles polling automatically.
   */
  async generateVideo(
    prompt: string,
    options?: Partial<VideoGenerationOptions>,
    pollingOptions?: VideoPollingOptions,
  ): Promise<VideoGenerationResult> {
    return generateVideo(prompt, this.getVideoOptions(options), pollingOptions);
  }

  /**
   * Generate a video and return just the URL.
   */
  async generateVideoUrl(
    prompt: string,
    options?: Partial<VideoGenerationOptions>,
    pollingOptions?: VideoPollingOptions,
  ): Promise<string> {
    return generateVideoUrl(prompt, this.getVideoOptions(options), pollingOptions);
  }

  /**
   * Generate a video from a still image (image-to-video).
   */
  async generateVideoFromImage(
    prompt: string,
    imageUrl: string,
    options?: Partial<VideoGenerationOptions>,
    pollingOptions?: VideoPollingOptions,
  ): Promise<VideoGenerationResult> {
    return generateVideoFromImage(prompt, imageUrl, this.getVideoOptions(options), pollingOptions);
  }

  /**
   * Edit an existing video with natural language instructions.
   */
  async editVideo(
    prompt: string,
    videoUrl: string,
    options?: Partial<VideoGenerationOptions>,
    pollingOptions?: VideoPollingOptions,
  ): Promise<VideoGenerationResult> {
    return editVideo(prompt, videoUrl, this.getVideoOptions(options), pollingOptions);
  }

  /**
   * Start a video generation request without waiting (manual polling).
   *
   * Use `getVideoStatus` to poll for results.
   */
  async startVideoGeneration(
    prompt: string,
    options?: Partial<VideoGenerationOptions>,
  ): Promise<{ requestId: string }> {
    return startVideoGeneration(prompt, this.getVideoOptions(options));
  }

  /**
   * Check the status of a video generation request.
   */
  async getVideoStatus(requestId: string): Promise<VideoGenerationStatusResponse> {
    return getVideoStatus(requestId, this.getRequestOptions());
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Calculate cosine similarity between two vectors.
   */
  cosineSimilarity = cosineSimilarity;

  /**
   * Find similar items from a corpus.
   */
  findSimilar = findSimilar;
}

/**
 * Create an xAI client.
 *
 * @param config - Client configuration
 * @returns xAI client instance
 */
export function createXAIClient(config: XAIClientConfig): XAIClient {
  return new XAIClient(config);
}
