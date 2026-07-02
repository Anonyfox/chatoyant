import {
  Chat,
  Message,
  Tool,
  createTool,
  genText,
} from "../_build/default/js/dist/js/chatoyant_js.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// One-shot genText(prompt, { system, model }) shape.
const oneShot = await genText("Say ok", {
  system: "Return short answers.",
  model: "gpt-4o",
  __chatoyantTestFake: true,
});
assert(oneShot === "fake js", "genText one-shot shape failed");

// Fluent multi-message Chat state, JSON roundtrip, and fork isolation.
const chat = new Chat({ model: "claude-sonnet-4-5-20250929", __chatoyantTestFake: true });
chat.system("System prompt").user("Hint 1").user("Final task");
assert(chat.messages.length === 3, "fluent message ordering failed");
const result = await chat.generateWithResult();
assert(result.content === "fake js", "Chat.generateWithResult shape failed");
assert(chat.lastResult?.usage?.totalTokens === 15, "lastResult usage shape failed");
const restored = Chat.fromJSON(chat.toJSON());
assert(restored.model === chat.model, "Chat.fromJSON model failed");
const fork = restored.fork();
fork.user("Fork-only focus");
assert(restored.messages.length + 1 === fork.messages.length, "Chat.fork isolation failed");

// Message class shape and tool-call persistence fields.
const assistantToolMessage = new Message("assistant", "", {
  toolCalls: [{ id: "call_1", name: "lookup", arguments: { q: "test" } }],
});
assert(
  assistantToolMessage.toJSON().toolCalls[0].arguments.q === "test",
  "Message toolCalls.arguments shape failed",
);

// createTool with raw object params and JS callback execution.
const lookup = createTool({
  name: "lookup",
  description: "Lookup data",
  parameters: {},
  execute: async ({ args, ctx }) => ({ found: args.q, model: ctx.model, provider: ctx.provider }),
});
assert(lookup instanceof Tool, "createTool should return Tool instance");

const originalFetch = globalThis.fetch;
let calls = 0;
globalThis.fetch = async (_url, init) => {
  calls += 1;
  const body = JSON.parse(init.body);
  if (calls === 1) {
    assert(body.tools?.[0]?.function?.name === "lookup", "tool definition not serialized");
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
  assert(toolMessage?.tool_call_id === "call_lookup", "tool result message missing call id");
  assert(toolMessage.content.includes("needle"), "tool result message missing callback result");
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
  assert(toolResult.content === "done", "tool loop final content failed");
  assert(toolResult.iterations === 2, "tool loop iteration count failed");
  assert(toolResult.usage.totalTokens === 9, "tool loop usage accumulation failed");
  assert(
    toolChat.messages.some((message) => message.role === "assistant" && message.toolCalls?.length),
    "assistant tool-call message was not persisted",
  );
  assert(
    toolChat.messages.some((message) => message.role === "tool" && message.toolCallId === "call_lookup"),
    "tool result message was not persisted",
  );
} finally {
  globalThis.fetch = originalFetch;
}

// stream() async iterator shape with provider SSE chunks.
globalThis.fetch = async (_url, init) => {
  const body = JSON.parse(init.body);
  assert(body.stream === true, "stream() must request streaming");
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"a"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"b"}}]}\n\n'));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
};

try {
  const streamChat = new Chat({ model: "gpt-4o" }).user("stream");
  let streamed = "";
  for await (const chunk of streamChat.stream({ apiKey: "test-key" })) streamed += chunk;
  assert(streamed === "ab", "stream async iterator shape failed");
  assert(streamChat.lastResult?.content === "ab", "stream lastResult failed");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("node adjacent usage patterns ok");
