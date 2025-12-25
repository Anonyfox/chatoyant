/**
 * Chat class - the main unified LLM interface.
 *
 * Provides a fluent, stateful API for conversations across
 * OpenAI, Anthropic, and xAI providers with automatic model detection,
 * streaming, structured output, and tool calling.
 *
 * @module core/chat
 */

import { type AnthropicClient, createAnthropicClient } from '../providers/anthropic/index.js';
import { detectProviderByModel, getApiKey, isProviderActive } from '../providers/detection.js';
import {
  createOpenAIClient,
  makeOpenAIStrict,
  type OpenAIClient,
} from '../providers/openai/index.js';
import type { ProviderId } from '../providers/types.js';
import { createXAIClient, type XAIClient } from '../providers/xai/index.js';
import { Schema, type SchemaInstance } from '../schema/index.js';
import { calculateCost } from '../tokens/cost.js';

import { Message, type MessageJSON } from './message.js';
import {
  type ChatConfig,
  DEFAULT_MAX_TOOL_ITERATIONS,
  DEFAULT_TIMEOUT,
  type GenerateOptions,
  type GenerateWithToolsOptions,
  mergeOptions,
  type StreamOptions,
} from './options.js';
import {
  adjustXAIModelForReasoning,
  type CostInfo,
  createEmptyCost,
  createEmptyTiming,
  createEmptyUsage,
  getReasoningConfig,
  isModelPreset,
  resolveCreativity,
  resolveModelPreset,
  supportsReasoning,
  type TimingInfo,
  type TokenUsage,
} from './presets.js';
import type { Tool, ToolCall, ToolContext, ToolResult } from './tool.js';

/**
 * Serialized Chat state.
 */
export interface ChatJSON {
  model: string;
  messages: MessageJSON[];
  config?: Partial<ChatConfig>;
}

/**
 * Generation result with rich metadata.
 */
export interface GenerateResult {
  /** Generated content */
  content: string;
  /** Detailed token usage breakdown */
  usage: TokenUsage;
  /** Timing information */
  timing: TimingInfo;
  /** Cost information */
  cost: CostInfo;
  /** Provider used */
  provider: ProviderId;
  /** Model used */
  model: string;
  /** Whether response used cached tokens */
  cached: boolean;
}

/**
 * Streaming delta.
 */
export interface StreamDelta {
  /** Content chunk */
  content: string;
  /** Whether this is the final chunk */
  done: boolean;
}

/**
 * Chat class for unified LLM interactions.
 *
 * @example
 * ```typescript
 * // Simple conversation
 * const chat = new Chat({ model: "gpt-4o" });
 * chat.system("You are a helpful assistant");
 *
 * const reply = await chat.user("Hello!").generate();
 * console.log(reply);
 *
 * // Streaming
 * for await (const delta of chat.user("Tell me a story").stream()) {
 *   process.stdout.write(delta);
 * }
 *
 * // Structured output
 * const person = await chat.user("Extract: Alice is 30").generateData(PersonSchema);
 *
 * // Serialization
 * const json = chat.toJSON();
 * const restored = Chat.fromJSON(json);
 * ```
 */
export class Chat {
  /** Current model */
  private _model: string;

  /** Message history */
  private _messages: Message[] = [];

  /** Registered tools */
  private _tools: Tool[] = [];

  /** Default options */
  private _defaults: GenerateOptions;

  /** Cached clients */
  private _clients: {
    openai?: OpenAIClient;
    anthropic?: AnthropicClient;
    xai?: XAIClient;
  } = {};

  /**
   * Create a new Chat instance.
   *
   * @param config - Optional configuration
   *
   * @example
   * ```typescript
   * // With specific model
   * new Chat({ model: 'gpt-4o' });
   *
   * // With model preset
   * new Chat({ model: 'fast' });     // Uses fastest model for default provider
   * new Chat({ model: 'best' });     // Uses highest quality model
   * new Chat({ model: 'cheap' });    // Uses most cost-effective model
   * new Chat({ model: 'balanced' }); // Good quality/speed/cost balance
   * ```
   */
  constructor(config?: ChatConfig) {
    const modelInput = config?.model ?? 'gpt-4o';

    // Resolve model presets to actual model names
    if (isModelPreset(modelInput)) {
      // Default to OpenAI for presets unless provider is specified
      const provider = config?.defaults?.provider ?? 'openai';
      this._model = resolveModelPreset(modelInput, provider);
    } else {
      this._model = modelInput;
    }

    this._defaults = config?.defaults ?? {};
  }

  // ===========================================================================
  // Getters
  // ===========================================================================

  /** Get current model */
  get model(): string {
    return this._model;
  }

  /** Set model */
  set model(value: string) {
    this._model = value;
  }

  /** Get message history (readonly) */
  get messages(): readonly Message[] {
    return this._messages;
  }

  /** Get registered tools (readonly) */
  get tools(): readonly Tool[] {
    return this._tools;
  }

  // ===========================================================================
  // Fluent Message Builders
  // ===========================================================================

  /**
   * Add a system message.
   * @returns this for chaining
   */
  system(content: string, metadata?: Record<string, unknown>): this {
    this._messages.push(Message.system(content, metadata));
    return this;
  }

  /**
   * Add a user message.
   * @returns this for chaining
   */
  user(content: string, metadata?: Record<string, unknown>): this {
    this._messages.push(Message.user(content, metadata));
    return this;
  }

  /**
   * Add an assistant message.
   * @returns this for chaining
   */
  assistant(content: string, metadata?: Record<string, unknown>): this {
    this._messages.push(Message.assistant(content, metadata));
    return this;
  }

  /**
   * Add a raw Message instance.
   * @returns this for chaining
   */
  addMessage(message: Message): this {
    this._messages.push(message);
    return this;
  }

  /**
   * Add multiple messages.
   * @returns this for chaining
   */
  addMessages(messages: Message[]): this {
    this._messages.push(...messages);
    return this;
  }

  /**
   * Clear all messages.
   * @returns this for chaining
   */
  clearMessages(): this {
    this._messages = [];
    return this;
  }

  // ===========================================================================
  // Tool Registration
  // ===========================================================================

  /**
   * Register a tool for tool-calling.
   * @returns this for chaining
   */
  addTool(tool: Tool): this {
    this._tools.push(tool);
    return this;
  }

  /**
   * Register multiple tools.
   * @returns this for chaining
   */
  addTools(tools: Tool[]): this {
    this._tools.push(...tools);
    return this;
  }

  /**
   * Clear all tools.
   * @returns this for chaining
   */
  clearTools(): this {
    this._tools = [];
    return this;
  }

  // ===========================================================================
  // Generation Methods
  // ===========================================================================

  /**
   * Generate a text response.
   * Automatically uses registered tools if any exist.
   * Appends assistant response to message history.
   *
   * @param options - Generation options (includes tool options when tools registered)
   * @returns Generated text content
   */
  async generate(options?: GenerateWithToolsOptions): Promise<string> {
    // If tools are registered, use the tool-aware generation path
    if (this._tools.length > 0) {
      return this._generateWithToolLoop(options);
    }

    const result = await this.generateWithResult(options);
    return result.content;
  }

  /**
   * Generate a text response with full result metadata.
   * Does NOT use tools - for direct generation only.
   * Appends assistant response to message history.
   *
   * @param options - Generation options
   * @returns Full generation result with rich metadata (usage, timing, cost)
   */
  async generateWithResult(options?: GenerateOptions): Promise<GenerateResult> {
    const opts = mergeOptions(this._defaults, options);
    const provider = this._resolveProvider(opts.provider);
    const client = this._getClient(provider);

    // Handle model adjustment for xAI reasoning
    let modelToUse = this._model;
    if (provider === 'xai' && opts.reasoning) {
      const xaiConfig = getReasoningConfig(opts.reasoning, 'xai');
      modelToUse = adjustXAIModelForReasoning(modelToUse, xaiConfig.preferReasoningModel);
    }

    // Convert messages to provider format
    const messages = this._formatMessages(provider);

    // Resolve temperature from creativity preset if needed
    const temperature =
      opts.temperature ?? (opts.creativity ? resolveCreativity(opts.creativity) : undefined);

    let content: string;
    const usage = createEmptyUsage();
    const timing = createEmptyTiming();
    let cached = false;

    const startTime = Date.now();

    if (provider === 'openai') {
      // Build reasoning options for OpenAI
      const reasoningOpts: Record<string, unknown> = {};
      if (opts.reasoning && supportsReasoning(modelToUse)) {
        const openaiConfig = getReasoningConfig(opts.reasoning, 'openai');
        reasoningOpts.reasoning_effort = openaiConfig.reasoningEffort;
      }

      const response = await (client as OpenAIClient).chat(messages as any, {
        model: modelToUse,
        temperature,
        maxTokens: opts.maxTokens,
        timeout: opts.timeout ?? DEFAULT_TIMEOUT,
        requestOptions: {
          top_p: opts.topP,
          stop: opts.stop,
          frequency_penalty: opts.frequencyPenalty,
          presence_penalty: opts.presencePenalty,
          ...reasoningOpts,
          ...opts.extra,
        },
      });

      content = response.choices[0]?.message?.content ?? '';
      if (response.usage) {
        usage.inputTokens = response.usage.prompt_tokens;
        usage.outputTokens = response.usage.completion_tokens;
        usage.totalTokens = response.usage.total_tokens;
        // Extract reasoning tokens if available
        const details = response.usage.completion_tokens_details as
          | { reasoning_tokens?: number }
          | undefined;
        usage.reasoningTokens = details?.reasoning_tokens ?? 0;
        // Extract cached tokens if available
        const promptDetails = response.usage.prompt_tokens_details as
          | { cached_tokens?: number }
          | undefined;
        usage.cachedTokens = promptDetails?.cached_tokens ?? 0;
        cached = usage.cachedTokens > 0;
      }
    } else if (provider === 'anthropic') {
      // Build thinking options for Anthropic
      const thinkingOpts: Record<string, unknown> = {};
      if (opts.reasoning && opts.reasoning !== 'off') {
        const anthropicConfig = getReasoningConfig(opts.reasoning, 'anthropic');
        if (anthropicConfig.thinking) {
          thinkingOpts.thinking = anthropicConfig.thinking;
          // Ensure maxTokens > budget_tokens
          const budgetTokens = anthropicConfig.thinking.budget_tokens;
          const maxTokens = opts.maxTokens ?? 4096;
          if (maxTokens <= budgetTokens) {
            opts.maxTokens = budgetTokens + 4096;
          }
        }
      }

      const response = await (client as AnthropicClient).message(messages as any, {
        model: modelToUse,
        maxTokens: opts.maxTokens ?? 4096,
        temperature,
        timeout: opts.timeout ?? DEFAULT_TIMEOUT,
        requestOptions: {
          top_p: opts.topP,
          ...thinkingOpts,
          ...opts.extra,
        },
      });

      content = (client as AnthropicClient).extractText(response.content);
      if (response.usage) {
        usage.inputTokens = response.usage.input_tokens;
        usage.outputTokens = response.usage.output_tokens;
        usage.totalTokens = usage.inputTokens + usage.outputTokens;
        // Anthropic doesn't separate reasoning tokens in the same way
        // Extract cached tokens if available
        const usageAny = response.usage as { cache_read_input_tokens?: number };
        usage.cachedTokens = usageAny.cache_read_input_tokens ?? 0;
        cached = usage.cachedTokens > 0;
      }
    } else if (provider === 'xai') {
      // xAI-specific options (reasoning handled via model selection above)
      const xaiOpts: Record<string, unknown> = {
        model: modelToUse,
        temperature,
        maxTokens: opts.maxTokens,
        topP: opts.topP,
        stop: opts.stop,
        frequencyPenalty: opts.frequencyPenalty,
        presencePenalty: opts.presencePenalty,
        timeout: opts.timeout ?? DEFAULT_TIMEOUT,
        ...opts.extra,
      };

      const response = opts.webSearch
        ? await (client as XAIClient).chatWithWebSearch(messages as any, xaiOpts)
        : await (client as XAIClient).chat(messages as any, xaiOpts);

      content = response.choices[0]?.message?.content ?? '';
      if (response.usage) {
        usage.inputTokens = response.usage.prompt_tokens;
        usage.outputTokens = response.usage.completion_tokens;
        usage.totalTokens = response.usage.total_tokens;
        // Extract reasoning tokens if available
        const details = response.usage.completion_tokens_details as
          | { reasoning_tokens?: number }
          | undefined;
        usage.reasoningTokens = details?.reasoning_tokens ?? 0;
      }
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    timing.latencyMs = Date.now() - startTime;

    // Calculate cost
    const cost = createEmptyCost();
    try {
      const costResult = calculateCost({
        model: modelToUse,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      });
      cost.estimatedUsd = costResult.total;
    } catch {
      // Cost calculation may fail for unknown models - that's okay
    }

    // Append assistant message to history
    this._messages.push(Message.assistant(content));

    return {
      content,
      usage,
      timing,
      cost,
      provider,
      model: modelToUse,
      cached,
    };
  }

  /**
   * Stream a text response.
   * Appends assistant response to history after streaming completes.
   *
   * @param options - Stream options
   * @returns Async generator of content strings
   */
  async *stream(options?: StreamOptions): AsyncGenerator<string, void, undefined> {
    const opts = mergeOptions(this._defaults, options) as StreamOptions;
    const provider = this._resolveProvider(opts.provider);
    const client = this._getClient(provider);

    // Handle model adjustment for xAI reasoning
    let modelToUse = this._model;
    if (provider === 'xai' && opts.reasoning) {
      const xaiConfig = getReasoningConfig(opts.reasoning, 'xai');
      modelToUse = adjustXAIModelForReasoning(modelToUse, xaiConfig.preferReasoningModel);
    }

    const messages = this._formatMessages(provider);
    let accumulated = '';

    // Resolve temperature from creativity preset if needed
    const temperature =
      opts.temperature ?? (opts.creativity ? resolveCreativity(opts.creativity) : undefined);

    try {
      if (provider === 'openai') {
        // Build reasoning options for OpenAI
        const reasoningOpts: Record<string, unknown> = {};
        if (opts.reasoning && supportsReasoning(modelToUse)) {
          const openaiConfig = getReasoningConfig(opts.reasoning, 'openai');
          reasoningOpts.reasoning_effort = openaiConfig.reasoningEffort;
        }

        const stream = (client as OpenAIClient).streamContent(messages as any, {
          model: modelToUse,
          temperature,
          maxTokens: opts.maxTokens,
          timeout: opts.timeout ?? DEFAULT_TIMEOUT,
          requestOptions: {
            top_p: opts.topP,
            stop: opts.stop,
            ...reasoningOpts,
            ...opts.extra,
          },
        });

        for await (const delta of stream) {
          accumulated += delta.content;
          opts.onDelta?.(delta.content);
          yield delta.content;
        }
      } else if (provider === 'anthropic') {
        // Build thinking options for Anthropic
        const thinkingOpts: Record<string, unknown> = {};
        let maxTokens = opts.maxTokens ?? 4096;
        if (opts.reasoning && opts.reasoning !== 'off') {
          const anthropicConfig = getReasoningConfig(opts.reasoning, 'anthropic');
          if (anthropicConfig.thinking) {
            thinkingOpts.thinking = anthropicConfig.thinking;
            // Ensure maxTokens > budget_tokens
            const budgetTokens = anthropicConfig.thinking.budget_tokens;
            if (maxTokens <= budgetTokens) {
              maxTokens = budgetTokens + 4096;
            }
          }
        }

        const stream = (client as AnthropicClient).streamContent(messages as any, {
          model: modelToUse,
          maxTokens,
          temperature,
          timeout: opts.timeout ?? DEFAULT_TIMEOUT,
          requestOptions: {
            top_p: opts.topP,
            ...thinkingOpts,
            ...opts.extra,
          },
        });

        for await (const delta of stream) {
          accumulated += delta.text;
          opts.onDelta?.(delta.text);
          yield delta.text;
        }
      } else if (provider === 'xai') {
        const stream = (client as XAIClient).streamContent(messages as any, {
          model: modelToUse,
          temperature,
          maxTokens: opts.maxTokens,
          timeout: opts.timeout ?? DEFAULT_TIMEOUT,
          requestOptions: {
            top_p: opts.topP,
            stop: opts.stop,
            ...opts.extra,
          },
        });

        for await (const delta of stream) {
          accumulated += delta.content;
          opts.onDelta?.(delta.content);
          yield delta.content;
        }
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }

      // Append to history after successful stream
      this._messages.push(Message.assistant(accumulated));
      opts.onComplete?.(accumulated);
    } catch (error) {
      opts.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Stream and accumulate the full response.
   * Convenience method that collects all chunks.
   *
   * @param options - Stream options
   * @returns Full accumulated content
   */
  async streamAccumulate(options?: StreamOptions): Promise<string> {
    let content = '';
    for await (const delta of this.stream(options)) {
      content += delta;
    }
    return content;
  }

  /**
   * Generate structured data using a Schema.
   * Appends assistant response to history.
   *
   * @param schema - Schema class or instance
   * @param options - Generation options
   * @returns Populated schema instance
   */
  async generateData<T extends SchemaInstance>(
    schema: T | (new () => T),
    options?: GenerateOptions,
  ): Promise<T> {
    const instance = typeof schema === 'function' ? Schema.create(schema) : Schema.clone(schema);
    const jsonSchema = Schema.toJSON(instance);

    const opts = mergeOptions(this._defaults, options);
    const provider = this._resolveProvider(opts.provider);
    const client = this._getClient(provider);

    const messages = this._formatMessages(provider);

    let content: string;

    // Use the shared makeOpenAIStrict helper from the OpenAI provider
    // to transform schemas for strict structured output mode

    if (provider === 'openai') {
      // OpenAI strict structured output has specific requirements
      const openaiSchema = makeOpenAIStrict(jsonSchema as Record<string, unknown>);
      const result = await (client as OpenAIClient).chatStructured(
        messages as any,
        {
          name: 'response',
          schema: openaiSchema as Record<string, unknown>,
          strict: true,
        },
        {
          model: this._model,
          temperature: opts.temperature,
          maxTokens: opts.maxTokens,
          timeout: opts.timeout ?? DEFAULT_TIMEOUT,
          ...opts.extra,
        },
      );
      content = JSON.stringify(result);
      Schema.parse(instance, result);
    } else if (provider === 'xai') {
      // xAI also supports structured output (same format as OpenAI)
      const xaiSchema = makeOpenAIStrict(jsonSchema as Record<string, unknown>);
      const result = await (client as XAIClient).chatStructured(
        messages as any,
        {
          name: 'response',
          schema: xaiSchema as Record<string, unknown>,
          strict: true,
        },
        {
          model: this._model,
          temperature: opts.temperature,
          maxTokens: opts.maxTokens,
          timeout: opts.timeout ?? DEFAULT_TIMEOUT,
          ...opts.extra,
        },
      );
      content = JSON.stringify(result);
      Schema.parse(instance, result);
    } else if (provider === 'anthropic') {
      // Anthropic uses tool-based structured output
      const result = await (client as AnthropicClient).messageStructured(
        messages as any,
        {
          name: 'response',
          schema: jsonSchema as Record<string, unknown>,
        },
        {
          model: this._model,
          maxTokens: opts.maxTokens ?? 4096,
          temperature: opts.temperature,
          timeout: opts.timeout ?? DEFAULT_TIMEOUT,
          ...opts.extra,
        },
      );
      content = JSON.stringify(result);
      Schema.parse(instance, result);
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    // Append to history
    this._messages.push(Message.assistant(content));

    return instance as T;
  }

  /**
   * Internal: Generate with tool calling loop.
   * Handles automatic tool execution and retries.
   */
  private async _generateWithToolLoop(options?: GenerateWithToolsOptions): Promise<string> {
    const opts = mergeOptions(this._defaults, options) as GenerateWithToolsOptions;
    const maxIterations = opts.maxIterations ?? DEFAULT_MAX_TOOL_ITERATIONS;
    const provider = this._resolveProvider(opts.provider);
    const client = this._getClient(provider);

    // Build tool definitions for provider
    const toolDefs = this._buildToolDefinitions(provider);

    // Track local message state for tool loop
    let localMessages = this._formatMessages(provider);
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      // Make request with tools
      const toolCalls = await this._requestWithTools(
        client,
        provider,
        localMessages,
        toolDefs,
        opts,
      );

      // No tool calls = final response
      if (!toolCalls || toolCalls.length === 0) {
        // Get final content and return
        const content = await this._extractFinalContent(client, provider, localMessages, opts);
        this._messages.push(Message.assistant(content));
        return content;
      }

      // Execute tools
      const ctx: ToolContext = { model: this._model, provider };
      const results = await this._executeToolCalls(toolCalls, ctx, opts);

      // Append tool results to local messages
      localMessages = this._appendToolResults(provider, localMessages, toolCalls, results);
    }

    // Max iterations reached - get whatever response we have
    const content = await this._extractFinalContent(client, provider, localMessages, opts);
    this._messages.push(Message.assistant(content));
    return content;
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  /**
   * Serialize to JSON object.
   */
  toJSON(): ChatJSON {
    return {
      model: this._model,
      messages: this._messages.map((m) => m.toJSON()),
      config: Object.keys(this._defaults).length > 0 ? { defaults: this._defaults } : undefined,
    };
  }

  /**
   * Serialize to JSON string.
   */
  stringify(pretty = false): string {
    return JSON.stringify(this.toJSON(), null, pretty ? 2 : undefined);
  }

  /**
   * Load state from JSON object.
   * Replaces current messages and config.
   */
  fromJSON(json: ChatJSON): this {
    if (!json || typeof json !== 'object') {
      throw new TypeError('Invalid chat JSON');
    }

    if (typeof json.model === 'string') {
      this._model = json.model;
    }

    if (Array.isArray(json.messages)) {
      this._messages = json.messages.map((m) => Message.fromJSON(m));
    }

    if (json.config?.defaults) {
      this._defaults = json.config.defaults;
    }

    return this;
  }

  /**
   * Create a new Chat instance from JSON.
   */
  static fromJSON(json: ChatJSON | string): Chat {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const chat = new Chat({ model: data.model, defaults: data.config?.defaults });
    chat.fromJSON(data);
    return chat;
  }

  /**
   * Create a clone of this chat with copied state.
   */
  clone(): Chat {
    const chat = new Chat({ model: this._model, defaults: { ...this._defaults } });
    chat._messages = this._messages.map(
      (m) =>
        new Message(m.role, m.content, {
          name: m.name,
          toolCallId: m.toolCallId,
          metadata: m.metadata ? { ...m.metadata } : undefined,
        }),
    );
    chat._tools = [...this._tools];
    return chat;
  }

  /**
   * Fork this chat - creates a clone for branching conversations.
   */
  fork(): Chat {
    return this.clone();
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Resolve provider from option or model detection.
   */
  private _resolveProvider(override?: ProviderId): ProviderId {
    if (override) {
      if (!isProviderActive(override)) {
        throw new Error(`Provider ${override} is not configured (missing API key)`);
      }
      return override;
    }

    const detected = detectProviderByModel(this._model);
    if (!detected) {
      throw new Error(`Could not detect provider for model: ${this._model}`);
    }

    if (!isProviderActive(detected)) {
      throw new Error(`Provider ${detected} is not configured (missing API key)`);
    }

    return detected;
  }

  /**
   * Get or create cached client for provider.
   */
  private _getClient(provider: ProviderId): OpenAIClient | AnthropicClient | XAIClient {
    if (provider === 'openai') {
      if (!this._clients.openai) {
        this._clients.openai = createOpenAIClient({ apiKey: getApiKey('openai') });
      }
      return this._clients.openai;
    }

    if (provider === 'anthropic') {
      if (!this._clients.anthropic) {
        this._clients.anthropic = createAnthropicClient({ apiKey: getApiKey('anthropic') });
      }
      return this._clients.anthropic;
    }

    if (provider === 'xai') {
      if (!this._clients.xai) {
        this._clients.xai = createXAIClient({ apiKey: getApiKey('xai') });
      }
      return this._clients.xai;
    }

    throw new Error(`Unknown provider: ${provider}`);
  }

  /**
   * Format messages for provider.
   * Returns a loosely-typed array for provider compatibility.
   */
  private _formatMessages(_provider: ProviderId): Array<Record<string, unknown>> {
    if (_provider === 'anthropic') {
      // Anthropic: system messages go to top-level system param
      // Filter them out of messages array
      return this._messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        }));
    }

    // OpenAI and xAI use same format
    return this._messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  /**
   * Build tool definitions for provider.
   */
  private _buildToolDefinitions(
    _provider: ProviderId,
  ): Array<{ name: string; description: string; parameters: Record<string, unknown> }> {
    return this._tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.getParametersSchema() as Record<string, unknown>,
    }));
  }

  /**
   * Request with tools and extract tool calls.
   */
  private async _requestWithTools(
    client: OpenAIClient | AnthropicClient | XAIClient,
    provider: ProviderId,
    messages: Array<Record<string, unknown>>,
    toolDefs: Array<{ name: string; description: string; parameters: Record<string, unknown> }>,
    opts: GenerateWithToolsOptions,
  ): Promise<ToolCall[] | null> {
    // This is a simplified implementation
    // In practice, we'd call the provider's tool-aware endpoint
    // and parse the tool calls from the response

    if (provider === 'openai') {
      const tools = toolDefs.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));

      const result = await (client as OpenAIClient).chatWithTools(messages as any, tools as any, {
        model: this._model,
        timeout: opts.timeout ?? DEFAULT_TIMEOUT,
      });

      if (result.type === 'tool_calls') {
        return result.toolCalls.map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          args: JSON.parse(tc.function.arguments),
        }));
      }
      return null;
    }

    if (provider === 'xai') {
      const tools = toolDefs.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));

      const result = await (client as XAIClient).chatWithTools(messages as any, tools as any, {
        model: this._model,
        timeout: opts.timeout ?? DEFAULT_TIMEOUT,
      });

      if (result.type === 'tool_calls') {
        return result.toolCalls.map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          args: JSON.parse(tc.function.arguments),
        }));
      }
      return null;
    }

    if (provider === 'anthropic') {
      const tools = toolDefs.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));

      const result = await (client as AnthropicClient).messageWithTools(
        messages as any,
        tools as any,
        {
          model: this._model,
          maxTokens: opts.maxTokens ?? 4096,
          timeout: opts.timeout ?? DEFAULT_TIMEOUT,
        },
      );

      if (result.type === 'tool_use') {
        return result.toolUses.map((tu) => ({
          id: tu.id,
          name: tu.name,
          args: tu.input,
        }));
      }
      return null;
    }

    return null;
  }

  /**
   * Execute tool calls.
   */
  private async _executeToolCalls(
    calls: ToolCall[],
    ctx: ToolContext,
    opts: GenerateWithToolsOptions,
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const call of calls) {
      const tool = this._tools.find((t) => t.name === call.name);

      if (!tool) {
        results.push({
          id: call.id,
          result: { error: `Unknown tool: ${call.name}` },
          success: false,
          error: `Unknown tool: ${call.name}`,
        });
        continue;
      }

      const result = await tool.executeCall(call, ctx);

      if (!result.success && opts.onToolError === 'throw') {
        throw new Error(result.error);
      }

      results.push(result);
    }

    return results;
  }

  /**
   * Append tool results to messages.
   */
  private _appendToolResults(
    provider: ProviderId,
    messages: Array<Record<string, unknown>>,
    calls: ToolCall[],
    results: ToolResult[],
  ): Array<Record<string, unknown>> {
    const newMessages = [...messages];

    if (provider === 'anthropic') {
      // Anthropic format: assistant with tool_use, then user with tool_result
      const toolUseContent = calls.map((call) => ({
        type: 'tool_use',
        id: call.id,
        name: call.name,
        input: call.args,
      }));

      newMessages.push({ role: 'assistant', content: toolUseContent });

      const toolResultContent = results.map((r) => ({
        type: 'tool_result',
        tool_use_id: r.id,
        content: r.success ? JSON.stringify(r.result) : r.error,
      }));

      newMessages.push({ role: 'user', content: toolResultContent });
    } else {
      // OpenAI/xAI format
      const assistantMsg = {
        role: 'assistant',
        content: null as string | null,
        tool_calls: calls.map((call) => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: JSON.stringify(call.args) },
        })),
      };

      newMessages.push(assistantMsg as any);

      for (const result of results) {
        newMessages.push({
          role: 'tool',
          tool_call_id: result.id,
          content: result.success ? JSON.stringify(result.result) : result.error!,
        } as any);
      }
    }

    return newMessages;
  }

  /**
   * Extract final text content from last response.
   */
  private async _extractFinalContent(
    client: OpenAIClient | AnthropicClient | XAIClient,
    provider: ProviderId,
    messages: Array<Record<string, unknown>>,
    opts: GenerateWithToolsOptions,
  ): Promise<string> {
    // Make a final request to get text content
    if (provider === 'openai') {
      return (client as OpenAIClient).chatSimple(messages as any, {
        model: this._model,
        timeout: opts.timeout ?? DEFAULT_TIMEOUT,
      });
    }

    if (provider === 'anthropic') {
      return (client as AnthropicClient).messageSimple(messages as any, {
        model: this._model,
        maxTokens: opts.maxTokens ?? 4096,
        timeout: opts.timeout ?? DEFAULT_TIMEOUT,
      });
    }

    if (provider === 'xai') {
      return (client as XAIClient).chatSimple(messages as any, {
        model: this._model,
        timeout: opts.timeout ?? DEFAULT_TIMEOUT,
      });
    }

    return '';
  }
}
