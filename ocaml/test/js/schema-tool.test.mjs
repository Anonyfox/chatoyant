import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { JsonSchema, Schema, createTool } from "chatoyant";

class SearchArgs extends Schema {
  q = Schema.String({ minLength: 1, description: "Query" });
  limit = Schema.Integer({ optional: true, minimum: 1, maximum: 20 });
  tags = Schema.Array(Schema.String(), { optional: true });
}

class SearchResult extends Schema {
  ok = Schema.Boolean();
  q = Schema.String();
}

describe("Schema and JsonSchema", () => {
  it("emits and validates class-authored JSON Schema", () => {
    const generated = Schema.toJSON(SearchArgs);

    assert.equal(generated.type, "object");
    assert.equal(generated.additionalProperties, false);
    assert.equal(generated.properties.q.type, "string");
    assert.equal(generated.properties.q.minLength, 1);
    assert.equal(generated.required.includes("q"), true);
    assert.equal(generated.required.includes("limit"), false);
    assert.equal(Schema.validate(SearchArgs, { q: "hello", limit: null }), true);
    assert.equal(Schema.validate(SearchArgs, { q: "hello", limit: 100 }), false);
    assert.equal(Schema.validate(SearchArgs, { q: "hello", extra: true }), false);
    assert.deepEqual(Schema.parse(SearchArgs, { q: "hello", tags: ["a"] }), { q: "hello", tags: ["a"] });
  });

  it("validates raw schemas and reports detailed errors", () => {
    const schema = {
      type: "object",
      properties: {
        q: { type: "string", minLength: 1 },
        limit: { anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }] },
      },
      required: ["q"],
      additionalProperties: false,
    };

    assert.equal(JsonSchema.validate(schema, { q: "search", limit: null }).valid, true);
    const rejected = JsonSchema.validate(schema, { q: "", extra: true });
    assert.equal(rejected.valid, false);
    assert.equal(rejected.errors.length > 0, true);
    assert.equal(new JsonSchema(schema).validate({ q: "x" }), true);
  });

  it("resolves external refs, dynamic refs, and vocabulary toggles", () => {
    const resources = [
      { uri: "http://example.com/integer.json", schema: { type: "integer" } },
      { uri: "http://example.com/root/folder/integer.json", schema: { type: "integer" } },
      {
        uri: "http://example.com/meta/no-validation",
        schema: {
          $id: "http://example.com/meta/no-validation",
          $vocabulary: {
            "https://json-schema.org/draft/2020-12/vocab/core": true,
            "https://json-schema.org/draft/2020-12/vocab/applicator": true,
          },
        },
      },
    ];

    assert.equal(JsonSchema.validate({ $ref: "http://example.com/integer.json" }, 1, { resources }).valid, true);
    assert.equal(JsonSchema.validate({ $ref: "http://example.com/integer.json" }, "x", { resources }).valid, false);
    assert.equal(
      JsonSchema.validate(
        {
          $id: "http://example.com/root/",
          items: { $id: "folder/", items: { $ref: "integer.json" } },
        },
        [[1]],
        { resources },
      ).valid,
      true,
    );

    const dynamicSchema = {
      $id: "https://test.example/dynamic/root",
      $ref: "list",
      $defs: {
        override: { $dynamicAnchor: "items", type: "string" },
        list: {
          $id: "list",
          type: "array",
          items: { $dynamicRef: "#items" },
          $defs: { items: { $dynamicAnchor: "items" } },
        },
      },
    };
    assert.equal(JsonSchema.validate(dynamicSchema, ["a"]).valid, true);
    assert.equal(JsonSchema.validate(dynamicSchema, [1]).valid, false);

    assert.equal(
      JsonSchema.validate(
        {
          $schema: "http://example.com/meta/no-validation",
          properties: { numberProperty: { minimum: 10 } },
        },
        { numberProperty: 1 },
        { resources },
      ).valid,
      true,
    );
  });

  it("projects object schemas to OpenAI strict structured-output form", () => {
    const projected = JsonSchema.projectOpenAIStrict({
      type: "object",
      properties: { q: { type: "string" } },
    }).toJSON();

    assert.equal(projected.additionalProperties, false);
    assert.deepEqual(projected.required, ["q"]);
  });
});

describe("Tool", () => {
  it("validates args, executes, validates results, and reports failures", async () => {
    const tool = createTool({
      name: "search",
      description: "Search things",
      parameters: SearchArgs,
      resultSchema: SearchResult,
      execute: async ({ args, ctx }) => ({ ok: ctx.provider === "openai", q: args.q }),
    });

    assert.equal(tool.validateArgs({ q: "needle" }), true);
    assert.equal(tool.validateArgs({ q: "" }), false);
    assert.equal(tool.validateResult({ ok: true, q: "needle" }), true);
    assert.equal(tool.validateResult({ ok: true }), false);

    const ok = await tool.executeCall(
      { id: "call_1", name: "search", args: { q: "needle" } },
      { model: "gpt-4o", provider: "openai" },
    );
    assert.equal(ok.success, true);
    assert.deepEqual(ok.result, { ok: true, q: "needle" });

    const bad = await tool.executeCall(
      { id: "call_2", name: "search", args: { q: "" } },
      { model: "gpt-4o", provider: "openai" },
    );
    assert.equal(bad.success, false);
    assert.match(bad.error, /minLength|shorter/);
  });
});
