import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  Chat,
  CONTEXT_WINDOWS,
  JsonSchema,
  Schema,
  XAI,
  calculateImageCost,
  detectProviderByModel,
  estimateChatTokens,
  fitMessages,
  genText,
  resolveProvider,
  splitText,
} from "chatoyant";

const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

describe("publish package surface", () => {
  it("keeps npm metadata aligned with the documented artifact", () => {
    assert.equal(packageJson.name, "chatoyant");
    assert.equal(packageJson.type, "module");
    assert.equal(packageJson.sideEffects, false);
    assert.equal(packageJson.dependencies, undefined);
    assert.equal(packageJson.main, "./dist/index.cjs");
    assert.equal(packageJson.module, "./dist/index.js");
    assert.equal(packageJson.types, "./dist/index.d.ts");
    assert.equal(packageJson.exports["."].types, "./dist/index.d.ts");
    assert.equal(packageJson.exports["."].import, "./dist/index.js");
    assert.equal(packageJson.exports["."].require.types, "./dist/index.d.cts");
    assert.equal(packageJson.exports["."].require.default, "./dist/index.cjs");
    assert.equal(packageJson.files.includes("README.md"), true);
    assert.equal(packageJson.files.includes("OCAML.md"), true);
    assert.equal(packageJson.files.includes("JAVASCRIPT.md"), true);
    assert.equal(packageJson.keywords.includes("zero-dependency"), true);
    assert.equal(packageJson.keywords.includes("llm-sdk"), true);
    assert.equal(packageJson.keywords.includes("chat-completion"), true);

    assert.equal(existsSync(new URL("../../dist/index.js", import.meta.url)), true);
    assert.equal(existsSync(new URL("../../dist/index.cjs", import.meta.url)), true);
    assert.equal(existsSync(new URL("../../dist/index.d.ts", import.meta.url)), true);
    assert.equal(existsSync(new URL("../../dist/index.d.cts", import.meta.url)), true);
  });

  it("documents provider routing that matches runtime detection", () => {
    assert.equal(detectProviderByModel("gpt-4o"), "openai");
    assert.equal(detectProviderByModel("o4-mini"), "openai");
    assert.equal(detectProviderByModel("chatgpt-4o-latest"), "openai");
    assert.equal(detectProviderByModel("claude-sonnet-4-6"), "anthropic");
    assert.equal(detectProviderByModel("grok-4"), "xai");
    assert.equal(detectProviderByModel("openai/gpt-4o"), "openrouter");
    assert.equal(detectProviderByModel("llama3.2:3b"), null);

    const previous = process.env.LOCAL_BASE_URL;
    process.env.LOCAL_BASE_URL = "http://127.0.0.1:11434/v1";
    try {
      assert.equal(resolveProvider("llama3.2:3b"), "local");
    } finally {
      if (previous === undefined) delete process.env.LOCAL_BASE_URL;
      else process.env.LOCAL_BASE_URL = previous;
    }

    assert.equal(new Chat({ model: "best" }).model, "gpt-5.6-sol");
    assert.equal(new Chat({ model: "cheap" }).model, "gpt-5.4-mini");
    assert.equal(new Chat({ model: "best", provider: "anthropic" }).model, "claude-fable-5");
    assert.equal(new Chat({ model: "balanced", provider: "anthropic" }).model, "claude-sonnet-5");
    assert.equal(new Chat({ model: "balanced", provider: "xai" }).model, "grok-4.3");
    assert.equal(new Chat({ model: "best", provider: "xai" }).model, "grok-4.5");
  });

  it("shapes Anthropic requests per model generation", async () => {
    const originalFetch = globalThis.fetch;
    const seen = [];
    globalThis.fetch = async (url, init) => {
      seen.push(JSON.parse(init.body));
      return new Response(
        JSON.stringify({
          id: "msg_gen",
          model: "claude-sonnet-5",
          content: [{ type: "text", text: "ok" }],
          usage: { input_tokens: 2, output_tokens: 1 },
          stop_reason: "end_turn",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    try {
      // Sonnet 5: adaptive thinking with summaries, effort via output_config,
      // sampling parameters dropped (they return 400 upstream).
      await new Chat({ model: "claude-sonnet-5" }).user("Hi").generateWithResult({
        apiKey: "k",
        reasoning: "high",
        creativity: "precise",
        topP: 0.9,
      });
      // Fable 5: thinking cannot be disabled — reasoning "off" omits the field.
      await new Chat({ model: "claude-fable-5" }).user("Hi").generateWithResult({
        apiKey: "k",
        reasoning: "off",
        creativity: "creative",
      });
      // Haiku 4.5 keeps the legacy budget_tokens surface and sampling.
      await new Chat({ model: "claude-haiku-4-5" }).user("Hi").generateWithResult({
        apiKey: "k",
        reasoning: "low",
        creativity: "precise",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.deepEqual(seen[0].thinking, { type: "adaptive", display: "summarized" });
    assert.deepEqual(seen[0].output_config, { effort: "high" });
    assert.equal(seen[0].temperature, undefined);
    assert.equal(seen[0].top_p, undefined);

    assert.equal(seen[1].thinking, undefined);
    assert.equal(seen[1].temperature, undefined);

    assert.deepEqual(seen[2].thinking, { type: "enabled", budget_tokens: 2048 });
    assert.equal(seen[2].output_config, undefined);
    assert.equal(seen[2].temperature, 0);
  });

  it("resolves one-shot provider presets before sending provider requests", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      assert.equal(String(url), "https://api.anthropic.com/v1/messages");
      assert.equal(init.headers["x-api-key"], "anthropic-key");
      const body = JSON.parse(init.body);
      assert.equal(body.model, "claude-haiku-4-5");
      assert.equal(body.temperature, 0);
      assert.equal(body.top_p, 0.9);
      assert.deepEqual(body.stop_sequences, ["END"]);
      assert.deepEqual(body.thinking, { type: "enabled", budget_tokens: 2048 });
      return new Response(
        JSON.stringify({
          id: "msg_doc",
          model: body.model,
          content: [{ type: "text", text: "preset ok" }],
          usage: { input_tokens: 2, output_tokens: 1 },
          stop_reason: "end_turn",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    try {
      assert.equal(
        await genText("Hello", {
          model: "fast",
          provider: "anthropic",
          apiKey: "anthropic-key",
          creativity: "precise",
          reasoning: "low",
          topP: 0.9,
          stop: ["END"],
          maxIterations: 1,
        }),
        "preset ok",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("passes local config and unified OpenAI-compatible options through requests", async () => {
    const originalFetch = globalThis.fetch;
    const seen = [];
    globalThis.fetch = async (url, init) => {
      const body = JSON.parse(init.body);
      seen.push({ url: String(url), headers: init.headers, body });
      return new Response(
        JSON.stringify({
          model: body.model,
          choices: [{ finish_reason: "stop", message: { role: "assistant", content: "ok" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    try {
      await genText("Local", {
        model: "llama3.2:3b",
        localBaseUrl: "http://127.0.0.1:8765/v1",
        localApiKey: "local-key",
        localTimeout: 120_000,
        maxTokens: 32,
      });

      await new Chat({ model: "fast", provider: "xai" }).user("Search").generateWithResult({
        apiKey: "xai-key",
        webSearch: true,
        searchParameters: { mode: "on" },
        creativity: "creative",
        reasoning: "high",
        frequencyPenalty: 0.2,
        presencePenalty: 0.1,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(seen[0].url, "http://127.0.0.1:8765/v1/chat/completions");
    assert.equal(seen[0].headers.Authorization, "Bearer local-key");
    assert.equal(seen[0].body.model, "llama3.2:3b");
    assert.equal(seen[0].body.max_tokens, 32);

    assert.equal(seen[1].url, "https://api.x.ai/v1/chat/completions");
    assert.equal(seen[1].headers.Authorization, "Bearer xai-key");
    assert.equal(seen[1].body.model, "grok-4-1-fast-non-reasoning");
    assert.equal(seen[1].body.temperature, 1);
    assert.equal(seen[1].body.reasoning_effort, "high");
    assert.equal(seen[1].body.frequency_penalty, 0.2);
    assert.equal(seen[1].body.presence_penalty, 0.1);
    assert.deepEqual(seen[1].body.search_parameters, { mode: "on" });
  });

  it("proves media helper request shapes and media cost helpers", async () => {
    const originalFetch = globalThis.fetch;
    const seen = [];
    globalThis.fetch = async (url, init = {}) => {
      const body = init.body ? JSON.parse(init.body) : undefined;
      seen.push({ url: String(url), method: init.method || "GET", body });

      if (String(url).endsWith("/images/generations")) {
        return new Response(JSON.stringify({ data: [{ url: "https://example.com/image.png" }] }), {
          headers: { "content-type": "application/json" },
        });
      }
      if (String(url).endsWith("/images/edits")) {
        return new Response(JSON.stringify({ data: [{ url: "https://example.com/edit.png" }] }), {
          headers: { "content-type": "application/json" },
        });
      }
      if (String(url).endsWith("/video/generations/video_1")) {
        return new Response(JSON.stringify({ id: "video_1", status: "done", video: { url: "https://example.com/video.mp4" } }), {
          headers: { "content-type": "application/json" },
        });
      }
      if (String(url).endsWith("/video/generations")) {
        return new Response(JSON.stringify({ id: "video_1", status: "pending" }), {
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`unexpected media URL: ${url}`);
    };

    try {
      assert.equal(
        await XAI.generateImageUrl("A city", {
          apiKey: "xai-key",
          model: "grok-imagine-image",
          aspectRatio: "16:9",
          resolution: "2k",
        }),
        "https://example.com/image.png",
      );
      assert.equal(
        await XAI.editImageUrl(["subject.png", "scene.png"], "Blend them", {
          apiKey: "xai-key",
          resolution: "1024x1024",
        }),
        "https://example.com/edit.png",
      );
      assert.equal(
        await XAI.generateVideoUrl("A timelapse", {
          apiKey: "xai-key",
          duration: 10,
          aspectRatio: "16:9",
          resolution: "720p",
        }, { pollIntervalMs: 0, maxAttempts: 2 }),
        "https://example.com/video.mp4",
      );
      assert.equal((await XAI.getVideoStatus("video_1", { apiKey: "xai-key" })).status, "done");
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(seen[0].body.aspect_ratio, "16:9");
    assert.equal(seen[0].body.resolution, "2k");
    assert.deepEqual(seen[1].body.image, ["subject.png", "scene.png"]);
    assert.equal(seen[1].body.resolution, "1024x1024");
    assert.equal(seen[2].body.duration, 10);
    assert.equal(seen[2].body.aspect_ratio, "16:9");
    assert.equal(seen[3].url, "https://api.x.ai/v1/video/generations/video_1");
    assert.equal(calculateImageCost({ model: "grok-imagine-image", count: 4 }), 0.08);
  });

  it("keeps README schema and token examples executable", () => {
    class User extends Schema {
      name = Schema.String({ minLength: 1 });
      age = Schema.Integer({ minimum: 0 });
      email = Schema.String({ format: "email", optional: true });
      roles = Schema.Array(Schema.Enum(["admin", "user", "guest"]));
    }

    const user = Schema.parse(User, { name: "Alice", age: 30, roles: ["admin"] });
    assert.equal(JsonSchema.validate(Schema.toJSON(User), user).valid, true);
    assert.equal(estimateChatTokens([{ role: "user", content: "Hello" }]) > 0, true);
    assert.equal(CONTEXT_WINDOWS["gpt-4o"] > 0, true);
    assert.equal(splitText("one two three four five six seven", { maxTokens: 1 }).length > 1, true);
    assert.equal(
      fitMessages(
        [
          { role: "system", content: "Rules" },
          { role: "user", content: "One" },
          { role: "assistant", content: "Two" },
        ],
        { maxTokens: 20, reserveForResponse: 4 },
      )[0].role,
      "system",
    );
  });
});
