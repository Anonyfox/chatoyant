import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  Chat,
  Chatoyant,
  Message,
  OpenAI,
  Providers,
  Schema,
  Tool,
  createTool,
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
});
