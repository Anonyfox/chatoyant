import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chat, getPricing, getContextWindow, detectProviderByModel, getModelsForProvider, createTool } from "chatoyant";

const presets = {
  openai: ["gpt-6-luna", "gpt-6-luna", "gpt-6.1-sol", "gpt-6-astra", "gpt-6-astra"],
  anthropic: ["claude-haiku-5-5", "claude-haiku-5-5", "claude-sonnet-5-5", "claude-fable-5-1", "claude-fable-5-1"],
  xai: ["grok-4.20-0309-non-reasoning", "grok-4.20-0309-non-reasoning", "grok-4.3", "grok-4.7", "grok-4.7"],
  meta: Array(5).fill("muse-spark-1.3"),
};

describe("2026-10 model refresh", () => {
  it("resolves all twenty presets", () => {
    for (const [provider, models] of Object.entries(presets)) {
      ["fast", "cheap", "balanced", "best", "reasoning"].forEach((model, i) => {
        assert.equal(new Chat({ provider, model }).model, models[i]);
      });
    }
  });

  it("exposes refreshed token, cache, and media prices", () => {
    assert.deepEqual(getPricing("gpt-5.6-sol"), { input: 4, output: 20, cached: 0.4 });
    assert.deepEqual(getPricing("gpt-5.6-terra"), { input: 2, output: 12, cached: 0.2 });
    assert.deepEqual(getPricing("gpt-5.6-luna"), { input: 0.2, output: 1.2, cached: 0.02 });
    assert.deepEqual(getPricing("gpt-6-astra"), { input: 10, output: 50, cached: 1 });
    assert.deepEqual(getPricing("gpt-6.1-terra"), { input: 1, output: 5, cached: 0.05 });
    assert.deepEqual(getPricing("gpt-6.1-sol"), { input: 2, output: 10, cached: 0.1 });
    assert.deepEqual(getPricing("gpt-6-luna"), { input: 0.1, output: 0.5, cached: 0.01 });
    assert.deepEqual(getPricing("claude-sonnet-5"), { input: 2, output: 10, cached: 0.2, cacheWrite5m: 2.5, cacheWrite1h: 4 });
    assert.equal(getPricing("claude-fable-5-1").cached, 0.25);
    assert.deepEqual(getPricing("claude-haiku-5-5"), { input: 0.1, output: 0.5, cached: 0.01, cacheWrite5m: 0.125, cacheWrite1h: 0.2 });
    assert.equal(getPricing("grok-4.5").cached, 0.3);
    assert.equal(getPricing("grok-4.7").output, 6);
    assert.equal(getPricing("muse-wonder-1.0").output, 20);
    assert.equal(getPricing("grok-imagine-video-1.5").perSecond, 0.08);
  });

  it("recognizes new models, contexts, and the precise chat-latest signature", () => {
    for (const [model, provider, context] of [
      ["gpt-6-astra", "openai", 1050000],
      ["gpt-6.1-terra", "openai", 1050000],
      ["claude-opus-5-5", "anthropic", 1000000],
      ["grok-4.7", "xai", 500000],
      ["muse-wonder-1.0", "meta", 1048576],
    ]) {
      assert.equal(getContextWindow(model), context);
      assert.equal(detectProviderByModel(model), provider);
      assert.ok(getModelsForProvider(provider).includes(model));
    }
    assert.equal(detectProviderByModel("chat-latest"), "openai");
    assert.equal(detectProviderByModel("chat"), null);
  });

  it("shapes GPT-6 and Claude 5.5 requests using mock fetch", async () => {
    const originalFetch = globalThis.fetch;
    const seen = [];
    globalThis.fetch = async (url, init) => {
      const body = JSON.parse(init.body);
      seen.push({ url: String(url), body });
      const response = String(url).endsWith("/responses")
        ? { id: "resp_1", model: body.model, output: [{ type: "message", content: [{ type: "output_text", text: "ok" }] }], usage: {} }
        : String(url).endsWith("/messages")
          ? { id: "msg_1", model: body.model, content: [{ type: "text", text: "ok" }], usage: {} }
          : { model: body.model, choices: [{ message: { content: "ok" }, finish_reason: "stop" }], usage: {} };
      return new Response(JSON.stringify(response), { status: 200, headers: { "content-type": "application/json" } });
    };
    try {
      for (const model of ["gpt-6-astra", "gpt-6.1-sol", "gpt-6.1-terra"]) {
        for (const reasoning of [undefined, "off", "minimal", "high"]) {
          const chat = new Chat({ model, apiKey: "test" }).user("hello");
          chat.addTool(createTool({ name: "lookup", description: "Look up data", parameters: {}, execute: async () => "ok" }));
          await chat.generateWithResult({ reasoning });
          const request = seen.at(-1);
          assert.ok(request.url.endsWith("/responses"));
          assert.equal(request.body.tools[0].name, "lookup");
          assert.equal(request.body.reasoning?.effort, reasoning === "high" ? "high" : reasoning === undefined ? undefined : model === "gpt-6.1-terra" && reasoning === "off" ? "none" : "low");
        }
      }
      for (const model of ["gpt-6-luna", "gpt-6-sol", "gpt-6.1-terra"]) {
        await new Chat({ model, apiKey: "test" }).user("hello").generateWithResult({
          temperature: 0.5, topP: 0.7, frequencyPenalty: 0.2, presencePenalty: 0.2, maxTokens: 123, reasoning: "off",
        });
        const { body } = seen.at(-1);
        assert.equal(body.max_completion_tokens, 123);
        assert.equal(body.max_tokens, undefined);
        for (const key of ["temperature", "top_p", "frequency_penalty", "presence_penalty"]) assert.equal(body[key], undefined);
        assert.equal(body.reasoning_effort, "none");
        await new Chat({ model, apiKey: "test" }).user("hello").generateWithResult({ reasoning: "minimal" });
        assert.equal(seen.at(-1).body.reasoning_effort, "low");
      }
      for (const model of ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"]) {
        await new Chat({ model, apiKey: "test" }).user("hello").generateWithResult({ reasoning: "off", temperature: 0.5 });
        assert.ok(seen.at(-1).url.endsWith("/messages"));
        assert.equal(seen.at(-1).body.thinking, undefined);
        assert.equal(seen.at(-1).body.temperature, undefined);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
