/**
 * OpenAI Provider Module.
 *
 * Provides a complete, typesafe interface to the OpenAI API.
 *
 * @example
 * ```typescript
 * import { OpenAIClient, createOpenAIClient } from 'chatoyant/providers/openai';
 *
 * const client = createOpenAIClient({
 *   apiKey: process.env.API_KEY_OPENAI!,
 *   defaultModel: 'gpt-4o',
 * });
 *
 * // Chat
 * const content = await client.chatSimple([
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
 * // Embeddings
 * const vector = await client.embedOne('Hello, world!');
 * ```
 *
 * @module providers/openai
 */

// Chat
export {
  type ChatOptions,
  type ReasoningEffort,
  chat,
  chatSimple,
  chatStructured,
  chatWithTools,
} from './chat.js';
// Chat Streaming
export {
  type ChatStreamOptions,
  chatStream,
  chatStreamAccumulate,
  chatStreamContent,
  chatStreamReadable,
  chatStreamToWritable,
  type StreamDelta,
} from './chat-stream.js';
// Client
export { createOpenAIClient, OpenAIClient, type OpenAIClientConfig } from './client.js';

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
export { isOpenAIError, OpenAIError } from './errors.js';
// Images
export {
  generateImage,
  generateImageBase64,
  generateImages,
  generateImageUrl,
  generateImageWithPrompt,
  type ImageGenerationOptions,
} from './images.js';
// Models
export { getModel, listModelIds, listModels, modelExists } from './models.js';
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
// Schema utilities
export { makeOpenAIStrict, needsOpenAIStrictTransform } from './schema-utils.js';
// Streaming utilities
export {
  accumulatorToToolCalls,
  createAccumulator,
  parseSSEStream,
  type StreamAccumulator,
  streamWithAccumulator,
  updateAccumulator,
} from './stream.js';

// Types
export type {
  APIErrorResponse,
  AssistantMessage,
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionRequest,
  Choice,
  ChunkChoice,
  ChunkDelta,
  ContentPart,
  Embedding,
  EmbeddingRequest,
  EmbeddingResponse,
  ErrorType,
  FinishReason,
  FunctionDefinition,
  ImageContentPart,
  ImageData,
  ImageGenerationRequest,
  ImageGenerationResponse,
  JsonObjectResponseFormat,
  JsonSchemaResponseFormat,
  LogProb,
  Logprobs,
  Message,
  Model,
  ModelsResponse,
  ResponseFormat,
  Role,
  StreamOptions,
  SystemMessage,
  TextContentPart,
  TextResponseFormat,
  Tool,
  ToolCall,
  ToolCallDelta,
  ToolChoice,
  ToolMessage,
  Usage,
  UserMessage,
} from './types.js';
