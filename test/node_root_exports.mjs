import {
  Anthropic,
  Chat,
  Chatoyant,
  Core,
  Defaults,
  Generate,
  JsonSchema,
  Local,
  Message,
  OpenAI,
  OpenRouter,
  Providers,
  Schema,
  Schemas,
  Shortcuts,
  Tool,
  XAI,
  createOpenAIClient,
  genText,
} from "../_build/default/js/dist/js/chatoyant_js.js";
import * as root from "../_build/default/js/dist/js/chatoyant_js.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const expectedExports = [
  "Anthropic",
  "AnthropicClient",
  "Chat",
  "Chatoyant",
  "Core",
  "DEFAULT_MAX_TOOL_ITERATIONS",
  "DEFAULT_RETRIES",
  "DEFAULT_TIMEOUT",
  "DEFAULT_TOOL_TIMEOUT",
  "Defaults",
  "Generate",
  "JsonSchema",
  "Local",
  "LocalClient",
  "Message",
  "OpenAI",
  "OpenAIClient",
  "OpenRouter",
  "OpenRouterClient",
  "Providers",
  "Schema",
  "Schemas",
  "Shortcuts",
  "Tool",
  "XAI",
  "XAIClient",
  "createAnthropicClient",
  "createLocalClient",
  "createOpenAIClient",
  "createOpenRouterClient",
  "createProviderClient",
  "createTool",
  "createXAIClient",
  "genData",
  "genStream",
  "genStreamAccumulate",
  "genText",
  "mergeOptions",
  "version",
].sort();
assert(
  JSON.stringify(Object.keys(root).sort()) === JSON.stringify(expectedExports),
  `unexpected public root exports: ${Object.keys(root).sort().join(", ")}`,
);
assert(!("json_field" in root), "internal json_field helper leaked from public root");
assert(!("anthropic_request_json" in root), "fixture helper leaked from public root");
assert(!("public_message" in root), "internal alias leaked from public root");

assert(Object.isFrozen(Core), "Core namespace should be frozen");
assert(Object.isFrozen(Schemas), "Schemas namespace should be frozen");
assert(Object.isFrozen(Generate), "Generate namespace should be frozen");
assert(Object.isFrozen(Providers), "Providers namespace should be frozen");
assert(Object.isFrozen(Defaults), "Defaults namespace should be frozen");
assert(Object.isFrozen(Chatoyant), "Chatoyant namespace should be frozen");

assert(Core.Chat === Chat, "Core.Chat should point at Chat");
assert(Core.Message === Message, "Core.Message should point at Message");
assert(Core.Tool === Tool, "Core.Tool should point at Tool");
assert(Schemas.Schema === Schema, "Schemas.Schema should point at Schema");
assert(Schemas.JsonSchema === JsonSchema, "Schemas.JsonSchema should point at JsonSchema");

assert(Generate.text === genText, "Generate.text should point at genText");
assert(Shortcuts.genText === genText, "Shortcuts.genText should point at genText");
assert((await Generate.text("Say ok", { __chatoyantTestFake: true })) === "fake js", "Generate.text failed");
assert(
  (await Shortcuts.streamAccumulate("Say ok", { __chatoyantTestFake: true })) === "fake js",
  "Shortcuts.streamAccumulate failed",
);

const schema = new Schemas.JsonSchema({ type: "object", properties: { q: { type: "string" } }, required: ["q"] });
assert(schema.validate({ q: "needle" }), "Schemas.JsonSchema runtime validation failed");
assert(Chatoyant.Schema.validate({ q: Schema.String() }, { q: "needle" }), "Chatoyant.Schema validation failed");

assert(OpenAI.Client === Providers.OpenAI.Client, "OpenAI namespace should match Providers.OpenAI");
assert(Anthropic.Client === Providers.Anthropic.Client, "Anthropic namespace should match Providers.Anthropic");
assert(XAI.Client === Providers.XAI.Client, "XAI namespace should match Providers.XAI");
assert(Local.Client === Providers.Local.Client, "Local namespace should match Providers.Local");
assert(OpenRouter.Client === Providers.OpenRouter.Client, "OpenRouter namespace should match Providers.OpenRouter");
assert(OpenAI.create({ model: "gpt-4o" }) instanceof OpenAI.Client, "OpenAI.create should return OpenAIClient");
assert(createOpenAIClient({ model: "gpt-4o" }) instanceof Providers.OpenAI.Client, "createOpenAIClient class identity failed");
assert(Providers.create("anthropic", {}) instanceof Providers.Anthropic.Client, "Providers.create anthropic failed");
assert(Chatoyant.Providers.OpenRouter.create({}) instanceof OpenRouter.Client, "Chatoyant OpenRouter factory failed");

const chat = new Chatoyant.Core.Chat({ model: "gpt-4o" }).user("hello from root");
assert((await chat.generate({ __chatoyantTestFake: true })) === "fake js", "Chatoyant.Core.Chat generate failed");
assert(Defaults.DEFAULT_TIMEOUT === Defaults.timeout, "Defaults timeout aliases should match");
assert(Chatoyant.Defaults.DEFAULT_MAX_TOOL_ITERATIONS === Defaults.maxToolIterations, "Chatoyant defaults alias failed");
assert(Chatoyant.mergeOptions({ a: 1 }, { b: 2 }).b === 2, "Chatoyant.mergeOptions missing");

console.log("node root exports ok");
