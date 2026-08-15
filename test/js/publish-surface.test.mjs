import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  Anthropic,
  Chat,
  CONTEXT_WINDOWS,
  JsonSchema,
  Message,
  META_MODELS,
  OpenAI,
  ProviderError,
  Schema,
  XAI,
  calculateImageCost,
  createTool,
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

  it("keeps gpt-5.6 function tools working around the reasoning lock", async () => {
    const originalFetch = globalThis.fetch;
    const seen = [];
    const tool = createTool({
      name: "add",
      description: "Add two numbers",
      parameters: { a: Schema.Number(), b: Schema.Number() },
      async execute({ args }) {
        return { sum: args.a + args.b };
      },
    });

    globalThis.fetch = async (url, init) => {
      const body = JSON.parse(init.body);
      seen.push({ url: String(url), body });
      if (String(url).endsWith("/responses")) {
        // First responses turn asks for the tool; second returns the answer.
        const isToolTurn = !body.input.some((item) => item.type === "function_call_output");
        return new Response(
          JSON.stringify(
            isToolTurn
              ? {
                  status: "completed",
                  model: body.model,
                  output: [
                    { type: "function_call", call_id: "call_r1", name: "add", arguments: '{"a":2,"b":3}' },
                  ],
                  usage: { input_tokens: 4, output_tokens: 2, total_tokens: 6 },
                }
              : {
                  status: "completed",
                  model: body.model,
                  output: [
                    { type: "message", content: [{ type: "output_text", text: "The sum is 5." }] },
                  ],
                  usage: { input_tokens: 6, output_tokens: 3, total_tokens: 9 },
                },
          ),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          model: body.model,
          choices: [{ finish_reason: "stop", message: { role: "assistant", content: "done" } }],
          usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    try {
      // Default path: chat/completions must neutralize the server-side
      // reasoning default with an explicit "none" when tools are present.
      await new Chat({ model: "gpt-5.6-terra" })
        .user("add 2 and 3")
        .addTool(tool)
        .generateWithResult({ apiKey: "k" });

      // Explicit reasoning + tools must route through /v1/responses and the
      // tool loop must complete across responses-format turns.
      const reasoned = await new Chat({ model: "gpt-5.6-terra" })
        .user("add 2 and 3")
        .addTool(tool)
        .generateWithResult({ apiKey: "k", reasoning: "high", maxTokens: 300 });
      assert.equal(reasoned.content, "The sum is 5.");
      assert.equal(reasoned.iterations, 2);

      // Pre-5.6 models keep their existing wire shape, with the modern
      // max-tokens parameter name.
      await new Chat({ model: "gpt-5.4-mini" })
        .user("hi")
        .addTool(tool)
        .generateWithResult({ apiKey: "k", maxTokens: 100 });
      await new Chat({ model: "gpt-4o" }).user("hi").generateWithResult({ apiKey: "k", maxTokens: 50 });
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(seen[0].url.endsWith("/chat/completions"), true);
    assert.equal(seen[0].body.reasoning_effort, "none");

    assert.equal(seen[1].url.endsWith("/responses"), true);
    assert.deepEqual(seen[1].body.reasoning, { effort: "high" });
    assert.equal(seen[1].body.max_output_tokens, 300);
    assert.equal(seen[1].body.tools[0].name, "add");
    assert.equal(seen[1].body.tools[0].type, "function");
    assert.equal(seen[2].url.endsWith("/responses"), true);
    assert.equal(
      seen[2].body.input.some((item) => item.type === "function_call_output" && item.call_id === "call_r1"),
      true,
    );

    const mini = seen[3];
    assert.equal(mini.url.endsWith("/chat/completions"), true);
    assert.equal(mini.body.reasoning_effort, undefined);
    assert.equal(mini.body.max_completion_tokens, 100);
    assert.equal(mini.body.max_tokens, undefined);

    const legacy = seen[4];
    assert.equal(legacy.body.max_tokens, 50);
    assert.equal(legacy.body.max_completion_tokens, undefined);
  });

  it("drops locked sampling parameters for the gpt-5.0/5.5/5.6/o generations", async () => {
    const originalFetch = globalThis.fetch;
    const seen = [];
    globalThis.fetch = async (url, init) => {
      seen.push(JSON.parse(init.body));
      return new Response(
        JSON.stringify({
          model: "m",
          choices: [{ finish_reason: "stop", message: { role: "assistant", content: "ok" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    try {
      const sampling = { apiKey: "k", creativity: "precise", topP: 0.9, frequencyPenalty: 0.2, presencePenalty: 0.1 };
      await new Chat({ model: "gpt-5.6-terra" }).user("hi").generateWithResult(sampling);
      await new Chat({ model: "gpt-5.5" }).user("hi").generateWithResult(sampling);
      await new Chat({ model: "o4-mini" }).user("hi").generateWithResult(sampling);
      await new Chat({ model: "gpt-5.4-mini" }).user("hi").generateWithResult(sampling);
    } finally {
      globalThis.fetch = originalFetch;
    }
    for (const body of seen.slice(0, 3)) {
      assert.equal(body.temperature, undefined);
      assert.equal(body.top_p, undefined);
      assert.equal(body.frequency_penalty, undefined);
      assert.equal(body.presence_penalty, undefined);
    }
    const open = seen[3];
    assert.equal(open.temperature, 0);
    assert.equal(open.top_p, 0.9);
    assert.equal(open.frequency_penalty, 0.2);
    assert.equal(open.presence_penalty, 0.1);
  });

  it("renders message attachments into each provider's wire blocks", async () => {
    const originalFetch = globalThis.fetch;
    const seen = [];
    globalThis.fetch = async (url, init) => {
      seen.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
      return new Response(
        JSON.stringify({
          model: "m",
          choices: [{ finish_reason: "stop", message: { role: "assistant", content: "ok" } }],
          content: [{ type: "text", text: "ok" }],
          output: [{ type: "message", content: [{ type: "output_text", text: "ok" }] }],
          usage: { prompt_tokens: 1, completion_tokens: 1, input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    try {
      // Chat Completions: text part + image_url (https and data URI) + file part.
      await new Chat({ model: "gpt-5.4-mini", apiKey: "k" })
        .user("describe", {
          images: ["https://x.test/cat.png", "data:image/png;base64,AAAA"],
          files: [{ fileId: "file-1" }, { data: "aGk=", mediaType: "application/pdf", filename: "a.pdf" }],
        })
        .generate({ maxTokens: 10 });

      // Anthropic: image/document blocks; file-id sources switch on the
      // Files-API beta header automatically.
      await new Chat({ model: "claude-haiku-4-5", apiKey: "k" })
        .user("read", { images: [{ data: "AAAA", mediaType: "image/png" }], files: [{ fileId: "file-2", filename: "doc.pdf" }] })
        .generate({ maxTokens: 10 });

      // Responses API: input_text/input_image/input_file parts, including the
      // shapes chat completions cannot express (image by file id, file by URL).
      await OpenAI.createResponse(
        [new Message("user", "look", { images: [{ fileId: "file-3" }], files: ["https://x.test/spec.pdf"] })],
        { apiKey: "k", maxTokens: 10 },
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    const chatParts = seen[0].body.messages[0].content;
    assert.deepEqual(chatParts[0], { type: "text", text: "describe" });
    assert.deepEqual(chatParts[1], { type: "image_url", image_url: { url: "https://x.test/cat.png" } });
    assert.deepEqual(chatParts[2], { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } });
    assert.deepEqual(chatParts[3], { type: "file", file: { file_id: "file-1" } });
    assert.deepEqual(chatParts[4], { type: "file", file: { file_data: "data:application/pdf;base64,aGk=", filename: "a.pdf" } });

    const anthropicBlocks = seen[1].body.messages[0].content;
    assert.deepEqual(anthropicBlocks[1], { type: "image", source: { type: "base64", media_type: "image/png", data: "AAAA" } });
    assert.deepEqual(anthropicBlocks[2], { type: "document", source: { type: "file", file_id: "file-2" }, title: "doc.pdf" });
    assert.equal(seen[1].headers["anthropic-beta"], "files-api-2025-04-14");

    assert.equal(seen[2].url, "https://api.openai.com/v1/responses");
    const inputParts = seen[2].body.input[0].content;
    assert.deepEqual(inputParts[1], { type: "input_image", file_id: "file-3" });
    assert.deepEqual(inputParts[2], { type: "input_file", file_url: "https://x.test/spec.pdf" });

    // Unsupported combinations fail with clear typed errors instead of 400s.
    await assert.rejects(
      () => new Chat({ model: "gpt-5.4-mini", apiKey: "k" }).user("x", { images: [{ fileId: "f" }] }).generate(),
      (error) => error instanceof ProviderError && /Responses API/.test(error.message),
    );
    await assert.rejects(
      () => new Chat({ model: "grok-4.5", apiKey: "k" }).user("x", { files: [{ fileId: "f" }] }).generate(),
      (error) => error instanceof ProviderError && /images only/.test(error.message),
    );

    // Attachments survive the message JSON round-trip (session persistence).
    const message = new Message("user", "look", { files: [{ fileId: "file-9", filename: "r.pdf" }] });
    const revived = Message.fromJSON(JSON.parse(JSON.stringify(message.toJSON())));
    assert.deepEqual(revived.attachments, [{ kind: "file", fileId: "file-9", filename: "r.pdf" }]);
  });

  it("exposes typed files and responses surfaces with normalized usage and errors", async () => {
    const originalFetch = globalThis.fetch;
    const seen = [];
    globalThis.fetch = async (url, init) => {
      const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
      seen.push({
        url: String(url),
        method: init.method,
        headers: init.headers,
        form: isForm ? [...init.body.keys()] : undefined,
        body: !isForm && init.body ? JSON.parse(init.body) : undefined,
      });
      return new Response(
        JSON.stringify({
          id: "file-abc",
          output: [{ type: "message", content: [{ type: "output_text", text: '{"a":"x"}' }] }],
          usage: { input_tokens: 9, output_tokens: 2, input_tokens_details: { cached_tokens: 3 }, output_tokens_details: { reasoning_tokens: 1 } },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    try {
      const uploaded = await OpenAI.uploadFile({ data: "aGVsbG8=", filename: "a.pdf", mediaType: "application/pdf" }, { apiKey: "k" });
      assert.equal(uploaded.id, "file-abc");
      await Anthropic.uploadFile({ data: "aGVsbG8=", filename: "b.pdf", mediaType: "application/pdf" }, { apiKey: "k" });
      await OpenAI.deleteFile("file-9", { apiKey: "k" });

      const result = await OpenAI.createResponse([{ role: "user", content: "hi" }], { apiKey: "k", reasoning: "low", maxTokens: 20 });
      assert.equal(result.usage.inputTokens, 9);
      assert.equal(result.usage.cachedTokens, 3);
      assert.equal(result.usage.reasoningTokens, 1);
      assert.equal(result.provider, "openai");

      const data = await OpenAI.responseStructured(
        [{ role: "user", content: "give a" }],
        { type: "object", properties: { a: { type: "string" } }, required: ["a"], additionalProperties: false },
        { apiKey: "k" },
      );
      assert.deepEqual(data, { a: "x" });
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(seen[0].method, "POST");
    assert.equal(seen[0].url, "https://api.openai.com/v1/files");
    assert.deepEqual(seen[0].form, ["purpose", "file"]);
    assert.equal(seen[1].url, "https://api.anthropic.com/v1/files");
    assert.equal(seen[1].headers["anthropic-beta"], "files-api-2025-04-14");
    assert.deepEqual(seen[1].form, ["file"]);
    assert.equal(seen[2].method, "DELETE");
    assert.equal(seen[2].url, "https://api.openai.com/v1/files/file-9");

    assert.deepEqual(seen[3].body.reasoning, { effort: "low" });
    assert.equal(seen[3].body.max_output_tokens, 20);
    const format = seen[4].body.text.format;
    assert.equal(format.type, "json_schema");
    assert.equal(format.strict, true);
    assert.equal(format.schema.additionalProperties, false);

    // Provider failures normalize into ProviderError with the envelope fields.
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: { message: "boom", type: "invalid_request_error", param: "tools", code: "bad" } }), { status: 400 });
    try {
      await assert.rejects(
        () => new Chat({ model: "gpt-5.4-mini", apiKey: "k" }).user("x").generate(),
        (error) =>
          error instanceof ProviderError &&
          error.providerId === "openai" &&
          error.status === 400 &&
          error.errorType === "invalid_request_error" &&
          error.errorParam === "tools" &&
          error.errorCode === "bad" &&
          error.message === "boom",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("shapes Meta Model API (Muse Spark) requests per its wire rules", async () => {
    assert.equal(detectProviderByModel("muse-spark-1.2"), "meta");
    assert.deepEqual([...META_MODELS], ["muse-spark-1.2", "muse-spark-1.1", "muse-spark-1.2-contributor"]);
    assert.equal(CONTEXT_WINDOWS["muse-spark-1.2"], 1048576);

    const originalFetch = globalThis.fetch;
    const seen = [];
    globalThis.fetch = async (url, init) => {
      seen.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
      return new Response(
        JSON.stringify({
          model: "muse-spark-1.2",
          choices: [{ finish_reason: "stop", message: { role: "assistant", content: "ok" } }],
          output: [{ type: "message", content: [{ type: "output_text", text: "ok" }] }],
          usage: {
            prompt_tokens: 4, completion_tokens: 2, total_tokens: 6,
            input_tokens: 4, output_tokens: 2,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    try {
      // Everything Muse Spark rejects must be absent; everything it supports
      // must pass through with the modern parameter names.
      await new Chat({ provider: "meta", model: "muse-spark-1.2", apiKey: "k" })
        .user("hi")
        .generateWithResult({
          maxTokens: 100, stop: ["END"], reasoning: "off",
          toolChoice: "required", creativity: "precise", topP: 0.9,
        });

      // Meta-only reasoning tiers pass through; "auto" tool_choice is kept.
      await new Chat({ provider: "meta", model: "muse-spark-1.2", apiKey: "k" })
        .user("hi")
        .generateWithResult({ reasoning: "xhigh", toolChoice: "auto" });

      // Web search is a responses-only built-in tool.
      await new Chat({ provider: "meta", model: "muse-spark-1.2", apiKey: "k" })
        .user("hi")
        .generateWithResult({ webSearch: true, reasoning: "high", maxTokens: 50 });

      // Function tools ride the shared strict projection.
      await new Chat({ provider: "meta", model: "muse-spark-1.2", apiKey: "k" })
        .addTool(createTool({
          name: "t", description: "d",
          parameters: { q: Schema.String({ optional: true }) },
          execute: async () => ({}),
        }))
        .user("hi")
        .generateWithResult({});

      // Structured output uses the strict response_format path.
      await new Chat({ provider: "meta", model: "muse-spark-1.2", apiKey: "k" })
        .user("hi")
        .generateData(
          { type: "object", properties: { a: { type: "string" } }, required: ["a"], additionalProperties: false },
          {},
        )
        .catch(() => {});
    } finally {
      globalThis.fetch = originalFetch;
    }

    const locked = seen[0];
    assert.equal(locked.url, "https://api.meta.ai/v1/chat/completions");
    assert.equal(locked.headers.Authorization, "Bearer k");
    assert.equal(locked.body.max_completion_tokens, 100);
    assert.equal(locked.body.max_tokens, undefined);
    assert.equal(locked.body.stop, undefined);
    assert.equal(locked.body.reasoning_effort, undefined);
    assert.equal(locked.body.tool_choice, undefined);
    assert.equal(locked.body.temperature, 0);
    assert.equal(locked.body.top_p, 0.9);

    assert.equal(seen[1].body.reasoning_effort, "xhigh");
    assert.equal(seen[1].body.tool_choice, "auto");

    const search = seen[2];
    assert.equal(search.url, "https://api.meta.ai/v1/responses");
    assert.deepEqual(search.body.tools, [{ type: "web_search" }]);
    assert.deepEqual(search.body.reasoning, { effort: "high" });
    assert.equal(search.body.max_output_tokens, 50);

    const tooled = seen[3];
    assert.equal(tooled.body.tools[0].function.strict, true);
    assert.deepEqual(tooled.body.tools[0].function.parameters.required, ["q"]);
    assert.equal(tooled.body.reasoning_effort, undefined);

    const structured = seen[4];
    assert.equal(structured.body.response_format.type, "json_schema");
    assert.equal(structured.body.response_format.json_schema.strict, true);
  });

  it("projects strict tool schemas and keeps optional parameters legal on the wire", async () => {
    const flavors = {
      descriptor: { query: Schema.String(), limit: Schema.Integer({ optional: true }) },
      inline: { query: { type: "string" }, limit: { type: "integer", optional: true } },
      raw: { type: "object", properties: { query: { type: "string" }, limit: { type: "integer" } }, required: ["query"] },
      nested: { filter: { type: "object", properties: { tag: { type: "string" } }, required: [] } },
    };
    for (const [flavor, parameters] of Object.entries(flavors)) {
      const chat = new Chat({ model: "gpt-5.4-mini" }).addTool(
        createTool({ name: "t", description: "d", parameters, execute: async () => ({}) }),
      );
      const fn = chat._toolDefinitions("openai")[0].function;
      const wire = JSON.stringify(fn.parameters);
      assert.equal(fn.strict, true, flavor);
      assert.equal(wire.includes('"optional"'), false, `${flavor} leaks the optional marker`);
      const walk = (node) => {
        if (!node || typeof node !== "object") return;
        if (node.type === "object" && node.properties) {
          assert.equal(node.additionalProperties, false, `${flavor} misses additionalProperties`);
          assert.deepEqual([...(node.required || [])].sort(), Object.keys(node.properties).sort(), `${flavor} required not exhaustive`);
          Object.values(node.properties).forEach(walk);
        }
        (node.anyOf || []).forEach(walk);
        if (node.items) walk(node.items);
      };
      walk(fn.parameters);
    }

    // Optional parameters stay nullable on the wire and legal locally: the
    // executor may receive the key as null or not at all.
    const optionalTool = createTool({
      name: "t",
      description: "d",
      parameters: { query: { type: "string" }, limit: { type: "integer", optional: true } },
      execute: async () => ({}),
    });
    const chat = new Chat({ model: "gpt-5.4-mini" }).addTool(optionalTool);
    const projected = chat._toolDefinitions("openai")[0].function.parameters;
    assert.deepEqual(projected.properties.limit, { anyOf: [{ type: "integer" }, { type: "null" }] });
    assert.deepEqual(optionalTool.parseArgs({ query: "x" }), { query: "x" });
    assert.deepEqual(optionalTool.parseArgs({ query: "x", limit: null }), { query: "x", limit: null });

    // Anthropic keeps the unprojected schema (partial required is legal
    // there), still without leaked markers.
    const anthropicDef = chat._toolDefinitions("anthropic")[0];
    assert.equal(JSON.stringify(anthropicDef.input_schema).includes('"optional"'), false);
    assert.deepEqual(anthropicDef.input_schema.required, ["query"]);
  });

  it("keeps the provider-client tool and structured surfaces on their 0.11.x contracts", async () => {
    const originalFetch = globalThis.fetch;
    const seen = [];
    globalThis.fetch = async (url, init) => {
      const body = JSON.parse(init.body);
      seen.push({ url: String(url), body });
      if (String(url).includes("anthropic")) {
        return new Response(
          JSON.stringify({
            model: body.model,
            content: [{ type: "tool_use", id: "tu_1", name: "response", input: { name: "Ada", age: 36 } }],
            usage: { input_tokens: 4, output_tokens: 2 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      const message = body.response_format
        ? { role: "assistant", content: '{"name":"Ada","age":36}' }
        : {
            role: "assistant",
            content: "",
            tool_calls: [{ id: "call_1", type: "function", function: { name: "search", arguments: '{"query":"shoes"}' } }],
          };
      return new Response(
        JSON.stringify({
          model: body.model,
          choices: [{ finish_reason: body.response_format ? "stop" : "tool_calls", message }],
          usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    try {
      // chatWithTools: definition-only tools (no execute) reach the wire
      // projected, and the calls come back unexecuted.
      const out = await OpenAI.chatWithTools(
        [{ role: "user", content: "find shoes" }],
        [{ name: "search", description: "Search.", parameters: { query: { type: "string" }, limit: { type: "integer", optional: true } } }],
        { apiKey: "k", model: "gpt-5.4-mini" },
      );
      assert.equal(out.type, "tool_calls");
      assert.deepEqual(out.toolCalls[0].args, { query: "shoes" });

      // chatStructured: a { name, schema } wrapper is projected before it is
      // sent strict.
      const wrapped = await OpenAI.chatStructured(
        [{ role: "user", content: "hi" }],
        { name: "person", schema: { type: "object", properties: { name: { type: "string" }, age: { type: "integer" } }, required: ["name"] } },
        { apiKey: "k", model: "gpt-5.4-mini" },
      );
      assert.deepEqual(wrapped, { name: "Ada", age: 36 });

      // Anthropic structured output uses a forced tool, never response_format.
      const person = await Anthropic.messageStructured(
        [{ role: "user", content: "Extract: Ada is 36" }],
        { type: "object", properties: { name: { type: "string" }, age: { type: "integer" } }, required: ["name", "age"] },
        { apiKey: "k", model: "claude-haiku-4-5" },
      );
      assert.deepEqual(person, { name: "Ada", age: 36 });
    } finally {
      globalThis.fetch = originalFetch;
    }

    // chatWithTools is a single request — the executing tool loop must not run.
    assert.equal(seen.length, 3);
    const withTools = seen[0];
    assert.equal(withTools.body.tools[0].function.strict, true);
    assert.deepEqual([...withTools.body.tools[0].function.parameters.required].sort(), ["limit", "query"]);
    assert.equal(JSON.stringify(withTools.body.tools[0].function.parameters).includes('"optional"'), false);

    const structured = seen[1];
    const wireSchema = structured.body.response_format.json_schema;
    assert.equal(wireSchema.strict, true);
    assert.equal(wireSchema.schema.additionalProperties, false);
    assert.deepEqual([...wireSchema.schema.required].sort(), ["age", "name"]);

    const anthropicCall = seen[2];
    assert.equal(anthropicCall.body.response_format, undefined);
    assert.equal(anthropicCall.body.tools[0].name, "response");
    assert.deepEqual(anthropicCall.body.tool_choice, { type: "tool", name: "response" });
  });

  it("enforces and validates structured output in generateData", async () => {
    class Person extends Schema {
      name = Schema.String({ minLength: 2 });
      age = Schema.Integer();
    }

    const originalFetch = globalThis.fetch;
    const seen = [];
    let reply = '{"name":"Alice","age":30}';
    globalThis.fetch = async (url, init) => {
      const body = JSON.parse(init.body);
      seen.push({ url: String(url), body });
      if (body.tool_choice?.name === "response") {
        return new Response(
          JSON.stringify({
            id: "msg_s",
            model: body.model,
            content: [{ type: "tool_use", id: "toolu_1", name: "response", input: { name: "Bob", age: 41 } }],
            usage: { input_tokens: 3, output_tokens: 2 },
            stop_reason: "tool_use",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          model: body.model,
          choices: [{ finish_reason: "stop", message: { role: "assistant", content: reply } }],
          usage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    try {
      // OpenAI-compatible: strict response_format is sent and the object
      // round-trips validated.
      const person = await new Chat({ model: "gpt-5.6-terra" })
        .user("Extract: Alice is 30")
        .generateData(Person, { apiKey: "k" });
      assert.deepEqual(person, { name: "Alice", age: 30 });
      const rf = seen[0].body.response_format;
      assert.equal(rf.type, "json_schema");
      assert.equal(rf.json_schema.strict, true);
      assert.equal(rf.json_schema.schema.additionalProperties, false);

      // Prose output must throw, never silently degrade to text.
      reply = "Klar — hier sind drei Sätze: 1. ...";
      await assert.rejects(
        () => new Chat({ model: "gpt-5.4-mini" }).user("x").generateData(Person, { apiKey: "k" }),
        /expected JSON output/,
      );

      // Parseable-but-wrong output must throw a validation error.
      reply = '{"name":"A","age":"not a number"}';
      await assert.rejects(
        () => new Chat({ model: "gpt-5.4-mini" }).user("x").generateData(Person, { apiKey: "k" }),
        /does not match the schema/,
      );

      // Anthropic: structured output goes through a forced tool.
      const claude = await new Chat({ model: "claude-sonnet-5" })
        .user("Extract: Bob is 41")
        .generateData(Person, { apiKey: "k" });
      assert.deepEqual(claude, { name: "Bob", age: 41 });
      const anthropicBody = seen[seen.length - 1].body;
      assert.equal(anthropicBody.tools[0].name, "response");
      assert.deepEqual(anthropicBody.tool_choice, { type: "tool", name: "response" });
    } finally {
      globalThis.fetch = originalFetch;
    }
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
