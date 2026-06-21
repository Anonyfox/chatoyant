import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as chatoyant from "chatoyant";

describe("public root package surface", () => {
  it("exports only the curated root API", () => {
    const expected = [
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

    assert.deepEqual(Object.keys(chatoyant).sort(), expected);
    assert.equal("json_field" in chatoyant, false);
    assert.equal("anthropic_request_json" in chatoyant, false);
    assert.equal("public_message" in chatoyant, false);
  });

  it("keeps direct exports and namespace exports identical", () => {
    const {
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
    } = chatoyant;

    for (const namespace of [Core, Schemas, Generate, Shortcuts, Providers, Defaults, Chatoyant]) {
      assert.equal(Object.isFrozen(namespace), true);
    }

    assert.equal(Core.Chat, Chat);
    assert.equal(Core.Message, Message);
    assert.equal(Core.Tool, Tool);
    assert.equal(Schemas.Schema, Schema);
    assert.equal(Schemas.JsonSchema, JsonSchema);
    assert.equal(Generate.text, genText);
    assert.equal(Shortcuts.genText, genText);
    assert.equal(OpenAI.Client, Providers.OpenAI.Client);
    assert.equal(Anthropic.Client, Providers.Anthropic.Client);
    assert.equal(XAI.Client, Providers.XAI.Client);
    assert.equal(Local.Client, Providers.Local.Client);
    assert.equal(OpenRouter.Client, Providers.OpenRouter.Client);
    assert.equal(createOpenAIClient({}) instanceof Providers.OpenAI.Client, true);
    assert.equal(Chatoyant.OpenRouter.create({}) instanceof OpenRouter.Client, true);
    assert.deepEqual(Chatoyant.mergeOptions({ a: 1 }, { b: 2 }), { a: 1, b: 2 });
  });
});
