/**
 * JSON values accepted by Chatoyant APIs.
 *
 * @example
 * ```ts
 * const payload: JsonValue = { q: "needle", limit: 5 };
 * ```
 */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

/** A JSON object with string keys. */
export type JsonObject = { [key: string]: JsonValue };

/** A JSON Schema document. Draft 2020-12 allows boolean schemas and object schemas. */
export type JsonSchemaValue = boolean | JsonObject;

/** Supported provider identifiers. */
export type ProviderId = "openai" | "anthropic" | "xai" | "local" | "openrouter";

/** Provider metadata used by model detection and environment resolution. */
export interface ProviderMeta {
  name: string;
  signatures: readonly string[];
  envKey: string;
  envKeyLegacy?: string;
  baseUrl: string;
}

/** Supported provider registry keyed by provider id. */
export type ProviderRegistry = Record<ProviderId, ProviderMeta>;

/** One validation failure reported by the JSON Schema validator. */
export interface ValidationError {
  /** JSON Pointer-like path to the failing data. */
  instancePath: string;
  /** JSON Pointer-like path to the failing schema keyword. */
  schemaPath: string;
  /** JSON Schema keyword that failed. */
  keyword: string;
  /** Human-readable failure message. */
  message: string;
}

/** Detailed validation result. */
export interface ValidationResult {
  /** True when the value satisfies the schema. */
  valid: boolean;
  /** Validation failures. Empty when `valid` is true. */
  errors: ValidationError[];
}

/** Preloaded external schema resource used to resolve `$ref` and `$dynamicRef`. */
export interface JsonSchemaResource {
  /** Absolute URI used as the resource identifier. */
  uri: string;
  /** Resource schema. */
  schema: JsonSchemaValue;
}

/** Options for JSON Schema validation. */
export interface JsonSchemaValidateOptions {
  /** External resources available for reference resolution. */
  resources?: JsonSchemaResource[];
  /** Enable assertive `format` validation when supported. Defaults to annotation-only behavior. */
  formatAssertion?: boolean;
}

/** Common field descriptor options used by `Schema.String()`, `Schema.Object()`, and friends. */
export type FieldOptions = {
  /** Human-readable field description, emitted into JSON Schema. */
  description?: string;
  /** Mark the field optional in object shapes. Optional descriptors also accept null for JS compatibility. */
  optional?: boolean;
  /** JSON Schema default annotation. */
  default?: unknown;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
};

/** Runtime marker object returned by the `Schema.*` descriptor helpers. */
export interface SchemaField<T = unknown, Optional extends boolean = false> {
  readonly __chatoyantSchemaField: true;
  readonly optional: Optional;
  readonly schema: JsonSchemaValue;
  readonly options: FieldOptions;
}

type OptionalFlag<O> = O extends { optional: true } ? true : false;
type FieldValue<F> = F extends SchemaField<infer T, boolean> ? T : never;
type RequiredFieldKeys<T> = {
  [K in keyof T]-?: T[K] extends SchemaField<unknown, true>
    ? never
    : T[K] extends SchemaField<unknown, boolean>
      ? K
      : never;
}[keyof T];
type OptionalFieldKeys<T> = {
  [K in keyof T]-?: T[K] extends SchemaField<unknown, true> ? K : never;
}[keyof T];

/** Infer a plain object type from a `Schema` class or shape object. */
export type InferSchemaInstance<T> = {
  [K in RequiredFieldKeys<T>]: FieldValue<T[K]>;
} & {
  [K in OptionalFieldKeys<T>]?: FieldValue<T[K]> | null;
};

/** Constructor type for class-based schemas. */
export type SchemaClass<T extends Schema = Schema> = new () => T;

/** Input accepted anywhere Chatoyant expects a schema. */
export type SchemaInput<T = unknown> =
  | JsonSchemaValue
  | SchemaField<T, boolean>
  | Schema
  | JsonSchema
  | SchemaClass<any>
  | Record<string, SchemaField<any, boolean>>;

/** Loose schema input accepted by compatibility helpers. Nullish values mean an unconstrained object schema. */
export type SchemaLike<T = unknown> = SchemaInput<T> | null | undefined;

/** Infer the TypeScript value type represented by a schema-like input. */
export type InferSchemaInput<S> =
  S extends null | undefined
    ? unknown
    : S extends SchemaField<infer T, infer Optional>
      ? Optional extends true
        ? T | null | undefined
        : T
      : S extends SchemaClass<infer I>
        ? InferSchemaInstance<I>
        : S extends Schema
          ? InferSchemaInstance<S>
          : S extends Record<string, SchemaField<any, boolean>>
            ? InferSchemaInstance<S>
            : unknown;

/**
 * Standalone Draft 2020-12 JSON Schema parser, projector, and validator.
 *
 * @example
 * ```ts
 * const schema = new JsonSchema({ type: "string", minLength: 1 });
 * schema.validate("ok"); // true
 * ```
 */
export class JsonSchema {
  constructor(schema?: SchemaLike);
  readonly schema: JsonSchemaValue;
  static parse(schema: SchemaLike): JsonSchema;
  static fromJSON(json: JsonSchemaValue): JsonSchema;
  static validate(schema: SchemaLike, data: unknown, options?: JsonSchemaValidateOptions): ValidationResult;
  static projectOpenAIStrict(schema: SchemaLike): JsonSchema;
  validate(data: unknown, options?: JsonSchemaValidateOptions): boolean;
  validateDetailed(data: unknown, options?: JsonSchemaValidateOptions): ValidationResult;
  toJSON(): JsonSchemaValue;
  stringify(): string;
}

/** Error thrown by schema parsing/validation helpers. */
export class SchemaError extends Error {
  constructor(message: string, details?: ValidationError[]);
  readonly details?: ValidationError[];
}

/**
 * Class-based schema authoring surface plus JSON Schema descriptor helpers.
 *
 * @example
 * ```ts
 * class SearchArgs extends Schema {
 *   q = Schema.String({ minLength: 1 });
 *   limit = Schema.Integer({ optional: true, minimum: 1 });
 * }
 *
 * type SearchArgsValue = InferSchemaInput<typeof SearchArgs>;
 * ```
 */
export class Schema {
  constructor(fields?: Record<string, SchemaField<any, boolean>>);
  toJSON(): JsonSchemaValue;
  getParametersSchema(): JsonSchemaValue;
  stringify(): string;
  validate(data: unknown): boolean;
  parse<T = unknown>(data: T): T;
  static create<T extends Schema>(schemaLike: SchemaClass<T>): T;
  static create(schemaLike?: Schema | Record<string, SchemaField<any, boolean>> | null): Schema;
  static parse<S extends SchemaLike>(schemaLike: S, data: unknown, options?: JsonSchemaValidateOptions): InferSchemaInput<S>;
  static validate<S extends SchemaLike>(schemaLike: S, data: unknown, options?: JsonSchemaValidateOptions): boolean;
  static validateDetailed<S extends SchemaLike>(schemaLike: S, data: unknown, options?: JsonSchemaValidateOptions): ValidationResult;
  static stringify(schemaLike: SchemaLike): string;
  static clone<T>(value: T): T;
  static toObject<T>(value: T): T;
  static toJSON(schemaLike: SchemaLike): JsonSchemaValue;
  static String<O extends FieldOptions = {}>(options?: O): SchemaField<string, OptionalFlag<O>>;
  static Number<O extends FieldOptions = {}>(options?: O): SchemaField<number, OptionalFlag<O>>;
  static Integer<O extends FieldOptions = {}>(options?: O): SchemaField<number, OptionalFlag<O>>;
  static Boolean<O extends FieldOptions = {}>(options?: O): SchemaField<boolean, OptionalFlag<O>>;
  static Null<O extends FieldOptions = {}>(options?: O): SchemaField<null, OptionalFlag<O>>;
  static Literal<const T extends JsonValue, O extends FieldOptions = {}>(value: T, options?: O): SchemaField<T, OptionalFlag<O>>;
  static Enum<const T extends readonly JsonValue[], O extends FieldOptions = {}>(values: T, options?: O): SchemaField<T[number], OptionalFlag<O>>;
  static Array<I extends SchemaLike, O extends FieldOptions = {}>(items: I, options?: O): SchemaField<Array<InferSchemaInput<I>>, OptionalFlag<O>>;
  static Object<S extends SchemaLike, O extends FieldOptions = {}>(shape: S, options?: O): SchemaField<InferSchemaInput<S>, OptionalFlag<O>>;
}

/** Message role understood by provider-neutral chat state. */
export type Role = "system" | "user" | "assistant" | "tool";

/** Provider-neutral tool call representation. */
export interface ToolCall {
  id: string;
  name: string;
  args?: unknown;
  arguments?: unknown;
}

/** JSON representation accepted by `Message.fromJSON()` and emitted by `Message.toJSON()`. */
export interface MessageJSON {
  role: Role;
  content: string;
  name?: string;
  toolCallId?: string;
  tool_call_id?: string;
  toolCalls?: ToolCall[];
  tool_calls?: ToolCall[];
  metadata?: unknown;
}

/**
 * Provider-neutral chat message.
 *
 * @example
 * ```ts
 * const message = Message.user("hello", { source: "cli" });
 * ```
 */
export class Message {
  constructor(role: Role, content: string, options?: Partial<MessageJSON>);
  role: Role;
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
  metadata?: unknown;
  toJSON(): MessageJSON;
  static fromJSON(json: MessageJSON): Message;
  static system(content: string, metadata?: unknown): Message;
  static user(content: string, metadata?: unknown): Message;
  static assistant(content: string, metadata?: unknown): Message;
  static assistantToolCall(toolCalls: ToolCall[], metadata?: unknown): Message;
  static tool(content: string, toolCallId: string, metadata?: unknown): Message;
  withContent(content: string): Message;
  withMetadata(metadata: unknown): Message;
  isSystem(): boolean;
  isUser(): boolean;
  isAssistant(): boolean;
  isTool(): boolean;
  hasToolCalls(): boolean;
}

/** Normalized token/cost usage. Provider-reported counts are preferred over estimates. */
export interface Usage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
  costUsd?: number;
  [key: string]: unknown;
}

/** Unified generation result returned by `Chat.generateWithResult()` and provider clients. */
export interface GenerationResult {
  content: string;
  reasoningContent: string;
  usage: Usage;
  timing: { latencyMs?: number; latency_ms?: number; timeToFirstTokenMs?: number; [key: string]: unknown };
  cost: { estimatedUsd?: number; actualUsd?: number; [key: string]: unknown };
  provider: string;
  model: string;
  cached: boolean;
  iterations: number;
  toolCalls: ToolCall[];
  finishReason?: string;
  finish_reason?: string;
  raw?: unknown;
  [key: string]: unknown;
}

/** Backward-compatible name for generation results. */
export type GenerateResult = GenerationResult;

/** Common high-level generation options. Unknown provider-specific options can be passed through `extra`. */
export interface GenerationOptions {
  model?: string;
  provider?: "openai" | "anthropic" | "xai" | "openrouter" | "local" | (string & {});
  system?: string;
  apiKey?: string;
  baseUrl?: string;
  localBaseUrl?: string;
  localApiKey?: string;
  localTimeout?: number;
  anthropicVersion?: string;
  temperature?: number;
  creativity?: "precise" | "balanced" | "creative" | "wild";
  reasoning?: "off" | "none" | "low" | "medium" | "high" | (string & {});
  maxTokens?: number;
  max_tokens?: number;
  topP?: number;
  top_p?: number;
  stop?: string | string[];
  frequencyPenalty?: number;
  frequency_penalty?: number;
  presencePenalty?: number;
  presence_penalty?: number;
  timeout?: number;
  /**
   * Alias for `maxToolIterations`, retained for compatibility with the
   * original JavaScript package.
   */
  maxIterations?: number;
  maxToolIterations?: number;
  toolTimeout?: number;
  toolChoice?: unknown;
  webSearch?: boolean;
  searchParameters?: Record<string, unknown>;
  search_parameters?: Record<string, unknown>;
  thinkingBudget?: number;
  thinking_budget?: number;
  aspectRatio?: string;
  aspect_ratio?: string;
  resolution?: string;
  duration?: number;
  image?: unknown;
  imageUrl?: string;
  image_url?: string;
  video?: unknown;
  videoUrl?: string;
  video_url?: string;
  poll?: boolean;
  pollIntervalMs?: number;
  maxAttempts?: number;
  responseFormat?: string;
  response_format?: string;
  requestOptions?: Record<string, unknown>;
  httpReferer?: string;
  title?: string;
  extra?: Record<string, unknown>;
  onDelta?: (chunk: string) => void;
  __chatoyantTestFake?: boolean;
  [key: string]: unknown;
}

/** Backward-compatible name for generation options used by `Chat.generate()`. */
export type GenerateWithToolsOptions = GenerationOptions;

/** Constructor config for `Chat` and provider clients. */
export interface ChatConfig extends GenerationOptions {
  defaults?: GenerationOptions;
}

/** Polling controls for asynchronous media generation helpers. */
export interface VideoPollingOptions {
  /** Set false to return the initial provider job instead of polling. */
  poll?: boolean;
  /** Delay between status checks. Defaults to 2000 ms. */
  pollIntervalMs?: number;
  /** Maximum number of status checks before timing out. Defaults to 60. */
  maxAttempts?: number;
}

/** Runtime context passed to tool callbacks. */
export interface ToolContext {
  model: string;
  provider: string;
}

/** Input object passed to a tool callback. */
export interface ToolExecutionInput<Args> {
  args: Args;
  ctx: ToolContext;
}

/** Structured result of executing one tool call. */
export interface ToolExecutionResult<Result = unknown> {
  id: string;
  result: Result | null;
  success: boolean;
  error?: string;
}

/**
 * Tool definition consumed by `new Tool()` and `createTool()`.
 *
 * @example
 * ```ts
 * const search = createTool({
 *   name: "search",
 *   description: "Search documents",
 *   parameters: { q: Schema.String() },
 *   async execute({ args }) {
 *     return { ok: true, q: args.q };
 *   },
 * });
 * ```
 */
export interface ToolDefinition<P extends SchemaLike = SchemaLike, Result = unknown> {
  name: string;
  description: string;
  parameters: P;
  resultSchema?: SchemaLike<Result>;
  timeout?: number;
  execute(input: ToolExecutionInput<InferSchemaInput<P>>): Result | Promise<Result>;
}

/** Provider-neutral executable tool with argument and result validation. */
export class Tool<Args = unknown, Result = unknown> {
  constructor(definition: ToolDefinition<any, Result>);
  name: string;
  description: string;
  parameters: SchemaLike<Args>;
  resultSchema?: SchemaLike<Result>;
  timeout: number;
  getParametersSchema(): JsonSchemaValue;
  validateArgs(args: unknown): args is Args;
  parseArgs(args: unknown): Args;
  validateResult(result: unknown): result is Result;
  execute(input: ToolExecutionInput<Args>): Promise<Result>;
  executeWithTimeout(input: ToolExecutionInput<Args>, timeoutOverride?: number): Promise<Result>;
  executeCall(call: { id: string; name: string; args: Args }, ctx: ToolContext, timeoutOverride?: number): Promise<ToolExecutionResult<Result>>;
}

/** Create a `Tool` with inferred argument and result types. */
export function createTool<P extends SchemaLike, Result = unknown>(
  definition: ToolDefinition<P, Result>
): Tool<InferSchemaInput<P>, Result>;

/**
 * Stateful/fluent high-level chat facade.
 *
 * @example
 * ```ts
 * const chat = new Chat({ model: "gpt-4o" });
 * const text = await chat.system("Be terse").user("Hello").generate();
 * ```
 */
export class Chat {
  constructor(config?: ChatConfig);
  static fromJSON(json: unknown): Chat;
  model: string;
  readonly messages: Message[];
  readonly tools: Tool[];
  readonly lastResult: GenerationResult | null;
  system(content: string, metadata?: unknown): this;
  user(content: string, metadata?: unknown): this;
  assistant(content: string, metadata?: unknown): this;
  addMessage(message: Message | MessageJSON): this;
  addMessages(messages: Array<Message | MessageJSON>): this;
  clearMessages(): this;
  addTool(tool: Tool): this;
  addTools(tools: Tool[]): this;
  clearTools(): this;
  generate(options?: GenerationOptions): Promise<string>;
  generateWithResult(options?: GenerationOptions): Promise<GenerationResult>;
  stream(options?: GenerationOptions): AsyncIterable<string>;
  streamAccumulate(options?: GenerationOptions): Promise<string>;
  generateData<S extends SchemaLike>(schema: S, options?: GenerationOptions): Promise<InferSchemaInput<S>>;
  toJSON(): unknown;
  stringify(): string;
  clone(): Chat;
  fork(): Chat;
}

/** Merge generation defaults with call-specific overrides. Later values win. */
export function mergeOptions<T extends Record<string, unknown>, U extends Record<string, unknown>>(defaults?: T | null, overrides?: U | null): T & U;

/** One-shot text generation shortcut. */
export function genText(prompt: string, options?: GenerationOptions): Promise<string>;

/** One-shot structured data shortcut. The current JS compatibility path returns parsed JSON or raw text. */
export function genData<S extends SchemaLike>(prompt: string, schema: S, options?: GenerationOptions): Promise<InferSchemaInput<S>>;

/** One-shot streaming shortcut as an async iterable of text chunks. */
export function genStream(prompt: string, options?: GenerationOptions): AsyncIterable<string>;

/** One-shot streaming shortcut that accumulates all chunks into a string. */
export function genStreamAccumulate(prompt: string, options?: GenerationOptions): Promise<string>;

/** Pricing information for one model, in USD per 1M tokens unless media-specific. */
export interface ModelPricing {
  input: number;
  output: number;
  cached?: number;
  cacheWrite?: number;
  cacheWrite5m?: number;
  cacheWrite1h?: number;
  perImage?: number;
  perSecond?: number;
}

/** Result of a cost calculation. */
export interface CostResult {
  input: number;
  output: number;
  cached: number;
  cacheWrite: number;
  actualUsd?: number;
  total: number;
}

/** Chat message shape accepted by token-budget helpers. */
export interface TokenMessage {
  role: string;
  content: string | null;
  name?: string;
}

/** Options for splitting text into token-sized chunks. */
export interface ChunkOptions {
  maxTokens: number;
  overlap?: number;
  separator?: string | RegExp;
}

/** Options for fitting a conversation into a token budget. */
export interface FitOptions {
  maxTokens: number;
  reserveForResponse?: number;
  provider?: "openai" | "anthropic" | "xai" | "local" | "openrouter";
}

export const TOKEN_RATIOS: Readonly<Record<"english" | "code" | "cjk" | "mixed", number>>;
export const CONTEXT_WINDOWS: Readonly<Record<string, number>>;
export const PRICING: Readonly<Record<string, ModelPricing>>;

/** Fast heuristic token estimate for text. */
export function estimateTokens(text: string): number;
export function estimateTokensMany(texts: string[]): number;
export function estimateTokensWithRatio(text: string, charsPerToken: number): number;
export function estimatePromptTokens(prompt: string, response?: string): { input: number; output: number; total: number };
export function estimateMessageTokens(message: TokenMessage, provider?: ProviderId): number;
export function estimateChatTokens(messages: TokenMessage[], provider?: ProviderId): number;
export function estimateSystemPromptTokens(systemPrompt: string, provider?: ProviderId): number;
export function getMessageOverhead(provider?: ProviderId): { perMessage: number; conversation: number };
export function calculateAvailableTokens(params: {
  contextWindow: number;
  systemPromptTokens?: number;
  reserveForResponse?: number;
  historyTokens?: number;
}): number;
export function messagesFitBudget(messages: TokenMessage[], maxTokens: number, provider?: ProviderId): boolean;
export function calculateCost(params: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  cacheWriteTokens?: number;
  actualCostUsd?: number;
}): CostResult;
export function calculateCostCustom(params: {
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  cacheWriteTokens?: number;
  actualCostUsd?: number;
  pricing: ModelPricing;
}): CostResult;
export function calculateBatchCost(
  requests: Array<{ inputTokens: number; outputTokens: number; cachedTokens?: number; cacheWriteTokens?: number }>,
  model: string
): CostResult;
export function calculateImageCost(params: { model: string; count: number }): number;
export function calculateVideoCost(params: { model: string; durationSeconds: number }): number;
export function estimateCost(params: { model: string; inputTokens?: number; inputText?: string; expectedOutputTokens: number }): CostResult;
export function getCostPerToken(model: string): { input: number; output: number; cached: number; cacheWrite: number } | undefined;
export function getPricing(model: string): ModelPricing | undefined;
export function hasPricing(model: string): boolean;
export function getContextWindow(model: string): number | undefined;
export function hasContextWindow(model: string): boolean;
export function splitText(text: string, options: ChunkOptions): string[];
export function truncateContent(content: string, maxTokens: number, ellipsis?: string): string;
export function fitMessages<T extends TokenMessage>(messages: T[], options: FitOptions): T[];
export function paginateMessages<T extends TokenMessage>(messages: T[], tokensPerPage: number, provider?: ProviderId): T[][];
export function estimateChunkCount(text: string, options: ChunkOptions): number;

/** Error thrown when provider configuration or HTTP operations fail. */
export class ProviderError extends Error {
  constructor(message: string, providerId?: ProviderId, envKey?: string);
  readonly providerId?: ProviderId;
  readonly envKey?: string;
  static missingApiKey(providerId: ProviderId): ProviderError;
  static unknownProvider(model: string): ProviderError;
}

export const PROVIDERS: Readonly<ProviderRegistry>;
export const PROVIDER_IDS: readonly ProviderId[];
export const OPENAI_MODELS: readonly string[];
export const ANTHROPIC_MODELS: readonly string[];
export const XAI_MODELS: readonly string[];
export const MODELS_BY_PROVIDER: Readonly<Record<ProviderId, readonly string[]>>;

export function detectProviderByModel(model: string): ProviderId | null;
export function isProviderActive(providerId: ProviderId): boolean;
export function activeProviders(): ProviderId[];
export function assertProviderActive(providerId: ProviderId): void;
export function getApiKey(providerId: ProviderId): string;
export function getBaseUrl(providerId: ProviderId): string;
export function resolveProvider(model: string): ProviderId;
export function getModelsForProvider(providerId: ProviderId): readonly string[];
export function getAllKnownModels(): readonly string[];
export function isKnownModel(model: string): boolean;

/** Common provider-client interface. */
export interface ProviderClient {
  readonly provider: string;
  readonly config: GenerationOptions;
  getRequestOptions(): GenerationOptions;
  getChatOptions(overrides?: GenerationOptions): GenerationOptions;
  getEmbeddingOptions(overrides?: GenerationOptions): GenerationOptions;
  getImageOptions(overrides?: GenerationOptions): GenerationOptions;
  getVideoOptions(overrides?: GenerationOptions): GenerationOptions;
  chat(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<GenerationResult>;
  chatSimple(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<string>;
  chatWithTools(messages: Array<Message | MessageJSON> | unknown[], tools: Tool[] | unknown[], options?: GenerationOptions): Promise<unknown>;
  chatStructured<T = unknown>(messages: Array<Message | MessageJSON> | unknown[], schema: unknown, options?: GenerationOptions): Promise<T>;
  chatWithWebSearch(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<GenerationResult>;
  message(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<GenerationResult>;
  messageSimple(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<string>;
  messageWithTools(messages: Array<Message | MessageJSON> | unknown[], tools: Tool[] | unknown[], options?: GenerationOptions): Promise<unknown>;
  messageStructured<T = unknown>(messages: Array<Message | MessageJSON> | unknown[], schema: unknown, options?: GenerationOptions): Promise<T>;
  stream(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): AsyncIterable<string>;
  streamContent(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): AsyncIterable<string>;
  streamAccumulate(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions, onChunk?: (delta: unknown) => void): Promise<string>;
  streamReadable(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): ReadableStream<string>;
  listModels(options?: GenerationOptions): Promise<unknown>;
  listAllModels(options?: GenerationOptions): Promise<unknown>;
  listModelIds(options?: GenerationOptions): Promise<string[]>;
  listLanguageModels(options?: GenerationOptions): Promise<unknown>;
  listImageGenerationModels(options?: GenerationOptions): Promise<unknown>;
  getModel(modelId: string, options?: GenerationOptions): Promise<unknown>;
  getLanguageModel(modelId: string, options?: GenerationOptions): Promise<unknown>;
  getImageGenerationModel(modelId: string, options?: GenerationOptions): Promise<unknown>;
  getLanguageModelList(options?: GenerationOptions): Promise<Array<{ id: string; [key: string]: unknown }>>;
  getImageGenerationModelList(options?: GenerationOptions): Promise<Array<{ id: string; [key: string]: unknown }>>;
  modelExists(modelId: string, options?: GenerationOptions): Promise<boolean>;
  embed(input: string | string[], options?: GenerationOptions): Promise<unknown>;
  embedOne(input: string, options?: GenerationOptions): Promise<number[]>;
  embedMany(inputs: string[], options?: GenerationOptions): Promise<number[][]>;
  cosineSimilarity(left: number[], right: number[]): number;
  findSimilar<T extends { embedding?: number[]; vector?: number[] }>(query: number[], corpus: T[], options?: { threshold?: number; limit?: number }): Array<T & { similarity: number }>;
  generateImage(prompt: string, options?: GenerationOptions): Promise<unknown>;
  generateImageUrl(prompt: string, options?: GenerationOptions): Promise<string>;
  generateImageBase64(prompt: string, options?: GenerationOptions): Promise<string>;
  generateImageWithPrompt(prompt: string, options?: GenerationOptions): Promise<unknown>;
  generateImages(prompt: string, count: number, options?: GenerationOptions): Promise<unknown[]>;
  editImage(image: unknown, prompt: string, options?: GenerationOptions): Promise<unknown>;
  editImageUrl(image: unknown, prompt: string, options?: GenerationOptions): Promise<string>;
  editImageBase64(image: unknown, prompt: string, options?: GenerationOptions): Promise<string>;
  editMultipleImages(images: unknown[], prompt: string, options?: GenerationOptions): Promise<unknown>;
  startVideoGeneration(prompt: string, options?: GenerationOptions): Promise<unknown>;
  getVideoStatus(id: string, options?: GenerationOptions): Promise<unknown>;
  generateVideo(prompt: string, options?: GenerationOptions, pollingOptions?: VideoPollingOptions): Promise<unknown>;
  generateVideoUrl(prompt: string, options?: GenerationOptions, pollingOptions?: VideoPollingOptions): Promise<string>;
  generateVideoFromImage(image: unknown, prompt: string, options?: GenerationOptions, pollingOptions?: VideoPollingOptions): Promise<unknown>;
  editVideo(video: unknown, prompt: string, options?: GenerationOptions): Promise<unknown>;
}

/** OpenAI high-level provider client. */
export class OpenAIClient implements ProviderClient {
  constructor(config?: GenerationOptions);
  readonly provider: string;
  readonly config: GenerationOptions;
  chat(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<GenerationResult>;
  chatSimple(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<string>;
  message(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<GenerationResult>;
}
export interface OpenAIClient extends ProviderClient {}

/** Anthropic high-level provider client. */
export class AnthropicClient implements ProviderClient {
  constructor(config?: GenerationOptions);
  readonly provider: string;
  readonly config: GenerationOptions;
  chat(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<GenerationResult>;
  chatSimple(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<string>;
  message(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<GenerationResult>;
}
export interface AnthropicClient extends ProviderClient {}

/** xAI high-level provider client. */
export class XAIClient implements ProviderClient {
  constructor(config?: GenerationOptions);
  readonly provider: string;
  readonly config: GenerationOptions;
  chat(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<GenerationResult>;
  chatSimple(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<string>;
  message(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<GenerationResult>;
}
export interface XAIClient extends ProviderClient {}

/** Local OpenAI-compatible provider client. */
export class LocalClient implements ProviderClient {
  constructor(config?: GenerationOptions);
  readonly provider: string;
  readonly config: GenerationOptions;
  chat(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<GenerationResult>;
  chatSimple(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<string>;
  message(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<GenerationResult>;
}
export interface LocalClient extends ProviderClient {}

/** OpenRouter provider client. */
export class OpenRouterClient implements ProviderClient {
  constructor(config?: GenerationOptions);
  readonly provider: string;
  readonly config: GenerationOptions;
  chat(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<GenerationResult>;
  chatSimple(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<string>;
  message(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<GenerationResult>;
}
export interface OpenRouterClient extends ProviderClient {}

export function createOpenAIClient(config?: GenerationOptions): OpenAIClient;
export function createAnthropicClient(config?: GenerationOptions): AnthropicClient;
export function createXAIClient(config?: GenerationOptions): XAIClient;
export function createLocalClient(config?: GenerationOptions): LocalClient;
export function createOpenRouterClient(config?: GenerationOptions): OpenRouterClient;
export function createProviderClient(provider: "openai", config?: GenerationOptions): OpenAIClient;
export function createProviderClient(provider: "anthropic", config?: GenerationOptions): AnthropicClient;
export function createProviderClient(provider: "xai", config?: GenerationOptions): XAIClient;
export function createProviderClient(provider: "local", config?: GenerationOptions): LocalClient;
export function createProviderClient(provider: "openrouter", config?: GenerationOptions): OpenRouterClient;
export function createProviderClient(provider: string, config?: GenerationOptions): ProviderClient;

/** Package version for the OCaml/Melange port. */
export const version: string;
export const DEFAULT_TIMEOUT: number;
export const DEFAULT_RETRIES: number;
export const DEFAULT_TOOL_TIMEOUT: number;
export const DEFAULT_MAX_TOOL_ITERATIONS: number;

/** Namespace for one provider family. */
export interface ProviderFunctionNamespace {
  chat(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<GenerationResult>;
  chatSimple(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<string>;
  chatStructured<T = unknown>(messages: Array<Message | MessageJSON> | unknown[], schema: unknown, options?: GenerationOptions): Promise<T>;
  chatWithTools(messages: Array<Message | MessageJSON> | unknown[], tools: Tool[] | unknown[], options?: GenerationOptions): Promise<unknown>;
  chatStream(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): AsyncIterable<string>;
  chatStreamContent(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): AsyncIterable<string>;
  chatStreamAccumulate(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions, onChunk?: (delta: unknown) => void): Promise<string>;
  chatStreamReadable(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): ReadableStream<string>;
  listModels(options?: GenerationOptions): Promise<unknown>;
  listModelIds(options?: GenerationOptions): Promise<string[]>;
  getModel(modelId: string, options?: GenerationOptions): Promise<unknown>;
  modelExists(modelId: string, options?: GenerationOptions): Promise<boolean>;
  requestRaw(path: string, options?: GenerationOptions & { method?: string; headers?: Record<string, string>; body?: unknown; json?: unknown }): Promise<Response>;
  request(path: string, options?: GenerationOptions & { method?: string; headers?: Record<string, string>; body?: unknown; json?: unknown }): Promise<unknown>;
  requestGet(path: string, options?: GenerationOptions & { headers?: Record<string, string> }): Promise<unknown>;
}

export interface OpenAINamespace extends ProviderFunctionNamespace {
  Client: typeof OpenAIClient;
  create: typeof createOpenAIClient;
  createClient: typeof createOpenAIClient;
  embed(input: string | string[], options?: GenerationOptions): Promise<unknown>;
  embedOne(input: string, options?: GenerationOptions): Promise<number[]>;
  embedMany(inputs: string[], options?: GenerationOptions): Promise<number[][]>;
  cosineSimilarity(left: number[], right: number[]): number;
  findSimilar<T extends { embedding?: number[]; vector?: number[] }>(query: number[], corpus: T[], options?: { threshold?: number; limit?: number }): Array<T & { similarity: number }>;
  generateImage(prompt: string, options?: GenerationOptions): Promise<unknown>;
  generateImageUrl(prompt: string, options?: GenerationOptions): Promise<string>;
  generateImageBase64(prompt: string, options?: GenerationOptions): Promise<string>;
  generateImages(prompt: string, count: number, options?: GenerationOptions): Promise<unknown[]>;
  generateImageWithPrompt(prompt: string, options?: GenerationOptions): Promise<unknown>;
  makeOpenAIStrict(schema: JsonSchemaValue): JsonSchemaValue;
  needsOpenAIStrictTransform(schema: JsonSchemaValue): boolean;
  BASE_URL: string;
  DEFAULT_TIMEOUT: number;
}

export interface AnthropicNamespace {
  Client: typeof AnthropicClient;
  create: typeof createAnthropicClient;
  createClient: typeof createAnthropicClient;
  createMessage(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<GenerationResult>;
  messageSimple(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<string>;
  messageStructured<T = unknown>(messages: Array<Message | MessageJSON> | unknown[], schema: unknown, options?: GenerationOptions): Promise<T>;
  messageWithTools(messages: Array<Message | MessageJSON> | unknown[], tools: Tool[] | unknown[], options?: GenerationOptions): Promise<unknown>;
  messageStream(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): AsyncIterable<string>;
  messageStreamContent(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): AsyncIterable<string>;
  messageStreamAccumulate(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions, onDelta?: (delta: unknown) => void): Promise<string>;
  messageStreamReadable(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): ReadableStream<string>;
  extractText(response: unknown): string;
  extractToolUses(response: unknown): unknown[];
  listModels(options?: GenerationOptions): Promise<unknown>;
  listAllModels(options?: GenerationOptions): Promise<unknown>;
  listModelIds(options?: GenerationOptions): Promise<string[]>;
  getModel(modelId: string, options?: GenerationOptions): Promise<unknown>;
  modelExists(modelId: string, options?: GenerationOptions): Promise<boolean>;
  requestRaw(path: string, options?: GenerationOptions & { method?: string; headers?: Record<string, string>; body?: unknown; json?: unknown }): Promise<Response>;
  request(path: string, options?: GenerationOptions & { method?: string; headers?: Record<string, string>; body?: unknown; json?: unknown }): Promise<unknown>;
  requestGet(path: string, options?: GenerationOptions & { headers?: Record<string, string> }): Promise<unknown>;
  API_VERSION: string;
  BASE_URL: string;
  DEFAULT_TIMEOUT: number;
}

export interface XAINamespace extends ProviderFunctionNamespace {
  Client: typeof XAIClient;
  create: typeof createXAIClient;
  createClient: typeof createXAIClient;
  embed(input: string | string[], options?: GenerationOptions): Promise<unknown>;
  embedOne(input: string, options?: GenerationOptions): Promise<number[]>;
  embedMany(inputs: string[], options?: GenerationOptions): Promise<number[][]>;
  cosineSimilarity(left: number[], right: number[]): number;
  findSimilar<T extends { embedding?: number[]; vector?: number[] }>(query: number[], corpus: T[], options?: { threshold?: number; limit?: number }): Array<T & { similarity: number }>;
  generateImage(prompt: string, options?: GenerationOptions): Promise<unknown>;
  generateImageUrl(prompt: string, options?: GenerationOptions): Promise<string>;
  generateImageBase64(prompt: string, options?: GenerationOptions): Promise<string>;
  generateImageWithPrompt(prompt: string, options?: GenerationOptions): Promise<unknown>;
  generateImages(prompt: string, count: number, options?: GenerationOptions): Promise<unknown[]>;
  chatWithWebSearch(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<GenerationResult>;
  editImage(image: unknown, prompt: string, options?: GenerationOptions): Promise<unknown>;
  editImageUrl(image: unknown, prompt: string, options?: GenerationOptions): Promise<string>;
  editImageBase64(image: unknown, prompt: string, options?: GenerationOptions): Promise<string>;
  editMultipleImages(images: unknown[], prompt: string, options?: GenerationOptions): Promise<unknown>;
  startVideoGeneration(prompt: string, options?: GenerationOptions): Promise<unknown>;
  getVideoStatus(id: string, options?: GenerationOptions): Promise<unknown>;
  generateVideo(prompt: string, options?: GenerationOptions, pollingOptions?: VideoPollingOptions): Promise<unknown>;
  generateVideoUrl(prompt: string, options?: GenerationOptions, pollingOptions?: VideoPollingOptions): Promise<string>;
  generateVideoFromImage(image: unknown, prompt: string, options?: GenerationOptions, pollingOptions?: VideoPollingOptions): Promise<unknown>;
  editVideo(video: unknown, prompt: string, options?: GenerationOptions): Promise<unknown>;
  listLanguageModels(options?: GenerationOptions): Promise<unknown>;
  listImageGenerationModels(options?: GenerationOptions): Promise<unknown>;
  getLanguageModelList(options?: GenerationOptions): Promise<Array<{ id: string; [key: string]: unknown }>>;
  getImageGenerationModelList(options?: GenerationOptions): Promise<Array<{ id: string; [key: string]: unknown }>>;
  getLanguageModel(modelId: string, options?: GenerationOptions): Promise<unknown>;
  getImageGenerationModel(modelId: string, options?: GenerationOptions): Promise<unknown>;
}

export interface LocalNamespace {
  Client: typeof LocalClient;
  create: typeof createLocalClient;
  createClient: typeof createLocalClient;
  chat(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<GenerationResult>;
  chatSimple(messages: Array<Message | MessageJSON> | unknown[], options?: GenerationOptions): Promise<string>;
}

export interface OpenRouterNamespace extends ProviderFunctionNamespace {
  Client: typeof OpenRouterClient;
  create: typeof createOpenRouterClient;
  createClient: typeof createOpenRouterClient;
  OPENROUTER_BASE_URL: string;
}

/** Root namespace for OpenAI-specific entrypoints. */
export const OpenAI: OpenAINamespace;
/** Root namespace for Anthropic-specific entrypoints. */
export const Anthropic: AnthropicNamespace;
/** Root namespace for xAI-specific entrypoints. */
export const XAI: XAINamespace;
/** Root namespace for local OpenAI-compatible inference. */
export const Local: LocalNamespace;
/** Root namespace for OpenRouter. */
export const OpenRouter: OpenRouterNamespace;

/** Namespace for core chat/message/tool classes. */
export interface CoreNamespace {
  Chat: typeof Chat;
  Message: typeof Message;
  Tool: typeof Tool;
  createTool: typeof createTool;
}

/** Namespace for schema authoring and standalone JSON Schema validation. */
export interface SchemasNamespace {
  Schema: typeof Schema;
  SchemaError: typeof SchemaError;
  JsonSchema: typeof JsonSchema;
}

/** Namespace for token estimation, pricing, context windows, and budget helpers. */
export interface TokensNamespace {
  CONTEXT_WINDOWS: typeof CONTEXT_WINDOWS;
  PRICING: typeof PRICING;
  TOKEN_RATIOS: typeof TOKEN_RATIOS;
  estimateTokens: typeof estimateTokens;
  estimateTokensMany: typeof estimateTokensMany;
  estimateTokensWithRatio: typeof estimateTokensWithRatio;
  estimatePromptTokens: typeof estimatePromptTokens;
  estimateMessageTokens: typeof estimateMessageTokens;
  estimateChatTokens: typeof estimateChatTokens;
  estimateSystemPromptTokens: typeof estimateSystemPromptTokens;
  getMessageOverhead: typeof getMessageOverhead;
  calculateAvailableTokens: typeof calculateAvailableTokens;
  messagesFitBudget: typeof messagesFitBudget;
  calculateCost: typeof calculateCost;
  calculateCostCustom: typeof calculateCostCustom;
  calculateBatchCost: typeof calculateBatchCost;
  calculateImageCost: typeof calculateImageCost;
  calculateVideoCost: typeof calculateVideoCost;
  estimateCost: typeof estimateCost;
  getCostPerToken: typeof getCostPerToken;
  getPricing: typeof getPricing;
  hasPricing: typeof hasPricing;
  getContextWindow: typeof getContextWindow;
  hasContextWindow: typeof hasContextWindow;
  splitText: typeof splitText;
  truncateContent: typeof truncateContent;
  fitMessages: typeof fitMessages;
  paginateMessages: typeof paginateMessages;
  estimateChunkCount: typeof estimateChunkCount;
}

/** Namespace for high-level one-shot generation helpers. */
export interface GenerateNamespace {
  text: typeof genText;
  data: typeof genData;
  stream: typeof genStream;
  streamAccumulate: typeof genStreamAccumulate;
  genText: typeof genText;
  genData: typeof genData;
  genStream: typeof genStream;
  genStreamAccumulate: typeof genStreamAccumulate;
}

/** Namespace for all provider client classes and factories. */
export interface ProvidersNamespace {
  OpenAI: OpenAINamespace;
  Anthropic: AnthropicNamespace;
  XAI: XAINamespace;
  Local: LocalNamespace;
  OpenRouter: OpenRouterNamespace;
  OpenAIClient: typeof OpenAIClient;
  AnthropicClient: typeof AnthropicClient;
  XAIClient: typeof XAIClient;
  LocalClient: typeof LocalClient;
  OpenRouterClient: typeof OpenRouterClient;
  create: typeof createProviderClient;
  createProviderClient: typeof createProviderClient;
  createOpenAIClient: typeof createOpenAIClient;
  createAnthropicClient: typeof createAnthropicClient;
  createXAIClient: typeof createXAIClient;
  createLocalClient: typeof createLocalClient;
  createOpenRouterClient: typeof createOpenRouterClient;
  detectProviderByModel: typeof detectProviderByModel;
  isProviderActive: typeof isProviderActive;
  activeProviders: typeof activeProviders;
  assertProviderActive: typeof assertProviderActive;
  getApiKey: typeof getApiKey;
  getBaseUrl: typeof getBaseUrl;
  resolveProvider: typeof resolveProvider;
  getModelsForProvider: typeof getModelsForProvider;
  getAllKnownModels: typeof getAllKnownModels;
  isKnownModel: typeof isKnownModel;
  PROVIDERS: typeof PROVIDERS;
  PROVIDER_IDS: typeof PROVIDER_IDS;
  OPENAI_MODELS: typeof OPENAI_MODELS;
  ANTHROPIC_MODELS: typeof ANTHROPIC_MODELS;
  XAI_MODELS: typeof XAI_MODELS;
  MODELS_BY_PROVIDER: typeof MODELS_BY_PROVIDER;
  ProviderError: typeof ProviderError;
}

/** Namespace for package defaults and legacy constant aliases. */
export interface DefaultsNamespace {
  timeout: typeof DEFAULT_TIMEOUT;
  retries: typeof DEFAULT_RETRIES;
  toolTimeout: typeof DEFAULT_TOOL_TIMEOUT;
  maxToolIterations: typeof DEFAULT_MAX_TOOL_ITERATIONS;
  DEFAULT_TIMEOUT: typeof DEFAULT_TIMEOUT;
  DEFAULT_RETRIES: typeof DEFAULT_RETRIES;
  DEFAULT_TOOL_TIMEOUT: typeof DEFAULT_TOOL_TIMEOUT;
  DEFAULT_MAX_TOOL_ITERATIONS: typeof DEFAULT_MAX_TOOL_ITERATIONS;
}

export const Core: CoreNamespace;
export const Schemas: SchemasNamespace;
export const Tokens: TokensNamespace;
export const Generate: GenerateNamespace;
export const Shortcuts: GenerateNamespace;
export const Providers: ProvidersNamespace;
export const Defaults: DefaultsNamespace;

/** Aggregate namespace for consumers who prefer a single import binding. */
export interface ChatoyantNamespace {
  version: typeof version;
  Core: CoreNamespace;
  Schemas: SchemasNamespace;
  Tokens: TokensNamespace;
  Generate: GenerateNamespace;
  Shortcuts: GenerateNamespace;
  Providers: ProvidersNamespace;
  Defaults: DefaultsNamespace;
  OpenAI: OpenAINamespace;
  Anthropic: AnthropicNamespace;
  XAI: XAINamespace;
  Local: LocalNamespace;
  OpenRouter: OpenRouterNamespace;
  Chat: typeof Chat;
  Message: typeof Message;
  Tool: typeof Tool;
  createTool: typeof createTool;
  Schema: typeof Schema;
  SchemaError: typeof SchemaError;
  JsonSchema: typeof JsonSchema;
  ProviderError: typeof ProviderError;
  mergeOptions: typeof mergeOptions;
  genText: typeof genText;
  genData: typeof genData;
  genStream: typeof genStream;
  genStreamAccumulate: typeof genStreamAccumulate;
  estimateTokens: typeof estimateTokens;
  estimatePromptTokens: typeof estimatePromptTokens;
  estimateTokensMany: typeof estimateTokensMany;
  estimateTokensWithRatio: typeof estimateTokensWithRatio;
  estimateMessageTokens: typeof estimateMessageTokens;
  estimateChatTokens: typeof estimateChatTokens;
  estimateSystemPromptTokens: typeof estimateSystemPromptTokens;
  getMessageOverhead: typeof getMessageOverhead;
  calculateAvailableTokens: typeof calculateAvailableTokens;
  messagesFitBudget: typeof messagesFitBudget;
  calculateCost: typeof calculateCost;
  calculateCostCustom: typeof calculateCostCustom;
  calculateBatchCost: typeof calculateBatchCost;
  calculateImageCost: typeof calculateImageCost;
  calculateVideoCost: typeof calculateVideoCost;
  estimateCost: typeof estimateCost;
  getCostPerToken: typeof getCostPerToken;
  getPricing: typeof getPricing;
  hasPricing: typeof hasPricing;
  getContextWindow: typeof getContextWindow;
  hasContextWindow: typeof hasContextWindow;
  splitText: typeof splitText;
  truncateContent: typeof truncateContent;
  fitMessages: typeof fitMessages;
  paginateMessages: typeof paginateMessages;
  estimateChunkCount: typeof estimateChunkCount;
  detectProviderByModel: typeof detectProviderByModel;
  isProviderActive: typeof isProviderActive;
  activeProviders: typeof activeProviders;
  assertProviderActive: typeof assertProviderActive;
  getApiKey: typeof getApiKey;
  getBaseUrl: typeof getBaseUrl;
  resolveProvider: typeof resolveProvider;
  getModelsForProvider: typeof getModelsForProvider;
  getAllKnownModels: typeof getAllKnownModels;
  isKnownModel: typeof isKnownModel;
  PROVIDERS: typeof PROVIDERS;
  PROVIDER_IDS: typeof PROVIDER_IDS;
  OPENAI_MODELS: typeof OPENAI_MODELS;
  ANTHROPIC_MODELS: typeof ANTHROPIC_MODELS;
  XAI_MODELS: typeof XAI_MODELS;
  MODELS_BY_PROVIDER: typeof MODELS_BY_PROVIDER;
  CONTEXT_WINDOWS: typeof CONTEXT_WINDOWS;
  PRICING: typeof PRICING;
  TOKEN_RATIOS: typeof TOKEN_RATIOS;
  OpenAIClient: typeof OpenAIClient;
  AnthropicClient: typeof AnthropicClient;
  XAIClient: typeof XAIClient;
  LocalClient: typeof LocalClient;
  OpenRouterClient: typeof OpenRouterClient;
  createProviderClient: typeof createProviderClient;
  createOpenAIClient: typeof createOpenAIClient;
  createAnthropicClient: typeof createAnthropicClient;
  createXAIClient: typeof createXAIClient;
  createLocalClient: typeof createLocalClient;
  createOpenRouterClient: typeof createOpenRouterClient;
}

/**
 * All public Chatoyant runtime values grouped under one object.
 *
 * @example
 * ```ts
 * import { Chatoyant } from "chatoyant";
 *
 * const text = await Chatoyant.Generate.text("Say hello");
 * ```
 */
export const Chatoyant: ChatoyantNamespace;
