import assert from "node:assert/strict";
import { it } from "node:test";
import { Chat, Message, Schema, createTool } from "chatoyant";

const fixture = (id = "toolu_1") => [
  { type: "thinking", thinking: "  first\nβ  ", signature: "opaque+/==\nA", extra: { untouched: true } },
  { type: "redacted_thinking", data: "opaque-redacted+/==", extra: [1, 2] },
  { type: "text", text: "Checking" },
  { type: "thinking", thinking: "second", signature: "sig-B" },
  { type: "tool_use", id, name: "lookup", input: { q: "x" } },
];
const lookup = () => createTool({
  name: "lookup", description: "Lookup", parameters: { q: Schema.String() },
  execute: async ({ args }) => args.q,
});
const options = { apiKey: "synthetic-test-key" };
const final = [{ type: "thinking", thinking: "done", signature: "final-signature" }, { type: "text", text: "Done" }];
const jsonResponse = (body) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

it("replays every complete Anthropic array across tool turns, persistence, mutation and model switches", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  const first = fixture();
  const second = fixture("toolu_2");
  second[0].signature = "distinct-signature";
  second.push({ type: "tool_use", id: "toolu_3", name: "lookup", input: { q: "y" } });
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    requests.push(body);
    if (body.model.startsWith("gpt")) {
      assert.equal(JSON.stringify(body).includes("opaque"), false);
      assert.equal(JSON.stringify(body).includes("providerReplay"), false);
      return jsonResponse({ model: body.model, choices: [{ message: { content: "other" }, finish_reason: "stop" }] });
    }
    return jsonResponse({ model: body.model, content: requests.length === 1 ? first : requests.length === 2 ? second : final,
      stop_reason: requests.length <= 2 ? "tool_use" : "end_turn" });
  };
  const assertHistory = (body) => {
    const assistants = body.messages.filter((m) => m.role === "assistant");
    assert.deepEqual(assistants[0].content, first);
    assert.deepEqual(assistants[1].content, second);
  };
  try {
    const chat = new Chat({ model: "claude-sonnet-4-6" }).user("look").addTool(lookup());
    const result = await chat.generateWithResult(options);
    assert.deepEqual(requests[1].messages.find((m) => m.role === "assistant").content, first);
    assert.equal(requests[1].messages.at(-1).content[0].tool_use_id, "toolu_1");
    assertHistory(requests[2]);
    assert.deepEqual(requests[2].messages.filter((m) => m.role === "user").slice(-2).map((m) => m.content[0].tool_use_id), ["toolu_2", "toolu_3"]);
    result.raw.content[0].signature = "mutated raw";
    result.providerReplay.content[0].signature = "mutated result envelope";
    const saved = JSON.parse(JSON.stringify(chat.toJSON()));
    for (const restored of [Chat.fromJSON(saved), chat.clone(), chat.fork()]) {
      restored.addTool(lookup()).user("again");
      restored.model = "claude-opus-4-6";
      await restored.generate(options);
      assertHistory(requests.at(-1));
      assert.equal(requests.at(-1).model, "claude-opus-4-6");
      assert.deepEqual(requests.at(-1).messages.filter((m) => m.role === "assistant")[2].content, final);
      await restored.generate({ ...options, model: "claude-haiku-4-5" });
      assert.equal(requests.at(-1).model, "claude-haiku-4-5");
      assertHistory(requests.at(-1));
      restored.model = "gpt-4o";
      await restored.generate(options);
      restored.model = "claude-sonnet-4-6";
      await restored.generate(options);
      assert.equal(requests.at(-1).model, "claude-sonnet-4-6");
      assertHistory(requests.at(-1));
    }
  } finally { globalThis.fetch = originalFetch; }
});

it("restores pending signed turns and preserves legacy unsigned fallback", async () => {
  const originalFetch = globalThis.fetch;
  const content = fixture();
  let captured;
  globalThis.fetch = async (_url, init) => {
    captured = JSON.parse(init.body);
    return jsonResponse({ content: final, stop_reason: "end_turn" });
  };
  try {
    const pending = Chat.fromJSON(JSON.parse(JSON.stringify({ model: "claude-sonnet-4-6", messages: [
      { role: "user", content: "look" },
      { role: "assistant", content: "Checking", providerReplay: { provider: "anthropic", model: "claude-sonnet-4-6", content } },
      Message.tool("x", "toolu_1").toJSON(),
    ] })));
    await pending.generate(options);
    assert.deepEqual(captured.messages[1].content, content);
    assert.equal(captured.messages[2].content[0].tool_use_id, "toolu_1");
    const legacy = Chat.fromJSON({ model: "claude-sonnet-4-6", messages: [
      { role: "assistant", content: "old", metadata: { reasoningContent: "unsigned thinking" } },
      { role: "assistant", content: "Checking", toolCalls: [{ id: "old-call", name: "lookup", args: { q: "x" } }] },
    ] });
    await legacy.generate(options);
    assert.deepEqual(captured.messages, [
      { role: "assistant", content: "old" },
      { role: "assistant", content: [{ type: "text", text: "Checking" }, { type: "tool_use", id: "old-call", name: "lookup", input: { q: "x" } }] },
    ]);
    assert.deepEqual(Message.assistant("plain").toJSON(), { role: "assistant", content: "plain" });
  } finally { globalThis.fetch = originalFetch; }
});

it("stream with tools uses the same lossless replay path", async () => {
  const originalFetch = globalThis.fetch;
  const content = fixture();
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    if (++calls === 2) assert.deepEqual(body.messages.find((m) => m.role === "assistant").content, content);
    return jsonResponse({ content: calls === 1 ? content : final, stop_reason: calls === 1 ? "tool_use" : "end_turn" });
  };
  try {
    const chat = new Chat({ model: "claude-sonnet-4-6" }).user("look").addTool(lookup());
    let text = "";
    for await (const chunk of chat.stream(options)) text += chunk;
    assert.equal(text, "Done");
    assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; }
});

it("assembles direct streaming thinking/signature fragments, redactions and tool input by index", async () => {
  const originalFetch = globalThis.fetch;
  const expected = fixture();
  const frames = [{ type: "message_start", message: { model: "claude-sonnet-4-6" } }];
  for (const [index, block] of expected.entries()) {
    const start = { ...block };
    const deltas = [];
    for (const [key, type] of [["thinking", "thinking_delta"], ["signature", "signature_delta"], ["text", "text_delta"]]) {
      if (typeof block[key] !== "string") continue;
      start[key] = "";
      const middle = Math.floor(block[key].length / 2);
      for (const value of [block[key].slice(0, middle), block[key].slice(middle)]) deltas.push({ type, [key]: value });
    }
    if (block.input) {
      start.input = {};
      deltas.push({ type: "input_json_delta", partial_json: '{"q":' }, { type: "input_json_delta", partial_json: '"x"}' });
    }
    frames.push({ type: "content_block_start", index, content_block: start });
    for (const delta of deltas) frames.push({ type: "content_block_delta", index, delta });
    frames.push({ type: "content_block_stop", index });
  }
  frames.push({ type: "message_stop" });
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    if (++calls === 1) {
      const bytes = new TextEncoder().encode(frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join(""));
      return new Response(new ReadableStream({ start(controller) {
        for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
        controller.close();
      } }), { headers: { "content-type": "text/event-stream" } });
    }
    const body = JSON.parse(init.body);
    assert.deepEqual(body.messages.find((m) => m.role === "assistant").content, expected);
    return jsonResponse({ content: final, stop_reason: "end_turn" });
  };
  try {
    const chat = new Chat({ model: "claude-sonnet-4-6" }).user("stream");
    let text = "";
    for await (const chunk of chat.stream(options)) text += chunk;
    assert.equal(text, "Checking");
    const restored = Chat.fromJSON(JSON.parse(JSON.stringify(chat.toJSON())));
    restored.user("continue");
    await restored.generate(options);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; }
});
