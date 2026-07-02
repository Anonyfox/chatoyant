import {
  JsonSchema,
  Schema,
  createTool,
} from "../_build/default/js/dist/js/chatoyant_js.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const objectSchema = {
  type: "object",
  properties: {
    q: { type: "string", minLength: 1 },
    limit: { anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }] },
  },
  required: ["q"],
  additionalProperties: false,
};

assert(JsonSchema.validate(objectSchema, { q: "search", limit: null }).valid, "raw schema should validate");
assert(!JsonSchema.validate(objectSchema, { q: "", extra: true }).valid, "raw schema should reject invalid data");

class SearchArgs extends Schema {
  q = Schema.String({ minLength: 1, description: "Query" });
  limit = Schema.Integer({ optional: true, minimum: 1, maximum: 20 });
  tags = Schema.Array(Schema.String(), { optional: true });
}

const generated = Schema.toJSON(SearchArgs);
assert(generated.type === "object", "Schema class should emit object JSON Schema");
assert(generated.required.includes("q"), "required field missing");
assert(!generated.required.includes("limit"), "optional field should not be required");
assert(Schema.validate(SearchArgs, { q: "hello", limit: null }), "optional field should accept null for compatibility");
assert(!Schema.validate(SearchArgs, { q: "hello", limit: 100 }), "constraint should reject invalid optional value");
assert(!Schema.validate(SearchArgs, { q: "hello", extra: true }), "generated schema should reject extras");

const projected = JsonSchema.projectOpenAIStrict({
  type: "object",
  properties: { q: { type: "string" } },
});
assert(projected.toJSON().additionalProperties === false, "projection should tighten object schemas");

const tool = createTool({
  name: "search",
  description: "Search things",
  parameters: SearchArgs,
  execute: async ({ args }) => ({ ok: true, q: args.q }),
  resultSchema: Schema.Object({ ok: Schema.Boolean(), q: Schema.String() }),
});

assert(tool.validateArgs({ q: "needle" }), "tool should validate args");
assert(!tool.validateArgs({ q: "" }), "tool should reject invalid args");
const ok = await tool.executeCall({ id: "call_1", name: "search", args: { q: "needle" } }, { model: "gpt-4o", provider: "openai" });
assert(ok.success === true && ok.result.q === "needle", "tool execution should succeed");
const bad = await tool.executeCall({ id: "call_2", name: "search", args: { q: "" } }, { model: "gpt-4o", provider: "openai" });
assert(bad.success === false, "tool execution should fail invalid args");

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

assert(
  JsonSchema.validate({ $ref: "http://example.com/integer.json" }, 1, { resources }).valid,
  "resource store should resolve external refs",
);
assert(
  !JsonSchema.validate({ $ref: "http://example.com/integer.json" }, "x", { resources }).valid,
  "resource store should reject external ref mismatches",
);
assert(
  JsonSchema.validate(
    {
      $id: "http://example.com/root/",
      items: { $id: "folder/", items: { $ref: "integer.json" } },
    },
    [[1]],
    { resources },
  ).valid,
  "resource refs should preserve trailing-slash base URIs",
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
assert(JsonSchema.validate(dynamicSchema, ["a"]).valid, "$dynamicRef should use dynamic scope");
assert(!JsonSchema.validate(dynamicSchema, [1]).valid, "$dynamicRef should reject through dynamic scope");

assert(
  JsonSchema.validate(
    {
      $schema: "http://example.com/meta/no-validation",
      properties: { numberProperty: { minimum: 10 } },
    },
    { numberProperty: 1 },
    { resources },
  ).valid,
  "custom vocabulary should be able to disable validation assertions",
);
assert(
  !JsonSchema.validate(
    {
      $schema: "http://example.com/meta/no-validation",
      properties: { badProperty: false },
    },
    { badProperty: "nope" },
    { resources },
  ).valid,
  "custom vocabulary should leave applicators active",
);

console.log("node json schema ok");
