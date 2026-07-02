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

  it("keeps declared namespace members backed by runtime implementations", () => {
    const { Anthropic, Local, OpenAI, OpenRouter, XAI } = chatoyant;

    // Every member the declaration file promises must be a real function at
    // runtime, per namespace contract: OpenAI/XAI/OpenRouter share the
    // chat-flavored ProviderFunctionNamespace; Anthropic declares its own
    // message-flavored surface; Local declares a minimal chat surface.
    const providerFunctionMembers = [
      "chat",
      "chatSimple",
      "chatStructured",
      "chatWithTools",
      "chatStream",
      "chatStreamContent",
      "chatStreamAccumulate",
      "chatStreamReadable",
      "listModels",
      "listModelIds",
      "getModel",
      "modelExists",
      "requestRaw",
      "request",
      "requestGet",
    ];
    const anthropicMembers = [
      "createMessage",
      "messageSimple",
      "messageStructured",
      "messageWithTools",
      "messageStream",
      "messageStreamContent",
      "messageStreamAccumulate",
      "messageStreamReadable",
      "extractText",
      "extractToolUses",
      "listModels",
      "listAllModels",
      "listModelIds",
      "getModel",
      "modelExists",
      "requestRaw",
      "request",
      "requestGet",
    ];
    for (const [name, namespace, members] of [
      ["OpenAI", OpenAI, providerFunctionMembers],
      ["XAI", XAI, providerFunctionMembers],
      ["OpenRouter", OpenRouter, providerFunctionMembers],
      ["Anthropic", Anthropic, anthropicMembers],
      ["Local", Local, ["chat", "chatSimple"]],
    ]) {
      for (const member of members) {
        assert.equal(typeof namespace[member], "function", `${name}.${member} is not a function`);
      }
    }
    assert.equal(Anthropic.API_VERSION, "2023-06-01");

    // Namespace constants must hold real values, not `undefined` captured
    // before the module-level defaults were initialized.
    assert.equal(OpenAI.BASE_URL, "https://api.openai.com/v1");
    assert.equal(Anthropic.BASE_URL, "https://api.anthropic.com/v1");
    assert.equal(XAI.BASE_URL, "https://api.x.ai/v1");
    assert.equal(OpenRouter.OPENROUTER_BASE_URL, "https://openrouter.ai/api/v1");
    assert.equal(OpenAI.DEFAULT_TIMEOUT, 120000);
    assert.equal(Anthropic.DEFAULT_TIMEOUT, 120000);
    assert.equal(XAI.DEFAULT_TIMEOUT, 120000);
  });
});
