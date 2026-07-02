import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import {
  Chat,
  Chatoyant,
  Message,
  OpenAI,
  ProviderError,
  Providers,
  Schema,
  Tokens,
  Tool,
  XAI,
  calculateCost,
  calculateVideoCost,
  createTool,
  detectProviderByModel,
  estimateTokens,
  getModelsForProvider,
  genText,
} from "chatoyant";

describe("known adjacent production usage patterns", () => {
  it("supports simple genText(prompt, { system, model }) calls", async () => {
    const text = await genText("Say ok", {
      system: "Return short answers.",
      model: "gpt-4o",
      __chatoyantTestFake: true,
    });
    assert.equal(text, "fake js");
  });

  it("supports fluent multi-message Chat state, JSON roundtrip, clone, and fork", async () => {
    const chat = new Chat({ model: "claude-sonnet-4-5-20250929", __chatoyantTestFake: true });
    chat.system("System prompt").user("Hint 1").user("Final task");

    assert.equal(chat.messages.length, 3);
    const result = await chat.generateWithResult();
    assert.equal(result.content, "fake js");
    assert.equal(chat.lastResult.usage.totalTokens, 15);

    const restored = Chat.fromJSON(chat.toJSON());
    assert.equal(restored.model, chat.model);
    assert.equal(restored.clone() instanceof Chat, true);

    const fork = restored.fork();
    fork.user("Fork-only focus");
    assert.equal(restored.messages.length + 1, fork.messages.length);
  });

  it("persists assistant tool calls and tool result messages", async () => {
    const assistantToolMessage = new Message("assistant", "", {
      toolCalls: [{ id: "call_1", name: "lookup", arguments: { q: "test" } }],
    });
    assert.equal(assistantToolMessage.toJSON().toolCalls[0].arguments.q, "test");

    const lookup = createTool({
      name: "lookup",
      description: "Lookup data",
      parameters: { q: Schema.String() },
      execute: async ({ args, ctx }) => ({ found: args.q, model: ctx.model, provider: ctx.provider }),
    });
    assert.equal(lookup instanceof Tool, true);

    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async (_url, init) => {
      calls += 1;
      const body = JSON.parse(init.body);
      if (calls === 1) {
        return new Response(
          JSON.stringify({
            model: body.model,
            choices: [
              {
                finish_reason: "tool_calls",
                message: {
                  role: "assistant",
                  content: "",
                  tool_calls: [
                    {
                      id: "call_lookup",
                      type: "function",
                      function: {
                        name: "lookup",
                        arguments: JSON.stringify({ q: "needle" }),
                      },
                    },
                  ],
                },
              },
            ],
            usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      const toolMessage = body.messages.find((message) => message.role === "tool");
      assert.equal(toolMessage.tool_call_id, "call_lookup");
      assert.equal(toolMessage.content.includes("needle"), true);
      return new Response(
        JSON.stringify({
          model: body.model,
          choices: [{ finish_reason: "stop", message: { role: "assistant", content: "done" } }],
          usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    try {
      const toolChat = new Chat({ model: "gpt-4o" });
      toolChat.system("Use tools").user("Find needle").addTool(lookup);
      const toolResult = await toolChat.generateWithResult({ apiKey: "test-key", maxIterations: 4 });
      assert.equal(toolResult.content, "done");
      assert.equal(toolResult.iterations, 2);
      assert.equal(toolResult.usage.totalTokens, 9);
      assert.equal(toolChat.messages.some((message) => message.role === "assistant" && message.toolCalls?.length), true);
      assert.equal(toolChat.messages.some((message) => message.role === "tool" && message.toolCallId === "call_lookup"), true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("replaces former provider subpath imports with root namespace imports", async () => {
    const direct = OpenAI.create({ model: "gpt-4o", __chatoyantTestFake: true });
    const viaProviders = Providers.OpenRouter.create({ model: "openai/gpt-4o", __chatoyantTestFake: true });
    const viaAggregate = Chatoyant.Providers.XAI.create({ model: "grok-4", __chatoyantTestFake: true });

    assert.equal(await direct.chatSimple([Message.user("hi")]), "fake js");
    assert.equal(await viaProviders.chatSimple([Message.user("hi")]), "fake js");
    assert.equal(await viaAggregate.chatSimple([Message.user("hi")]), "fake js");
  });

  it("moves former token and provider detection subpaths to the root cleanly", () => {
    assert.equal(estimateTokens("hello world") > 0, true);
    assert.equal(Tokens.estimateTokens, estimateTokens);
    assert.equal(calculateCost({ model: "gpt-4o", inputTokens: 1000, outputTokens: 500 }).total > 0, true);
    assert.equal(calculateVideoCost({ model: "grok-imagine-video", durationSeconds: 15 }), 0.75);
    assert.equal(Tokens.calculateVideoCost({ model: "grok-imagine-video", durationSeconds: 2 }), 0.1);

    assert.equal(detectProviderByModel("gpt-4o"), "openai");
    assert.equal(detectProviderByModel("anthropic/claude-sonnet-4-6"), "openrouter");
    assert.equal(getModelsForProvider("openai").includes("gpt-4o"), true);
    assert.equal(Providers.getModelsForProvider("xai").includes("grok-4"), true);
    assert.equal(ProviderError.missingApiKey("openai") instanceof ProviderError, true);
  });

  it("supports provider namespace replacements for old provider subpath helpers", async () => {
    const originalFetch = globalThis.fetch;
    const seen = [];
    globalThis.fetch = async (url, init = {}) => {
      seen.push({ url: String(url), init });
      if (String(url).endsWith("/models")) {
        return new Response(JSON.stringify({ data: [{ id: "test-model-a" }, { id: "test-model-b" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    try {
      assert.deepEqual(await OpenAI.listModelIds({ apiKey: "openai-key" }), ["test-model-a", "test-model-b"]);
      assert.deepEqual((await XAI.getLanguageModelList({ apiKey: "xai-key" })).map((m) => m.id), [
        "test-model-a",
        "test-model-b",
      ]);
      const response = await OpenAI.requestRaw("/models", { apiKey: "openai-key" });
      assert.equal(response instanceof Response, true);
      assert.equal(seen.some((call) => call.init.headers.Authorization === "Bearer openai-key"), true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("keeps the root package require-able for CJS consumers", () => {
    const require = createRequire(import.meta.url);
    const pkg = require("../../dist/index.cjs");
    assert.equal(typeof pkg.Chat, "function");
    assert.equal(typeof pkg.estimateTokens, "function");
    assert.equal(typeof pkg.OpenAI.listModelIds, "function");
  });
});
