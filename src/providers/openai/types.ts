/**
 * OpenAI API TypeScript types.
 *
 * @module providers/openai/types
 */

// ============================================================================
// Common Types
// ============================================================================

/**
 * Message roles in a conversation.
 */
export type Role = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Reasons why the model stopped generating.
 */
export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter';

// ============================================================================
// Message Types
// ============================================================================

/**
 * Text content part for multimodal messages.
 */
export interface TextContentPart {
  type: 'text';
  text: string;
}

/**
 * Image content part for vision.
 */
export interface ImageContentPart {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

/**
 * Content part union type.
 */
export type ContentPart = TextContentPart | ImageContentPart;

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

/**
 * System message.
 */
export interface SystemMessage {
  role: 'system';
  content: string;
  name?: string;
}

/**
 * User message.
 */
export interface UserMessage {
  role: 'user';
  content: string | ContentPart[];
  name?: string;
}

/**
 * Assistant message.
 */
export interface AssistantMessage {
  role: 'assistant';
  content: string | null;
  name?: string;
  tool_calls?: ToolCall[];
  refusal?: string | null;
}

/**
 * Tool response message.
 */
export interface ToolMessage {
  role: 'tool';
  content: string;
  tool_call_id: string;
}

// ============================================================================
// Tool Types
// ============================================================================

/**
 * Function definition for tool calling.
 */
export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  strict?: boolean;
}

/**
 * Tool definition.
 */
export interface Tool {
  type: 'function';
  function: FunctionDefinition;
}

/**
 * Tool call made by the model.
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
 * Tool choice configuration.
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
 * JSON schema response format for structured outputs.
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
 * Response format union.
 */
export type ResponseFormat =
  | TextResponseFormat
  | JsonObjectResponseFormat
  | JsonSchemaResponseFormat;

// ============================================================================
// Chat Completion Request
// ============================================================================

/**
 * Stream options for including usage in stream.
 */
export interface StreamOptions {
  include_usage?: boolean;
}

/**
 * Chat completion request parameters.
 */
export interface ChatCompletionRequest {
  /** Model ID (required) */
  model: string;
  /** Conversation messages (required) */
  messages: Message[];
  /** Sampling temperature (0-2) */
  temperature?: number;
  /** Nucleus sampling threshold */
  top_p?: number;
  /** Number of completions to generate */
  n?: number;
  /** Enable streaming */
  stream?: boolean;
  /** Stream options */
  stream_options?: StreamOptions;
  /** Stop sequences */
  stop?: string | string[];
  /** Max tokens to generate */
  max_tokens?: number;
  /** Max completion tokens (newer) */
  max_completion_tokens?: number;
  /** Presence penalty (-2 to 2) */
  presence_penalty?: number;
  /** Frequency penalty (-2 to 2) */
  frequency_penalty?: number;
  /** Token bias adjustments */
  logit_bias?: Record<string, number>;
  /** Return log probabilities */
  logprobs?: boolean;
  /** Top logprobs per token */
  top_logprobs?: number;
  /** End-user identifier */
  user?: string;
  /** Deterministic seed */
  seed?: number;
  /** Available tools */
  tools?: Tool[];
  /** Tool selection strategy */
  tool_choice?: ToolChoice;
  /** Allow parallel tool calls */
  parallel_tool_calls?: boolean;
  /** Response format */
  response_format?: ResponseFormat;
  /** Reasoning effort for o1/o3 */
  reasoning_effort?: 'low' | 'medium' | 'high';
  /** Request metadata */
  metadata?: Record<string, string>;
  /** Store for distillation */
  store?: boolean;
}

// ============================================================================
// Chat Completion Response
// ============================================================================

/**
 * Token usage statistics.
 */
export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
    audio_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
    audio_tokens?: number;
    accepted_prediction_tokens?: number;
    rejected_prediction_tokens?: number;
  };
}

/**
 * Log probability information.
 */
export interface LogProb {
  token: string;
  logprob: number;
  bytes?: number[];
  top_logprobs?: Array<{
    token: string;
    logprob: number;
    bytes?: number[];
  }>;
}

/**
 * Logprobs container.
 */
export interface Logprobs {
  content: LogProb[] | null;
  refusal?: LogProb[] | null;
}

/**
 * A single choice in the completion response.
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
  service_tier?: string;
}

// ============================================================================
// Streaming Types
// ============================================================================

/**
 * Delta for tool call in streaming.
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
 * Delta content in streaming.
 */
export interface ChunkDelta {
  role?: 'assistant';
  content?: string;
  tool_calls?: ToolCallDelta[];
  refusal?: string;
}

/**
 * A single choice in a streaming chunk.
 */
export interface ChunkChoice {
  index: number;
  delta: ChunkDelta;
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
// Embeddings Types
// ============================================================================

/**
 * Embedding request parameters.
 */
export interface EmbeddingRequest {
  /** Model ID (required) */
  model: string;
  /** Input text(s) (required) */
  input: string | string[];
  /** Encoding format */
  encoding_format?: 'float' | 'base64';
  /** Output dimensions */
  dimensions?: number;
  /** End-user identifier */
  user?: string;
}

/**
 * Single embedding result.
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
// Image Types
// ============================================================================

/**
 * Image generation request parameters.
 */
export interface ImageGenerationRequest {
  /** Model ID */
  model?: string;
  /** Image description (required) */
  prompt: string;
  /** Number of images */
  n?: number;
  /** Image size */
  size?: '1024x1024' | '1024x1792' | '1792x1024' | 'auto';
  /** Quality level */
  quality?: 'low' | 'medium' | 'high' | 'auto';
  /** Style */
  style?: 'vivid' | 'natural';
  /** Output format */
  response_format?: 'url' | 'b64_json';
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
// Model Types
// ============================================================================

/**
 * Model information.
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

// ============================================================================
// Error Types
// ============================================================================

/**
 * OpenAI API error types.
 */
export type ErrorType =
  | 'invalid_request_error'
  | 'authentication_error'
  | 'permission_error'
  | 'not_found_error'
  | 'rate_limit_error'
  | 'server_error'
  | 'engine_overloaded_error';

/**
 * OpenAI API error response structure.
 */
export interface APIErrorResponse {
  error: {
    message: string;
    type: ErrorType;
    param?: string;
    code?: string;
  };
}
