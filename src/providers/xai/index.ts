/**
 * xAI Provider Module.
 *
 * Provides a complete, typesafe interface to the xAI Grok API.
 * xAI is OpenAI-compatible with some unique features:
 * - Built-in web_search tool
 * - reasoning_effort parameter for reasoning models
 * - Extended model info endpoints (/language-models, /image-generation-models)
 *
 * @example
 * ```typescript
 * import { XAIClient, createXAIClient } from 'chatoyant/providers/xai';
 *
 * const client = createXAIClient({
 *   apiKey: process.env.API_KEY_XAI!,
 *   defaultModel: 'grok-3',
 * });
 *
 * // Chat
 * const text = await client.chatSimple([
 *   { role: 'user', content: 'Hello!' }
 * ]);
 *
 * // Web search (xAI-specific)
 * const response = await client.chatWithWebSearch([
 *   { role: 'user', content: 'What happened today?' }
 * ]);
 *
 * // Stream
 * for await (const delta of client.streamContent([
 *   { role: 'user', content: 'Tell me a story' }
 * ])) {
 *   process.stdout.write(delta.content);
 * }
 * ```
 *
 * @module providers/xai
 */

// Chat
export {
  type ChatOptions,
  chat,
  chatSimple,
  chatStructured,
  chatWithTools,
  chatWithWebSearch,
} from './chat.js';
// Chat Streaming
export {
  type ChatStreamOptions,
  chatStream,
  chatStreamAccumulate,
  chatStreamContent,
  chatStreamReadable,
} from './chat-stream.js';
// Client
export { createXAIClient, XAIClient, type XAIClientConfig } from './client.js';
// Embeddings
export {
  cosineSimilarity,
  type EmbeddingOptions,
  embed,
  embedMany,
  embedOne,
  findSimilar,
} from './embeddings.js';
// Errors
export { isXAIError, XAIError } from './errors.js';

// Images
export {
  generateImage,
  generateImageBase64,
  generateImages,
  generateImageUrl,
  type ImageGenerationOptions,
} from './images.js';

// Models
export {
  getImageGenerationModel,
  getLanguageModel,
  getModel,
  listImageGenerationModels,
  listLanguageModels,
  listModels,
  modelExists,
} from './models.js';

// Request utilities
export {
  BASE_URL,
  buildHeaders,
  buildUrl,
  DEFAULT_TIMEOUT,
  type RequestOptions,
  request,
  requestGet,
  requestRaw,
} from './request.js';

// Streaming utilities
export {
  accumulatorToToolCalls,
  createAccumulator,
  parseSSEStream,
  type StreamAccumulator,
  type StreamDelta,
  updateAccumulator,
} from './stream.js';

// Types
export type {
  APIErrorResponse,
  AssistantMessage,
  ChatCompletion,
  ChatCompletionChunk,
  ChatRequest,
  Choice,
  ChunkChoice,
  CompletionTokensDetails,
  ContentPart,
  Delta,
  Embedding,
  EmbeddingRequest,
  EmbeddingResponse,
  EncodingFormat,
  ErrorType,
  FileObject,
  FilesResponse,
  FinishReason,
  FunctionDefinition,
  FunctionTool,
  ImageData,
  ImageDetail,
  ImageGenerationModel,
  ImageGenerationModelsResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageQuality,
  ImageResponseFormat,
  ImageSize,
  ImageStyle,
  ImageUrlPart,
  JsonObjectResponseFormat,
  JsonSchemaResponseFormat,
  LanguageModel,
  LanguageModelsResponse,
  Logprobs,
  Message,
  Model,
  ModelPricing,
  ModelsResponse,
  PromptTokensDetails,
  ReasoningEffort,
  ResponseFormat,
  Role,
  StreamOptions,
  TextPart,
  TextResponseFormat,
  Tool,
  ToolCall,
  ToolCallDelta,
  ToolChoice,
  Usage,
  WebSearchTool,
} from './types.js';
