import {
  Chat,
  Chatoyant,
  Core,
  Defaults,
  Generate,
  JsonSchema,
  Message,
  OpenAI,
  ProviderError,
  Providers,
  Schema,
  SchemaError,
  Schemas,
  Shortcuts,
  Tool,
  Tokens,
  XAI,
  calculateCost,
  calculateVideoCost,
  createOpenAIClient,
  createTool,
  detectProviderByModel,
  estimateTokens,
  genData,
  genStream,
  genStreamAccumulate,
  genText,
  getModelsForProvider,
  mergeOptions,
  type GenerateResult,
  type GenerateWithToolsOptions,
  type InferSchemaInput,
  type ProviderId,
} from "chatoyant";

function assertType<T>(_value: T): void {}

class SearchArgs extends Schema {
  q = Schema.String({ minLength: 1, description: "Search query" });
  limit = Schema.Integer({ optional: true, minimum: 1, maximum: 20 });
  tags = Schema.Array(Schema.String(), { optional: true });
}

type SearchArgsType = InferSchemaInput<typeof SearchArgs>;
const searchArgs: SearchArgsType = { q: "needle", limit: null };
assertType<string>(searchArgs.q);
assertType<number | null | undefined>(searchArgs.limit);

class SearchResult extends Schema {
  ok = Schema.Boolean();
  q = Schema.String();
}

const searchTool = createTool({
  name: "search",
  description: "Search documents",
  parameters: SearchArgs,
  resultSchema: SearchResult,
  async execute({ args, ctx }) {
    assertType<string>(args.q);
    assertType<number | null | undefined>(args.limit);
    assertType<string>(ctx.model);
    return { ok: true, q: args.q };
  },
});

assertType<Tool<SearchArgsType, { ok: boolean; q: string }>>(searchTool);
assertType<boolean>(searchTool.validateArgs({ q: "needle" }));

const message = Message.user("hello", { source: "typed" });
assertType<Message>(message.withMetadata({ id: 1 }));
assertType<string>(message.toJSON().content);

const chat = new Chat({ model: "gpt-4o", defaults: { temperature: 0 } });
chat.system("Be terse").user("Find docs").addTool(searchTool);
assertType<Promise<string>>(chat.generate({ __chatoyantTestFake: true }));
assertType<Promise<string>>(chat.streamAccumulate({ __chatoyantTestFake: true }));
assertType<GenerateResult | null>(chat.lastResult);

const generationOptions: GenerateWithToolsOptions = { model: "gpt-4o", temperature: 0 };
assertType<GenerateWithToolsOptions>(generationOptions);

const dataPromise = chat.generateData(SearchArgs, { __chatoyantTestFake: true });
assertType<Promise<SearchArgsType>>(dataPromise);

const fork = Chat.fromJSON(chat.toJSON()).fork();
fork.addMessage(new Message("assistant", "ok"));
assertType<Chat>(fork.clone());

const rawSchema = new JsonSchema({
  type: "object",
  properties: { q: { type: "string" } },
  required: ["q"],
});
assertType<boolean>(rawSchema.validate({ q: "x" }));
assertType<boolean>(
  JsonSchema.validate(
    { $ref: "http://example.com/string.json" },
    "x",
    { resources: [{ uri: "http://example.com/string.json", schema: { type: "string" } }] },
  ).valid,
);

assertType<boolean>(Schema.validate(SearchArgs, { q: "x" }));
assertType<SearchArgsType>(Schema.parse(SearchArgs, { q: "x", tags: ["a"] }));
assertType<typeof SchemaError>(Schemas.SchemaError);

assertType<Promise<string>>(genText("hello", { model: "gpt-4o", __chatoyantTestFake: true }));
assertType<Promise<SearchArgsType>>(genData("json", SearchArgs, { __chatoyantTestFake: true }));
assertType<Promise<string>>(genStreamAccumulate("hello", { __chatoyantTestFake: true }));
assertType<Promise<string>>(Generate.text("hello", { __chatoyantTestFake: true }));
assertType<Promise<string>>(Shortcuts.streamAccumulate("hello", { __chatoyantTestFake: true }));
assertType<{ a: number } & { b: string }>(mergeOptions({ a: 1 }, { b: "two" }));

assertType<number>(estimateTokens("hello"));
assertType<number>(Tokens.estimateTokens("hello"));
assertType<number>(calculateCost({ model: "gpt-4o", inputTokens: 1000, outputTokens: 500 }).total);
assertType<number>(calculateVideoCost({ model: "grok-imagine-video", durationSeconds: 10 }));
assertType<ProviderId | null>(detectProviderByModel("openai/gpt-4o"));
assertType<readonly string[]>(getModelsForProvider("openai"));
assertType<typeof ProviderError>(Providers.ProviderError);

async function consumeStream(): Promise<void> {
  for await (const chunk of genStream("hello", { __chatoyantTestFake: true })) {
    assertType<string>(chunk);
  }
}

await consumeStream();

const client = createOpenAIClient({ model: "gpt-4o" });
assertType<Promise<unknown>>(client.chat([{ role: "user", content: "hi" }]));
assertType<Promise<string[]>>(client.listModelIds());
assertType<Promise<number[]>>(client.embedOne("hello"));

assertType<typeof Chat>(Core.Chat);
assertType<typeof Message>(Core.Message);
assertType<typeof Tool>(Core.Tool);
assertType<typeof createTool>(Core.createTool);
assertType<typeof Schema>(Schemas.Schema);
assertType<typeof JsonSchema>(Schemas.JsonSchema);
assertType<typeof genText>(Chatoyant.Generate.text);
assertType<typeof genData>(Chatoyant.Shortcuts.data);
assertType<number>(Defaults.timeout);
assertType<number>(Chatoyant.Defaults.maxToolIterations);

const rootChat = new Chatoyant.Chat({ model: "gpt-4o" }).user("root");
assertType<Chat>(rootChat);
assertType<Message>(Chatoyant.Message.user("hi"));
assertType<boolean>(Chatoyant.Schema.validate(SearchArgs, { q: "x" }));

const providerClient = Providers.OpenAI.create({ model: "gpt-4o" });
assertType<Promise<unknown>>(providerClient.chat([{ role: "user", content: "hi" }]));
assertType<Promise<string>>(providerClient.chatSimple([{ role: "user", content: "hi" }]));
assertType<Promise<unknown>>(OpenAI.createClient({ model: "gpt-4o" }).chat([{ role: "user", content: "hi" }]));
assertType<Promise<string[]>>(OpenAI.listModelIds({ apiKey: "test" }));
assertType<Promise<Array<{ id: string; [key: string]: unknown }>>>(XAI.getLanguageModelList({ apiKey: "test" }));
assertType<Promise<unknown>>(Providers.create("openai", { model: "gpt-4o" }).chat([{ role: "user", content: "hi" }]));
assertType<typeof Providers.XAI.Client>(Chatoyant.Providers.XAI.Client);
assertType<typeof Providers.OpenRouter.create>(Chatoyant.OpenRouter.create);
assertType<typeof Tokens>(Chatoyant.Tokens);
assertType<typeof detectProviderByModel>(Chatoyant.detectProviderByModel);
assertType<{ x: number } & { y: number }>(Chatoyant.mergeOptions({ x: 1 }, { y: 2 }));
