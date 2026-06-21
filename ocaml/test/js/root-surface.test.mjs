import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as chatoyant from "chatoyant";

describe("public root package surface", () => {
  it("exports only the curated root API", () => {
    const expected = [
      "ANTHROPIC_MODELS",
      "Anthropic",
      "AnthropicClient",
      "CONTEXT_WINDOWS",
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
      "MODELS_BY_PROVIDER",
      "Message",
      "OPENAI_MODELS",
      "OpenAI",
      "OpenAIClient",
      "OpenRouter",
      "OpenRouterClient",
      "PRICING",
      "PROVIDERS",
      "PROVIDER_IDS",
      "ProviderError",
      "Providers",
      "Schema",
      "SchemaError",
      "Schemas",
      "Shortcuts",
      "TOKEN_RATIOS",
      "Tokens",
      "Tool",
      "XAI",
      "XAIClient",
      "XAI_MODELS",
      "activeProviders",
      "assertProviderActive",
      "calculateAvailableTokens",
      "calculateBatchCost",
      "calculateCost",
      "calculateCostCustom",
      "calculateImageCost",
      "calculateVideoCost",
      "createAnthropicClient",
      "createLocalClient",
      "createOpenAIClient",
      "createOpenRouterClient",
      "createProviderClient",
      "createTool",
      "createXAIClient",
      "detectProviderByModel",
      "estimateChatTokens",
      "estimateChunkCount",
      "estimateCost",
      "estimateMessageTokens",
      "estimatePromptTokens",
      "estimateSystemPromptTokens",
      "estimateTokens",
      "estimateTokensMany",
      "estimateTokensWithRatio",
      "fitMessages",
      "genData",
      "genStream",
      "genStreamAccumulate",
      "genText",
      "getAllKnownModels",
      "getApiKey",
      "getBaseUrl",
      "getContextWindow",
      "getCostPerToken",
      "getMessageOverhead",
      "getModelsForProvider",
      "getPricing",
      "hasContextWindow",
      "hasPricing",
      "isKnownModel",
      "isProviderActive",
      "mergeOptions",
      "messagesFitBudget",
      "paginateMessages",
      "resolveProvider",
      "splitText",
      "truncateContent",
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
      SchemaError,
      Schemas,
      Shortcuts,
      Tokens,
      Tool,
      XAI,
      calculateCost,
      createOpenAIClient,
      detectProviderByModel,
      estimateTokens,
      genText,
      getModelsForProvider,
    } = chatoyant;

    for (const namespace of [Core, Schemas, Tokens, Generate, Shortcuts, Providers, Defaults, Chatoyant]) {
      assert.equal(Object.isFrozen(namespace), true);
    }

    assert.equal(Core.Chat, Chat);
    assert.equal(Core.Message, Message);
    assert.equal(Core.Tool, Tool);
    assert.equal(Schemas.Schema, Schema);
    assert.equal(Schemas.SchemaError, SchemaError);
    assert.equal(Schemas.JsonSchema, JsonSchema);
    assert.equal(Tokens.estimateTokens, estimateTokens);
    assert.equal(Tokens.calculateCost, calculateCost);
    assert.equal(Generate.text, genText);
    assert.equal(Shortcuts.genText, genText);
    assert.equal(OpenAI.Client, Providers.OpenAI.Client);
    assert.equal(Anthropic.Client, Providers.Anthropic.Client);
    assert.equal(XAI.Client, Providers.XAI.Client);
    assert.equal(Local.Client, Providers.Local.Client);
    assert.equal(OpenRouter.Client, Providers.OpenRouter.Client);
    assert.equal(createOpenAIClient({}) instanceof Providers.OpenAI.Client, true);
    assert.equal(Chatoyant.OpenRouter.create({}) instanceof OpenRouter.Client, true);
    assert.equal(Providers.detectProviderByModel, detectProviderByModel);
    assert.equal(Chatoyant.getModelsForProvider, getModelsForProvider);
    assert.deepEqual(Chatoyant.mergeOptions({ a: 1 }, { b: 2 }), { a: 1, b: 2 });
  });
});
