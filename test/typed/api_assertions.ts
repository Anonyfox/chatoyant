import {
  Chat, Message, Schema, Tool, createTool, genData, calculateCost, estimateCost,
  getPricing, estimateTokens, fitMessages, detectProviderByModel,
  type ProviderId, type Role, type GenerationOptions, type GenerationResult,
  type MessageJSON, type CostResult, type Usage, type ModelPricing,
  type InferSchemaInput, type ToolExecutionResult,
} from 'chatoyant';

type Equal<A,B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

export type ProviderExact = Expect<Equal<ProviderId, 'openai' | 'anthropic' | 'xai' | 'meta' | 'local' | 'openrouter'>>;
export type RoleExact = Expect<Equal<Role, 'system' | 'user' | 'assistant' | 'tool'>>;
export type ConstructorRole = Expect<Equal<ConstructorParameters<typeof Message>[0], Role>>;
export type ConstructorContent = Expect<Equal<ConstructorParameters<typeof Message>[1], string>>;
export type MessageRole = Expect<Equal<Message['role'], Role>>;
export type MessageJson = Expect<Equal<ReturnType<Message['toJSON']>, MessageJSON>>;
export type SystemMessage = Expect<Equal<ReturnType<typeof Message.system>, Message>>;
export type UserMessage = Expect<Equal<ReturnType<typeof Message.user>, Message>>;
export type AssistantMessage = Expect<Equal<ReturnType<typeof Message.assistant>, Message>>;
export type ToolMessage = Expect<Equal<ReturnType<typeof Message.tool>, Message>>;
export type FromJson = Expect<Equal<ReturnType<typeof Message.fromJSON>, Message>>;
export type MessagePredicate = Expect<Equal<ReturnType<Message['isTool']>, boolean>>;
// @ts-expect-error Invalid role.
new Message('developer', 'hello');
// @ts-expect-error Content must be text.
Message.user(42);
// @ts-expect-error ProviderId is closed even though GenerationOptions.provider is extensible.
export const invalidProvider: ProviderId = 'invalid';

export type Temperature = Expect<Equal<GenerationOptions['temperature'], number | undefined>>;
export type MaxTokens = Expect<Equal<GenerationOptions['maxTokens'], number | undefined>>;
export type Stop = Expect<Equal<GenerationOptions['stop'], string | string[] | undefined>>;
export type Creativity = Expect<Equal<GenerationOptions['creativity'], 'precise' | 'balanced' | 'creative' | 'wild' | undefined>>;
// Compatibility: these are intentionally accepted by the current declarations.
export const extensibleOptions: GenerationOptions = { provider: 'custom-provider', customOption: true };
// @ts-expect-error Temperature must be numeric.
export const badTemperature: GenerationOptions = { temperature: 'hot' };
// @ts-expect-error Token limit must be numeric.
export const badMaxTokens: GenerationOptions = { maxTokens: '100' };
// @ts-expect-error Provider must be a string.
export const badProviderOption: GenerationOptions = { provider: 123 };
// @ts-expect-error Creativity is a closed union.
export const badCreativity: GenerationOptions = { creativity: 'chaotic' };
// @ts-expect-error Stop entries must be strings.
export const badStop: GenerationOptions = { stop: [1] };

class RecordSchema extends Schema {
  title = Schema.String();
  count = Schema.Integer();
  enabled = Schema.Boolean({ optional: true });
}
type RecordValue = { title: string; count: number } & { enabled?: boolean | null };
const structured = genData('record', RecordSchema);
const rawStructured = genData('record', { type: 'object', properties: { title: { type: 'string' } } });
export type ClassInference = Expect<Equal<InferSchemaInput<typeof RecordSchema>, RecordValue>>;
export type StructuredResult = Expect<Equal<typeof structured, Promise<RecordValue>>>;
// JSON-schema objects are accepted, but their properties are not inferred.
export type RawStructuredResult = Expect<Equal<typeof rawStructured, Promise<unknown>>>;
const tool = createTool({
  name: 'length', description: 'Measure a label', parameters: { label: Schema.String(), limit: Schema.Integer() },
  execute({ args }) {
    // @ts-expect-error Nonexistent argument property.
    args.missing;
    // @ts-expect-error Inferred label is a string.
    args.label.toFixed();
    return args.label.length + args.limit;
  },
});
type ToolArgs = InferSchemaInput<{ label: ReturnType<typeof Schema.String<{}>>; limit: ReturnType<typeof Schema.Integer<{}>> }>;
export type InferredTool = Expect<Equal<typeof tool, Tool<ToolArgs, number>>>;
export type ParsedArgs = Expect<Equal<ReturnType<typeof tool.parseArgs>, ToolArgs>>;
export type ToolReturn = Expect<Equal<ReturnType<typeof tool.execute>, Promise<number>>>;
export type ToolCallReturn = Expect<Equal<ReturnType<typeof tool.executeCall>, Promise<ToolExecutionResult<number>>>>;
export type ToolInput = Expect<Equal<Parameters<typeof tool.execute>[0]['args'], ToolArgs>>;
// @ts-expect-error Required argument is absent.
tool.execute({ args: { label: 'x' }, ctx: { model: 'x', provider: 'local' } });
// @ts-expect-error Inferred argument type rejects a number label.
tool.parseArgs({}).label = 1;

export type CalculateReturn = Expect<Equal<ReturnType<typeof calculateCost>, CostResult>>;
export type EstimateReturn = Expect<Equal<ReturnType<typeof estimateCost>, CostResult>>;
export type CostInput = Expect<Equal<CostResult['input'], number>>;
export type CostOutput = Expect<Equal<CostResult['output'], number>>;
export type CostCached = Expect<Equal<CostResult['cached'], number>>;
export type CostWrite = Expect<Equal<CostResult['cacheWrite'], number>>;
export type CostTotal = Expect<Equal<CostResult['total'], number>>;
export type CostActual = Expect<Equal<CostResult['actualUsd'], number | undefined>>;
export type UsageInput = Expect<Equal<Usage['inputTokens'], number>>;
export type UsageOutput = Expect<Equal<Usage['outputTokens'], number>>;
export type UsageTotal = Expect<Equal<Usage['totalTokens'], number>>;
export type UsageCached = Expect<Equal<Usage['cachedTokens'], number | undefined>>;
export type UsageWrite = Expect<Equal<Usage['cacheWriteTokens'], number | undefined>>;
export type UsageReasoning = Expect<Equal<Usage['reasoningTokens'], number | undefined>>;
export type UsageCost = Expect<Equal<Usage['costUsd'], number | undefined>>;
export type PricingReturn = Expect<Equal<ReturnType<typeof getPricing>, ModelPricing | undefined>>;
export type TokenReturn = Expect<Equal<ReturnType<typeof estimateTokens>, number>>;
export type ProviderDetection = Expect<Equal<ReturnType<typeof detectProviderByModel>, ProviderId | null>>;
// @ts-expect-error Token count cannot be text.
calculateCost({ model: 'gpt-4o', inputTokens: '100', outputTokens: 10 });
// @ts-expect-error Output estimate is required.
estimateCost({ model: 'gpt-4o', inputText: 'x' });

const fitted = fitMessages([{ role: 'user', content: 'x', traceId: 1 }], { maxTokens: 100 });
export type FitPreservesElement = Expect<Equal<typeof fitted, { role: string; content: string; traceId: number }[]>>;
export type ChatGenerate = Expect<Equal<ReturnType<Chat['generate']>, Promise<string>>>;
export type ChatResult = Expect<Equal<ReturnType<Chat['generateWithResult']>, Promise<GenerationResult>>>;
export type ChatStream = Expect<Equal<ReturnType<Chat['stream']>, AsyncIterable<string>>>;
export type ChatAccumulate = Expect<Equal<ReturnType<Chat['streamAccumulate']>, Promise<string>>>;
export type ChatLast = Expect<Equal<Chat['lastResult'], GenerationResult | null>>;
export type ChatMessages = Expect<Equal<Chat['messages'], Message[]>>;
export type ChatClone = Expect<Equal<ReturnType<Chat['clone']>, Chat>>;
export type ChatFork = Expect<Equal<ReturnType<Chat['fork']>, Chat>>;
export type ChatJson = Expect<Equal<ReturnType<Chat['toJSON']>, unknown>>;
export type ChatStringify = Expect<Equal<ReturnType<Chat['stringify']>, string>>;
class SpecializedChat extends Chat { readonly marker = true; }
const fluent = new SpecializedChat().system('x').user('y').assistant('z').clearMessages().clearTools();
const chatData = fluent.generateData(RecordSchema);
export type FluentSubclass = Expect<Equal<typeof fluent, SpecializedChat>>;
export type ChatStructured = Expect<Equal<typeof chatData, Promise<RecordValue>>>;
// @ts-expect-error Message role must be valid when adding JSON messages.
fluent.addMessage({ role: 'invalid', content: 'x' });
