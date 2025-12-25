/**
 * xAI Grok API TypeScript types.
 *
 * xAI is OpenAI-compatible but has some specific differences:
 * - Different base URL (api.x.ai/v1)
 * - Grok model names
 * - Built-in web_search tool type
 * - reasoning_effort parameter for reasoning models
 * - Extended language-models and image-generation-models endpoints
 *
 * @module providers/xai/types
 */

// ============================================================================
// Message Types
// ============================================================================

/**
 * Message roles in a conversation.
 */
export type Role = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Image detail level for vision requests.
 */
export type ImageDetail = 'auto' | 'low' | 'high';

/**
 * Image URL content part.
 */
export interface ImageUrlPart {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: ImageDetail;
  };
}

/**
 * Text content part.
 */
export interface TextPart {
  type: 'text';
  text: string;
}

/**
 * Content part for multimodal messages.
 */
export type ContentPart = TextPart | ImageUrlPart;

/**
 * Tool call in assistant messages.
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Tool call delta for streaming.
 */
export interface ToolCallDelta {
  index: number;
  id?: string;
  type?: 'function';
  function?: {
    name?: string;
    arguments?: string;
  };
}

/**
 * A message in a conversation.
 */
export interface Message {
  role: Role;
  content: string | ContentPart[] | null;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

// ============================================================================
// Tool Types
// ============================================================================

/**
 * Function definition for tools.
 */
export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  strict?: boolean;
}

/**
 * Function tool.
 */
export interface FunctionTool {
  type: 'function';
  function: FunctionDefinition;
}

/**
 * xAI built-in web search tool.
 * Unlike OpenAI, xAI has native web search support.
 */
export interface WebSearchTool {
  type: 'web_search';
}

/**
 * Tool types (xAI extends OpenAI with web_search).
 */
export type Tool = FunctionTool | WebSearchTool;

/**
 * Tool choice options.
 */
export type ToolChoice =
  | 'none'
  | 'auto'
  | 'required'
  | { type: 'function'; function: { name: string } };

// ============================================================================
// Response Format Types
// ============================================================================

/**
 * Plain text response format.
 */
export interface TextResponseFormat {
  type: 'text';
}

/**
 * JSON object response format.
 */
export interface JsonObjectResponseFormat {
  type: 'json_object';
}

/**
 * JSON Schema response format (structured outputs).
 */
export interface JsonSchemaResponseFormat {
  type: 'json_schema';
  json_schema: {
    name: string;
    description?: string;
    schema: Record<string, unknown>;
    strict?: boolean;
  };
}

/**
 * Response format options.
 */
export type ResponseFormat =
  | TextResponseFormat
  | JsonObjectResponseFormat
  | JsonSchemaResponseFormat;

// ============================================================================
// Request Types
// ============================================================================

/**
 * Reasoning effort for reasoning models.
 * xAI-specific parameter for models like grok-4-1-fast-reasoning.
 */
export type ReasoningEffort = 'low' | 'medium' | 'high';

/**
 * Stream options for streaming requests.
 */
export interface StreamOptions {
  include_usage?: boolean;
}

/**
 * Chat completion request parameters.
 */
export interface ChatRequest {
  /** Model ID (required) */
  model: string;
  /** Conversation messages (required) */
  messages: Message[];
  /** Sampling temperature (0-2) */
  temperature?: number;
  /** Nucleus sampling threshold */
  top_p?: number;
  /** Number of completions */
  n?: number;
  /** Enable streaming */
  stream?: boolean;
  /** Stream options */
  stream_options?: StreamOptions;
  /** Stop sequences */
  stop?: string | string[];
  /** Maximum tokens to generate */
  max_tokens?: number;
  /** Presence penalty (-2 to 2) */
  presence_penalty?: number;
  /** Frequency penalty (-2 to 2) */
  frequency_penalty?: number;
  /** Token bias adjustments */
  logit_bias?: Record<string, number>;
  /** Return log probabilities */
  logprobs?: boolean;
  /** Top logprobs per token (0-20) */
  top_logprobs?: number;
  /** End-user identifier */
  user?: string;
  /** Deterministic sampling seed */
  seed?: number;
  /** Available tools */
  tools?: Tool[];
  /** Tool selection strategy */
  tool_choice?: ToolChoice;
  /** Allow parallel tool calls */
  parallel_tool_calls?: boolean;
  /** Response format */
  response_format?: ResponseFormat;
  /** Reasoning effort for reasoning models (xAI-specific) */
  reasoning_effort?: ReasoningEffort;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Token usage details.
 */
export interface PromptTokensDetails {
  cached_tokens?: number;
}

/**
 * Completion token details.
 */
export interface CompletionTokensDetails {
  reasoning_tokens?: number;
}

/**
 * Token usage statistics.
 */
export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: PromptTokensDetails;
  completion_tokens_details?: CompletionTokensDetails;
}

/**
 * Log probability information.
 */
export interface Logprobs {
  content: Array<{
    token: string;
    logprob: number;
    bytes: number[] | null;
    top_logprobs: Array<{
      token: string;
      logprob: number;
      bytes: number[] | null;
    }>;
  }> | null;
}

/**
 * Finish reasons for completion.
 */
export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter';

/**
 * Assistant message in response.
 */
export interface AssistantMessage {
  role: 'assistant';
  content: string | null;
  tool_calls?: ToolCall[];
  refusal?: string | null;
}

/**
 * Choice in chat completion response.
 */
export interface Choice {
  index: number;
  message: AssistantMessage;
  finish_reason: FinishReason;
  logprobs?: Logprobs | null;
}

/**
 * Chat completion response.
 */
export interface ChatCompletion {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  system_fingerprint?: string;
  choices: Choice[];
  usage: Usage;
}

// ============================================================================
// Streaming Types
// ============================================================================

/**
 * Delta in streaming response.
 */
export interface Delta {
  role?: 'assistant';
  content?: string;
  tool_calls?: ToolCallDelta[];
}

/**
 * Choice in streaming chunk.
 */
export interface ChunkChoice {
  index: number;
  delta: Delta;
  finish_reason: FinishReason | null;
  logprobs?: Logprobs | null;
}

/**
 * Streaming chunk response.
 */
export interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  system_fingerprint?: string;
  choices: ChunkChoice[];
  usage?: Usage;
}

// ============================================================================
// Image Generation Types
// ============================================================================

/**
 * Image size options.
 */
export type ImageSize = '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';

/**
 * Image quality options.
 */
export type ImageQuality = 'standard' | 'hd';

/**
 * Image style options.
 */
export type ImageStyle = 'vivid' | 'natural';

/**
 * Image response format.
 */
export type ImageResponseFormat = 'url' | 'b64_json';

/**
 * Image generation request.
 */
export interface ImageGenerationRequest {
  /** Model ID */
  model?: string;
  /** Prompt describing the image (required) */
  prompt: string;
  /** Number of images (1-10) */
  n?: number;
  /** Image size */
  size?: ImageSize;
  /** Image quality */
  quality?: ImageQuality;
  /** Image style */
  style?: ImageStyle;
  /** Response format */
  response_format?: ImageResponseFormat;
  /** End-user identifier */
  user?: string;
}

/**
 * Generated image data.
 */
export interface ImageData {
  url?: string;
  b64_json?: string;
  revised_prompt?: string;
}

/**
 * Image generation response.
 */
export interface ImageGenerationResponse {
  created: number;
  data: ImageData[];
}

// ============================================================================
// Embedding Types
// ============================================================================

/**
 * Encoding format for embeddings.
 */
export type EncodingFormat = 'float' | 'base64';

/**
 * Embedding request.
 */
export interface EmbeddingRequest {
  /** Model ID (required) */
  model: string;
  /** Text(s) to embed (required) */
  input: string | string[];
  /** Encoding format */
  encoding_format?: EncodingFormat;
  /** Output dimensions */
  dimensions?: number;
  /** End-user identifier */
  user?: string;
}

/**
 * Embedding object.
 */
export interface Embedding {
  object: 'embedding';
  index: number;
  embedding: number[];
}

/**
 * Embedding response.
 */
export interface EmbeddingResponse {
  object: 'list';
  data: Embedding[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// ============================================================================
// Model Types
// ============================================================================

/**
 * Basic model information (OpenAI-compatible /models endpoint).
 */
export interface Model {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

/**
 * Models list response.
 */
export interface ModelsResponse {
  object: 'list';
  data: Model[];
}

/**
 * Pricing information for a model.
 * xAI-specific extended model information.
 */
export interface ModelPricing {
  input: number;
  output: number;
}

/**
 * Extended language model information.
 * xAI-specific /language-models endpoint.
 */
export interface LanguageModel {
  id: string;
  fingerprint: string;
  aliases: string[];
  context_length: number;
  input_modalities: string[];
  output_modalities: string[];
  pricing: ModelPricing;
}

/**
 * Language models response.
 * xAI-specific.
 */
export interface LanguageModelsResponse {
  models: LanguageModel[];
}

/**
 * Image generation model information.
 * xAI-specific.
 */
export interface ImageGenerationModel {
  id: string;
  fingerprint: string;
  aliases: string[];
  pricing: {
    per_image: number;
  };
}

/**
 * Image generation models response.
 * xAI-specific.
 */
export interface ImageGenerationModelsResponse {
  models: ImageGenerationModel[];
}

// ============================================================================
// File Types
// ============================================================================

/**
 * File object.
 */
export interface FileObject {
  id: string;
  object: 'file';
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
}

/**
 * Files list response.
 */
export interface FilesResponse {
  object: 'list';
  data: FileObject[];
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error types (OpenAI-compatible).
 */
export type ErrorType =
  | 'invalid_request_error'
  | 'authentication_error'
  | 'permission_error'
  | 'not_found_error'
  | 'rate_limit_error'
  | 'server_error';

/**
 * API error response structure.
 */
export interface APIErrorResponse {
  error: {
    message: string;
    type: ErrorType;
    param?: string;
    code?: string;
  };
}
