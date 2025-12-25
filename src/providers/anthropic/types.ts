/**
 * Anthropic Claude API TypeScript types.
 *
 * @module providers/anthropic/types
 */

// ============================================================================
// Common Types
// ============================================================================

/**
 * Message roles in a conversation.
 */
export type Role = 'user' | 'assistant';

/**
 * Reasons why the model stopped generating.
 */
export type StopReason = 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';

// ============================================================================
// Content Block Types
// ============================================================================

/**
 * Cache control for prompt caching.
 */
export interface CacheControl {
  type: 'ephemeral';
}

/**
 * Citation in response text.
 */
export interface Citation {
  type: 'char_location';
  cited_text: string;
  document_index: number;
  document_title?: string;
  start_char_index: number;
  end_char_index: number;
}

/**
 * Text content block.
 */
export interface TextBlock {
  type: 'text';
  text: string;
  cache_control?: CacheControl;
  /** Citations (in responses when citations enabled) */
  citations?: Citation[];
}

/**
 * Image source for vision.
 */
export interface ImageSource {
  type: 'base64' | 'url';
  media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  data?: string;
  url?: string;
}

/**
 * Image content block.
 */
export interface ImageBlock {
  type: 'image';
  source: ImageSource;
  cache_control?: CacheControl;
}

/**
 * Document source for PDFs and text files.
 */
export interface DocumentSource {
  type: 'base64' | 'url' | 'text';
  media_type: 'application/pdf' | 'text/plain' | 'text/html' | 'text/csv' | 'text/markdown';
  data?: string;
  url?: string;
  text?: string;
}

/**
 * Document content block (PDF support).
 */
export interface DocumentBlock {
  type: 'document';
  source: DocumentSource;
  cache_control?: CacheControl;
  title?: string;
  context?: string;
  citations?: { enabled: boolean };
}

/**
 * Tool use block (model calling a tool).
 */
export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Tool result block (response to tool call).
 */
export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | ContentBlock[];
  is_error?: boolean;
}

/**
 * Thinking block (extended thinking).
 */
export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
  /** Verification signature (for extended thinking) */
  signature?: string;
}

/**
 * Redacted thinking block.
 */
export interface RedactedThinkingBlock {
  type: 'redacted_thinking';
  data: string;
}

/**
 * Content block union type.
 */
export type ContentBlock =
  | TextBlock
  | ImageBlock
  | DocumentBlock
  | ToolUseBlock
  | ToolResultBlock
  | ThinkingBlock
  | RedactedThinkingBlock;

/**
 * Response content block (what the model returns).
 */
export type ResponseContentBlock = TextBlock | ToolUseBlock | ThinkingBlock | RedactedThinkingBlock;

// ============================================================================
// Message Types
// ============================================================================

/**
 * A message in a conversation.
 */
export interface Message {
  role: Role;
  content: string | ContentBlock[];
}

/**
 * System prompt (can be string or content blocks).
 */
export type SystemPrompt = string | Array<TextBlock | DocumentBlock>;

// ============================================================================
// Tool Types
// ============================================================================

/**
 * Input schema for tools.
 */
export interface InputSchema {
  type: 'object';
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

/**
 * Custom tool definition.
 */
export interface Tool {
  name: string;
  description?: string;
  input_schema: InputSchema;
  cache_control?: CacheControl;
}

/**
 * Built-in computer use tool.
 */
export interface ComputerTool {
  type: 'computer_20241022' | 'computer_20250124';
  name: 'computer';
  display_width_px: number;
  display_height_px: number;
  display_number?: number;
}

/**
 * Built-in text editor tool.
 */
export interface TextEditorTool {
  type: 'text_editor_20241022' | 'text_editor_20250124';
  name: 'str_replace_editor';
}

/**
 * Built-in bash tool.
 */
export interface BashTool {
  type: 'bash_20241022' | 'bash_20250124';
  name: 'bash';
}

/**
 * Web search tool.
 */
export interface WebSearchTool {
  type: 'web_search_20250305';
  name: 'web_search';
  max_uses?: number;
  allowed_domains?: string[];
  blocked_domains?: string[];
  user_location?: {
    type: 'approximate';
    city?: string;
    region?: string;
    country?: string;
    timezone?: string;
  };
}

/**
 * MCP tool.
 */
export interface MCPTool {
  type: 'mcp_20250320';
  name: string;
  server_name: string;
}

/**
 * All tool types.
 */
export type AnyTool = Tool | ComputerTool | TextEditorTool | BashTool | WebSearchTool | MCPTool;

/**
 * Tool choice configuration.
 */
export type ToolChoice =
  | { type: 'auto'; disable_parallel_tool_use?: boolean }
  | { type: 'any'; disable_parallel_tool_use?: boolean }
  | { type: 'none' }
  | { type: 'tool'; name: string; disable_parallel_tool_use?: boolean };

// ============================================================================
// Request Types
// ============================================================================

/**
 * Extended thinking configuration.
 */
export interface ThinkingConfig {
  type: 'enabled';
  budget_tokens: number;
}

/**
 * Request metadata.
 */
export interface RequestMetadata {
  user_id?: string;
}

/**
 * Messages request parameters.
 */
export interface MessagesRequest {
  /** Model ID (required) */
  model: string;
  /** Conversation messages (required) */
  messages: Message[];
  /** Maximum tokens to generate (required) */
  max_tokens: number;
  /** System prompt */
  system?: SystemPrompt;
  /** Sampling temperature (0-1) */
  temperature?: number;
  /** Top-p sampling */
  top_p?: number;
  /** Top-k sampling */
  top_k?: number;
  /** Stop sequences */
  stop_sequences?: string[];
  /** Enable streaming */
  stream?: boolean;
  /** Available tools */
  tools?: AnyTool[];
  /** Tool selection strategy */
  tool_choice?: ToolChoice;
  /** Request metadata */
  metadata?: RequestMetadata;
  /** Extended thinking (Claude 4+) */
  thinking?: ThinkingConfig;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Token usage statistics.
 */
export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/**
 * Messages response.
 */
export interface MessagesResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: ResponseContentBlock[];
  model: string;
  stop_reason: StopReason | null;
  stop_sequence: string | null;
  usage: Usage;
}

// ============================================================================
// Streaming Types
// ============================================================================

/**
 * Message start event.
 */
export interface MessageStartEvent {
  type: 'message_start';
  message: {
    id: string;
    type: 'message';
    role: 'assistant';
    content: [];
    model: string;
    stop_reason: null;
    stop_sequence: null;
    usage: Usage;
  };
}

/**
 * Content block start event.
 */
export interface ContentBlockStartEvent {
  type: 'content_block_start';
  index: number;
  content_block: ResponseContentBlock;
}

/**
 * Content block delta event.
 */
export interface ContentBlockDeltaEvent {
  type: 'content_block_delta';
  index: number;
  delta:
    | { type: 'text_delta'; text: string }
    | { type: 'input_json_delta'; partial_json: string }
    | { type: 'thinking_delta'; thinking: string }
    | { type: 'signature_delta'; signature: string };
}

/**
 * Content block stop event.
 */
export interface ContentBlockStopEvent {
  type: 'content_block_stop';
  index: number;
}

/**
 * Message delta event.
 */
export interface MessageDeltaEvent {
  type: 'message_delta';
  delta: {
    stop_reason: StopReason;
    stop_sequence: string | null;
  };
  usage: {
    output_tokens: number;
  };
}

/**
 * Message stop event.
 */
export interface MessageStopEvent {
  type: 'message_stop';
}

/**
 * Ping event (keepalive).
 */
export interface PingEvent {
  type: 'ping';
}

/**
 * Error event.
 */
export interface ErrorEvent {
  type: 'error';
  error: {
    type: string;
    message: string;
  };
}

/**
 * All streaming event types.
 */
export type StreamEvent =
  | MessageStartEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | MessageDeltaEvent
  | MessageStopEvent
  | PingEvent
  | ErrorEvent;

// ============================================================================
// Token Counting Types
// ============================================================================

/**
 * Token count request.
 */
export interface TokenCountRequest {
  model: string;
  messages: Message[];
  system?: SystemPrompt;
  tools?: AnyTool[];
  tool_choice?: ToolChoice;
  thinking?: ThinkingConfig;
}

/**
 * Token count response.
 */
export interface TokenCountResponse {
  input_tokens: number;
}

// ============================================================================
// Model Types
// ============================================================================

/**
 * Model information.
 */
export interface Model {
  type: 'model';
  id: string;
  display_name: string;
  created_at: string;
}

/**
 * Models list response.
 */
export interface ModelsResponse {
  data: Model[];
  has_more: boolean;
  first_id: string | null;
  last_id: string | null;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Anthropic API error types.
 */
export type ErrorType =
  | 'invalid_request_error'
  | 'authentication_error'
  | 'permission_error'
  | 'not_found_error'
  | 'request_too_large'
  | 'rate_limit_error'
  | 'api_error'
  | 'overloaded_error';

/**
 * Anthropic API error response structure.
 */
export interface APIErrorResponse {
  type: 'error';
  error: {
    type: ErrorType;
    message: string;
  };
}
