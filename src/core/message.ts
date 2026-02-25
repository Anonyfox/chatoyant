/**
 * Message class for LLM chat interactions.
 *
 * Provides a lean runtime class with validation, serialization,
 * and convenient factory methods. Used by the Chat abstraction.
 *
 * @module core/message
 */

/**
 * Valid message roles across all providers.
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * A tool call requested by the assistant.
 * Stored in provider-agnostic form; _formatMessages converts per-provider.
 */
export interface ToolCallData {
  id: string;
  name: string;
  arguments: string;
}

/**
 * Serialized message format (JSON-compatible).
 */
export interface MessageJSON {
  role: MessageRole;
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCallData[];
  metadata?: Record<string, unknown>;
}

/**
 * Message class representing a single message in a conversation.
 *
 * @example
 * ```typescript
 * // Create messages
 * const system = Message.system("You are helpful");
 * const user = Message.user("Hello!");
 * const assistant = Message.assistant("Hi there!");
 *
 * // Or use constructor
 * const msg = new Message("user", "Hello!");
 *
 * // Serialize
 * const json = msg.toJSON();
 * const restored = Message.fromJSON(json);
 * ```
 */
export class Message {
  /** Message role */
  readonly role: MessageRole;

  /** Message content */
  readonly content: string;

  /** Optional name (for multi-agent scenarios) */
  readonly name?: string;

  /** Tool call ID (for tool responses) */
  readonly toolCallId?: string;

  /** Tool calls requested by the assistant */
  readonly toolCalls?: ToolCallData[];

  /** Optional metadata for extensions */
  readonly metadata?: Record<string, unknown>;

  /**
   * Create a new Message.
   *
   * @param role - The message role
   * @param content - The message content
   * @param options - Optional name, toolCallId, toolCalls, metadata
   */
  constructor(
    role: MessageRole,
    content: string,
    options?: {
      name?: string;
      toolCallId?: string;
      toolCalls?: ToolCallData[];
      metadata?: Record<string, unknown>;
    },
  ) {
    if (!['system', 'user', 'assistant', 'tool'].includes(role)) {
      throw new TypeError(`Invalid role: must be 'system' | 'user' | 'assistant' | 'tool'`);
    }
    if (typeof content !== 'string') {
      throw new TypeError('Invalid content: must be a string');
    }

    this.role = role;
    this.content = content;
    this.name = options?.name;
    this.toolCallId = options?.toolCallId;
    this.toolCalls = options?.toolCalls;
    this.metadata = options?.metadata;
  }

  /**
   * Serialize to plain JSON object.
   */
  toJSON(): MessageJSON {
    const json: MessageJSON = {
      role: this.role,
      content: this.content,
    };
    if (this.name !== undefined) json.name = this.name;
    if (this.toolCallId !== undefined) json.toolCallId = this.toolCallId;
    if (this.toolCalls !== undefined) json.toolCalls = this.toolCalls;
    if (this.metadata !== undefined) json.metadata = this.metadata;
    return json;
  }

  /**
   * Create a Message from a plain object.
   */
  static fromJSON(json: unknown): Message {
    if (!json || typeof json !== 'object') {
      throw new TypeError('Invalid message JSON: must be an object');
    }

    const obj = json as Record<string, unknown>;

    if (typeof obj.role !== 'string' || typeof obj.content !== 'string') {
      throw new TypeError('Invalid message JSON: missing role or content');
    }

    return new Message(obj.role as MessageRole, obj.content, {
      name: typeof obj.name === 'string' ? obj.name : undefined,
      toolCallId: typeof obj.toolCallId === 'string' ? obj.toolCallId : undefined,
      toolCalls: Array.isArray(obj.toolCalls) ? (obj.toolCalls as ToolCallData[]) : undefined,
      metadata:
        typeof obj.metadata === 'object' ? (obj.metadata as Record<string, unknown>) : undefined,
    });
  }

  // ===========================================================================
  // Factory Methods
  // ===========================================================================

  /**
   * Create a system message.
   */
  static system(content: string, metadata?: Record<string, unknown>): Message {
    return new Message('system', content, { metadata });
  }

  /**
   * Create a user message.
   */
  static user(content: string, metadata?: Record<string, unknown>): Message {
    return new Message('user', content, { metadata });
  }

  /**
   * Create an assistant message.
   */
  static assistant(content: string, metadata?: Record<string, unknown>): Message {
    return new Message('assistant', content, { metadata });
  }

  /**
   * Create an assistant message that requests tool calls.
   */
  static assistantToolCall(toolCalls: ToolCallData[], metadata?: Record<string, unknown>): Message {
    return new Message('assistant', '', { toolCalls, metadata });
  }

  /**
   * Create a tool response message.
   */
  static tool(content: string, toolCallId: string, metadata?: Record<string, unknown>): Message {
    return new Message('tool', content, { toolCallId, metadata });
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Create a copy with updated content.
   */
  withContent(content: string): Message {
    return new Message(this.role, content, {
      name: this.name,
      toolCallId: this.toolCallId,
      toolCalls: this.toolCalls,
      metadata: this.metadata,
    });
  }

  /**
   * Create a copy with additional metadata.
   */
  withMetadata(metadata: Record<string, unknown>): Message {
    return new Message(this.role, this.content, {
      name: this.name,
      toolCallId: this.toolCallId,
      toolCalls: this.toolCalls,
      metadata: { ...this.metadata, ...metadata },
    });
  }

  /**
   * Check if this is a system message.
   */
  isSystem(): boolean {
    return this.role === 'system';
  }

  /**
   * Check if this is a user message.
   */
  isUser(): boolean {
    return this.role === 'user';
  }

  /**
   * Check if this is an assistant message.
   */
  isAssistant(): boolean {
    return this.role === 'assistant';
  }

  /**
   * Check if this is a tool message.
   */
  isTool(): boolean {
    return this.role === 'tool';
  }

  /**
   * Check if this is an assistant message that requests tool calls.
   */
  hasToolCalls(): boolean {
    return this.role === 'assistant' && Array.isArray(this.toolCalls) && this.toolCalls.length > 0;
  }
}
