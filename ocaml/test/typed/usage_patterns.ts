import {
  Chat,
  Chatoyant,
  Core,
  Defaults,
  Generate,
  JsonSchema,
  Message,
  OpenAI,
  Providers,
  Schema,
  Schemas,
  Shortcuts,
  Tool,
  createOpenAIClient,
  createTool,
  genData,
  genStream,
  genStreamAccumulate,
  genText,
  mergeOptions,
  type InferSchemaInput,
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

assertType<Promise<string>>(genText("hello", { model: "gpt-4o", __chatoyantTestFake: true }));
assertType<Promise<SearchArgsType>>(genData("json", SearchArgs, { __chatoyantTestFake: true }));
assertType<Promise<string>>(genStreamAccumulate("hello", { __chatoyantTestFake: true }));
assertType<Promise<string>>(Generate.text("hello", { __chatoyantTestFake: true }));
assertType<Promise<string>>(Shortcuts.streamAccumulate("hello", { __chatoyantTestFake: true }));
assertType<{ a: number } & { b: string }>(mergeOptions({ a: 1 }, { b: "two" }));

async function consumeStream(): Promise<void> {
  for await (const chunk of genStream("hello", { __chatoyantTestFake: true })) {
    assertType<string>(chunk);
  }
}

await consumeStream();

const client = createOpenAIClient({ model: "gpt-4o" });
assertType<Promise<unknown>>(client.chat([{ role: "user", content: "hi" }]));

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
assertType<Promise<unknown>>(Providers.create("openai", { model: "gpt-4o" }).chat([{ role: "user", content: "hi" }]));
assertType<typeof Providers.XAI.Client>(Chatoyant.Providers.XAI.Client);
assertType<typeof Providers.OpenRouter.create>(Chatoyant.OpenRouter.create);
assertType<{ x: number } & { y: number }>(Chatoyant.mergeOptions({ x: 1 }, { y: 2 }));
