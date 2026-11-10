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

    const instance = Schema.create(SearchArgs);
    assert.equal(Schema.parse(instance, { q: "legacy", limit: 2 }), instance);
    assert.deepEqual(Schema.toObject(instance), { q: "legacy", limit: 2 });
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

  it("reuses schemas while keeping data, detailed errors and options fresh", () => {
    const schema = new JsonSchema({ type: "string", format: "email" });
    for (let i = 0; i < 3; i++) {
      assert.equal(schema.validate("person@example.com"), true);
      assert.equal(schema.validate("invalid", { formatAssertion: true }), false);
      assert.deepEqual(schema.validateDetailed("invalid"), { valid: true, errors: [] });
      const rejected = schema.validateDetailed(42);
      assert.equal(rejected.valid, false);
      assert.equal(rejected.errors.some(error => error.keyword === "type"), true);
    }
    const resources = [{ uri: "https://example.com/value", schema: { type: "string" } }];
    const referenced = new JsonSchema({ $ref: resources[0].uri });
    assert.equal(referenced.validate("ok", { resources }), true);
    resources[0].schema.type = "integer";
    assert.equal(referenced.validate("ok", { resources }), false);
    assert.equal(referenced.validate(42, { resources }), true);
  });

  it("invalidates cached schemas after nested edits and schema replacement", () => {
    const raw = {
      type: "object",
      properties: { count: { type: "integer", minimum: 1 } },
      required: ["count"],
    };
    const schema = new JsonSchema(raw);
    const other = new JsonSchema({ type: "integer" });
    assert.equal(schema.validate({ count: 1 }), true);
    assert.equal(schema.validate({ count: 1 }), true);
    raw.properties.count.minimum = 2;
    assert.equal(schema.validate({ count: 1 }), false);
    assert.equal(JsonSchema.validate(raw, { count: 1 }).valid, false);
    schema.toJSON().required.push("missing");
    assert.equal(schema.validate({ count: 2 }), false);
    schema.toJSON().required.pop();
    assert.equal(schema.validate({ count: 2 }), true);
    delete raw.properties.count.minimum;
    assert.equal(schema.validate({ count: 0 }), true);
    schema.schema = false;
    assert.equal(schema.validate({ count: 2 }), false);
    schema.schema = true;
    assert.equal(schema.validate(null), true);
    schema.schema = { type: "string" };
    assert.equal(schema.validate("ok"), true);
    assert.equal(schema.validate(42), false);
    assert.equal(other.validate(42), true);
  });

  it("observes custom schema serialization changes on repeated calls", () => {
    let type = "string";
    const schema = new JsonSchema({
      type: "object",
      properties: { value: { toJSON: () => ({ type }) } },
    });
    assert.equal(schema.validate({ value: "ok" }), true);
    type = "integer";
    assert.equal(schema.validate({ value: "ok" }), false);
    assert.equal(schema.validate({ value: 42 }), true);
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
