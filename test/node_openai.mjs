import {
  Chat,
  AnthropicClient,
  LocalClient,
  Message,
  OpenAIClient,
  OpenRouterClient,
  Tool,
  XAIClient,
  createTool,
  createAnthropicClient,
  createLocalClient,
  createOpenAIClient,
  createOpenRouterClient,
  createXAIClient,
  genData,
  genStream,
  genStreamAccumulate,
  genText,
} from "../_build/default/js/dist/js/chatoyant_js.js";

import {
  chat_session_json,
  chat_session_roundtrip,
  chat_shortcut_text,
  chat_stream_accumulate_json,
  openai_chat_request_json,
  openai_decode_text,
  openai_responses_decode_text,
  openai_responses_request_json,
  openai_stream_text4,
} from "../_build/default/js/dist/js/chatoyant_internal.js";

const message = Message.user("Hello");
if (!(message instanceof Message) || message.toJSON().role !== "user") {
  throw new Error("Message export should be a usable class");
}
const tool = createTool({
  name: "lookup",
  description: "Lookup data",
  parameters: { type: "object", properties: { city: { type: "string" } } },
  execute: async ({ args }) => ({ ok: true, city: args.city }),
});
if (!(tool instanceof Tool) || tool.name !== "lookup") {
  throw new Error("Tool/createTool exports should be usable");
}

const publicChat = new Chat({ model: "gpt-4o", __chatoyantTestFake: true });
if (!(publicChat instanceof Chat)) {
  throw new Error("Chat should be an ES class constructor");
}
if (publicChat.model !== "gpt-4o") {
  throw new Error("bad Chat model getter");
}
publicChat.model = "gpt-4o-mini";
if (publicChat.model !== "gpt-4o-mini") {
  throw new Error("bad Chat model setter");
}
if (publicChat.system("You are helpful").user("Hello") !== publicChat) {
  throw new Error("Chat fluent methods should return this");
}
const publicResult = await publicChat.generateWithResult({ temperature: 0 });
if (publicResult.content !== "fake js") {
  throw new Error("bad Chat.generateWithResult content");
}
if ((await publicChat.generate()) !== "fake js") {
  throw new Error("bad Chat.generate content");
}
if (publicChat.lastResult?.content !== "fake js") {
  throw new Error("bad Chat.lastResult");
}
if (publicChat.messages.length !== 4) {
  throw new Error(`bad Chat message history length: ${publicChat.messages.length}`);
}
let streamedPublic = "";
for await (const chunk of publicChat.stream()) {
  streamedPublic += chunk;
}
if (streamedPublic !== "fake js") {
  throw new Error("bad Chat.stream");
}
let deltaText = "";
const accumulatedPublic = await publicChat.streamAccumulate({
  onDelta(chunk) {
    deltaText += chunk;
  },
});
if (accumulatedPublic !== "fake js" || deltaText !== "fake js") {
  throw new Error("bad Chat.streamAccumulate");
}
const publicJson = publicChat.toJSON();
const restoredPublic = Chat.fromJSON(publicJson);
if (!(restoredPublic instanceof Chat) || restoredPublic.model !== publicChat.model) {
  throw new Error("bad Chat.fromJSON");
}
if ((await genText("Hello", { model: "gpt-4o", __chatoyantTestFake: true })) !== "fake js") {
  throw new Error("bad exported genText");
}
let shortcutStream = "";
for await (const chunk of genStream("Hello", { __chatoyantTestFake: true })) {
  shortcutStream += chunk;
}
if (shortcutStream !== "fake js") {
  throw new Error("bad exported genStream");
}
if ((await genStreamAccumulate("Hello", { __chatoyantTestFake: true })) !== "fake js") {
  throw new Error("bad exported genStreamAccumulate");
}
if ((await genData("Hello", null, { __chatoyantTestFake: true })) !== "fake js") {
  throw new Error("bad exported genData fallback");
}
for (const [factory, Client] of [
  [createOpenAIClient, OpenAIClient],
  [createAnthropicClient, AnthropicClient],
  [createXAIClient, XAIClient],
  [createLocalClient, LocalClient],
  [createOpenRouterClient, OpenRouterClient],
]) {
  const client = factory({ model: "gpt-4o" });
  if (!(client instanceof Client) || typeof client.chat !== "function") {
    throw new Error("provider factory should expose provider client class instances");
  }
}

const originalFetch = globalThis.fetch;
let toolLoopCalls = 0;
globalThis.fetch = async (_url, init) => {
  toolLoopCalls += 1;
  const body = JSON.parse(init.body);
  if (toolLoopCalls === 1) {
    if (!Array.isArray(body.tools) || body.tools[0].function.name !== "lookup") {
      throw new Error("missing serialized JS tool definition");
    }
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
  const toolMessage = body.messages.find((candidate) => candidate.role === "tool");
  if (!toolMessage || !toolMessage.content.includes("Berlin")) {
    throw new Error("tool result was not appended to second provider call");
  }
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
  const toolChat = new Chat({ model: "gpt-4o" });
  toolChat.user("weather?");
  toolChat.addTool(tool);
  const result = await toolChat.generateWithResult({ apiKey: "test-key" });
  if (result.content !== "Weather OK" || result.iterations !== 2 || result.usage.totalTokens !== 10) {
    throw new Error("bad JS callback tool orchestration");
  }
} finally {
  globalThis.fetch = originalFetch;
}

globalThis.fetch = async (_url, init) => {
  const body = JSON.parse(init.body);
  if (body.stream !== true) {
    throw new Error("stream() should request provider streaming");
  }
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n'),
        );
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":"lo"}}]}\n\n'),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
};
try {
  const streamChat = new Chat({ model: "gpt-4o" });
  streamChat.user("stream");
  let streamed = "";
  for await (const chunk of streamChat.stream({ apiKey: "test-key" })) {
    streamed += chunk;
  }
  if (streamed !== "Hello" || streamChat.lastResult?.content !== "Hello") {
    throw new Error("bad public Chat streaming bridge");
  }
} finally {
  globalThis.fetch = originalFetch;
}

const chat = JSON.parse(openai_chat_request_json());
if (chat.model !== "gpt-4o-mini") {
  throw new Error("unexpected OpenAI chat model");
}
if (chat.response_format?.type !== "json_schema") {
  throw new Error("missing OpenAI chat json_schema response format");
}

const responses = JSON.parse(openai_responses_request_json());
if (responses.model !== "gpt-4o-mini") {
  throw new Error("unexpected OpenAI Responses model");
}
if (responses.text?.format?.type !== "json_schema") {
  throw new Error("missing OpenAI Responses text format");
}
if (responses.store !== false) {
  throw new Error("OpenAI Responses request should not store history");
}

const chatDecoded = openai_decode_text(
  JSON.stringify({
    id: "chat_123",
    model: "gpt-4o-mini",
    choices: [{ message: { role: "assistant", content: "Hello from JS Chat" } }],
    usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
  }),
);
if (chatDecoded !== "Hello from JS Chat") {
  throw new Error(`bad OpenAI chat decode: ${chatDecoded}`);
}

const responsesDecoded = openai_responses_decode_text(
  JSON.stringify({
    id: "resp_123",
    model: "gpt-4o-mini",
    status: "completed",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: "Hello from JS Responses" }],
      },
    ],
    usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
  }),
);
if (responsesDecoded !== "Hello from JS Responses") {
  throw new Error(`bad OpenAI Responses decode: ${responsesDecoded}`);
}

const streamed = openai_stream_text4(
  'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
  'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
  'data: {"choices":[{"finish_reason":"stop","delta":{}}]}\n\n',
  "data: [DONE]\n\n",
);
if (streamed !== "Hello") {
  throw new Error(`bad OpenAI stream decode: ${streamed}`);
}

const session = JSON.parse(chat_session_json());
if (session.model !== "gpt-4o" || session.messages.length !== 3) {
  throw new Error("bad OCaml-backed Chat session JSON");
}
if (session.lastResult?.content !== "fake js") {
  throw new Error("missing OCaml-backed Chat lastResult");
}
const roundtrip = JSON.parse(chat_session_roundtrip(JSON.stringify(session)));
if (roundtrip.model !== "gpt-4o" || roundtrip.messages.length !== 3) {
  throw new Error("bad OCaml-backed Chat roundtrip");
}
if (chat_shortcut_text("Hello") !== "fake js") {
  throw new Error("bad OCaml-backed genText shortcut");
}
const streamResult = JSON.parse(chat_stream_accumulate_json());
if (streamResult.content !== "streamed" || streamResult.usage.total_tokens !== 5) {
  throw new Error("bad OCaml-backed stream accumulation");
}

console.log("node openai ok");
