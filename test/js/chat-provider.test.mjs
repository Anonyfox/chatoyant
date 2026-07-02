import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AnthropicClient,
  Chat,
  LocalClient,
  Message,
  OpenAI,
  OpenAIClient,
  OpenRouterClient,
  Schema,
  Tool,
  XAIClient,
  createAnthropicClient,
  createLocalClient,
  createOpenAIClient,
  createOpenRouterClient,
  createTool,
  createXAIClient,
  genData,
  genStream,
  genStreamAccumulate,
  genText,
} from "chatoyant";

function sseResponse(...frames) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const frame of frames) controller.enqueue(encoder.encode(frame));
        controller.close();
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
}

describe("Message", () => {
  it("constructs, serializes, deserializes, and copies messages", () => {
    const user = Message.user("Hello", { source: "test" });
    assert.equal(user.role, "user");
    assert.equal(user.isUser(), true);
    assert.deepEqual(user.toJSON(), { role: "user", content: "Hello", metadata: { source: "test" } });

    const tool = Message.tool("{\"ok\":true}", "call_1");
    assert.equal(tool.isTool(), true);
    assert.equal(Message.fromJSON(tool.toJSON()).toolCallId, "call_1");

    const changed = user.withContent("Goodbye").withMetadata({ id: 1 });
    assert.equal(changed.content, "Goodbye");
    assert.deepEqual(changed.metadata, { source: "test", id: 1 });
    assert.throws(() => new Message("invalid", "x"), /Invalid role/);
  });
});

describe("Chat high-level API", () => {
  it("supports fluent state, fake generation, streaming, JSON roundtrip, clone, and fork", async () => {
    const chat = new Chat({ model: "gpt-4o", __chatoyantTestFake: true });
    assert.equal(chat.system("Be helpful").user("Hello"), chat);
    chat.model = "gpt-4o-mini";

    const result = await chat.generateWithResult({ temperature: 0 });
    assert.equal(result.content, "fake js");
    assert.equal(result.usage.totalTokens, 15);
    assert.equal(await chat.generate(), "fake js");
    assert.equal(chat.lastResult.content, "fake js");

    let streamed = "";
    for await (const chunk of chat.stream()) streamed += chunk;
    assert.equal(streamed, "fake js");

    let deltaText = "";
    const accumulated = await chat.streamAccumulate({ onDelta: (chunk) => (deltaText += chunk) });
    assert.equal(accumulated, "fake js");
    assert.equal(deltaText, "fake js");

    const restored = Chat.fromJSON(chat.toJSON());
    assert.equal(restored.model, "gpt-4o-mini");
    assert.equal(restored.clone() instanceof Chat, true);

    const fork = restored.fork();
    fork.user("fork only");
    assert.equal(restored.messages.length + 1, fork.messages.length);
  });

  it("supports one-shot shortcuts against the package root", async () => {
    assert.equal(await genText("Hello", { model: "gpt-4o", __chatoyantTestFake: true }), "fake js");
    assert.equal(await genStreamAccumulate("Hello", { __chatoyantTestFake: true }), "fake js");

    let streamed = "";
    for await (const chunk of genStream("Hello", { __chatoyantTestFake: true })) streamed += chunk;
    assert.equal(streamed, "fake js");

    assert.equal(await genData("Hello", null, { __chatoyantTestFake: true }), "fake js");
  });

  it("generates structured data by parsing provider JSON content", async () => {
    class Answer extends Schema {
      answer = Schema.String();
    }

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.model, "gpt-4o");
      return new Response(
        JSON.stringify({
          model: body.model,
          choices: [{ finish_reason: "stop", message: { role: "assistant", content: "{\"answer\":\"ok\"}" } }],
          usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    try {
      const data = await new Chat({ model: "gpt-4o" }).user("json").generateData(Answer, { apiKey: "test-key" });
      assert.deepEqual(data, { answer: "ok" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("Provider clients", () => {
  it("creates provider-specific client classes from direct factories and namespaces", async () => {
    for (const [factory, Client] of [
      [createOpenAIClient, OpenAIClient],
      [createAnthropicClient, AnthropicClient],
      [createXAIClient, XAIClient],
      [createLocalClient, LocalClient],
      [createOpenRouterClient, OpenRouterClient],
    ]) {
      const client = factory({ model: "gpt-4o", __chatoyantTestFake: true });
      assert.equal(client instanceof Client, true);
      assert.equal(typeof client.chat, "function");
      assert.equal(await client.chatSimple([Message.user("hi")]), "fake js");
    }

    assert.equal(OpenAI.create({ __chatoyantTestFake: true }) instanceof OpenAI.Client, true);
  });
});

describe("Provider HTTP behavior", () => {
  it("runs a JS tool-calling loop and accumulates provider usage", async () => {
    const lookup = createTool({
      name: "lookup",
      description: "Lookup weather",
      parameters: { city: Schema.String() },
      execute: async ({ args, ctx }) => ({ found: args.city, model: ctx.model, provider: ctx.provider }),
    });

    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async (_url, init) => {
      calls += 1;
      const body = JSON.parse(init.body);
      if (calls === 1) {
        assert.equal(body.tools[0].function.name, "lookup");
        return new Response(
          JSON.stringify({
            id: "chatcmpl_tool",
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
                      function: { name: "lookup", arguments: JSON.stringify({ city: "Berlin" }) },
                    },
                  ],
                },
              },
            ],
            usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      const toolMessage = body.messages.find((message) => message.role === "tool");
      assert.equal(toolMessage.tool_call_id, "call_lookup");
      assert.equal(toolMessage.content.includes("Berlin"), true);
      return new Response(
        JSON.stringify({
          id: "chatcmpl_final",
          model: body.model,
          choices: [{ finish_reason: "stop", message: { role: "assistant", content: "Weather OK" } }],
          usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    try {
      const chat = new Chat({ model: "gpt-4o" }).user("weather?").addTool(lookup);
      const result = await chat.generateWithResult({ apiKey: "test-key" });
      assert.equal(result.content, "Weather OK");
      assert.equal(result.iterations, 2);
      assert.equal(result.usage.totalTokens, 10);
      assert.equal(chat.messages.some((message) => message.role === "assistant" && message.toolCalls?.length), true);
      assert.equal(chat.messages.some((message) => message.role === "tool" && message.toolCallId === "call_lookup"), true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("streams OpenAI-compatible SSE text chunks", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.stream, true);
      return sseResponse(
        'data: {"choices":[{"delta":{"content":"a"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"b"}}]}\n\n',
        "data: [DONE]\n\n",
      );
    };

    try {
      const chat = new Chat({ model: "gpt-4o" }).user("stream");
      let streamed = "";
      for await (const chunk of chat.stream({ apiKey: "test-key" })) streamed += chunk;
      assert.equal(streamed, "ab");
      assert.equal(chat.lastResult.content, "ab");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("calls Anthropic Messages with system text and API headers", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "https://api.anthropic.com/v1/messages");
      assert.equal(init.headers["x-api-key"], "test-anthropic");
      assert.equal(init.headers["anthropic-version"], "2023-06-01");
      const body = JSON.parse(init.body);
      assert.equal(body.system, "System");
      assert.equal(body.messages[0].role, "user");
      return new Response(
        JSON.stringify({
          id: "msg_1",
          model: body.model,
          content: [{ type: "text", text: "Claude OK" }],
          usage: { input_tokens: 5, output_tokens: 2 },
          stop_reason: "end_turn",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    try {
      const result = await new Chat({ model: "claude-sonnet-4-6" })
        .system("System")
        .user("Hi")
        .generateWithResult({ apiKey: "test-anthropic" });
      assert.equal(result.content, "Claude OK");
      assert.equal(result.provider, "anthropic");
      assert.equal(result.usage.totalTokens, 7);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
