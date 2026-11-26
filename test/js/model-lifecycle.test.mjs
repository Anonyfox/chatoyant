import assert from "node:assert/strict";
import { test } from "node:test";
import { Chat, XAI, getContextWindow, getPricing, modelLifecycle } from "chatoyant";

test("first-party lifecycle entries preserve historical model lookups", () => {
  const model = "grok-build-0.1";
  assert.deepEqual(modelLifecycle(model), {
    status: "retired", deprecatedOn: undefined, retiresOn: "2026-11-19",
    replacement: undefined, note: undefined,
  });
  assert.ok(getPricing(model));
  assert.ok(getContextWindow(model));
  for (const id of ["claude-opus-4-5", "claude-opus-4-5-20251101"]) {
    assert.deepEqual(modelLifecycle(id), {
      status: "deprecated", deprecatedOn: "2026-11-23", retiresOn: "2027-01-22",
      replacement: "claude-opus-5-5", note: undefined,
    });
  }
  assert.equal(modelLifecycle("claude-opus-5-5"), undefined);
  assert.equal(modelLifecycle("claude-opus-4-50"), undefined);
  assert.equal(modelLifecycle("GROK-3").status, "retired");
  assert.equal(modelLifecycle("grok-3").retiresOn, undefined);
});

test("requests preserve model ids and warn once even if the logger throws", async (t) => {
  const model = "grok-build-0.1";
  const warn = t.mock.method(console, "warn", () => { throw new Error("logger failed"); });
  const fetch = t.mock.method(globalThis, "fetch", async (_url, init) => {
    assert.equal(JSON.parse(init.body).model, model);
    return Response.json({ choices: [{ message: { role: "assistant", content: "ok" } }] });
  });
  const result = await new Chat({ model }).user("hello").generate({ apiKey: "test" });
  assert.equal(result, "ok");
  await XAI.request("/chat/completions", { apiKey: "test", json: { model } });
  assert.equal(fetch.mock.callCount(), 2);
  assert.equal(warn.mock.callCount(), 1);
  assert.match(warn.mock.calls[0].arguments[0], /grok-build-0\.1.*2026-11-19/);
});

test("the environment can silence lifecycle warnings", async (t) => {
  const previous = process.env.CHATOYANT_SILENCE_MODEL_WARNINGS;
  process.env.CHATOYANT_SILENCE_MODEL_WARNINGS = "1";
  t.after(() => {
    if (previous === undefined) delete process.env.CHATOYANT_SILENCE_MODEL_WARNINGS;
    else process.env.CHATOYANT_SILENCE_MODEL_WARNINGS = previous;
  });
  const warn = t.mock.method(console, "warn", () => {});
  t.mock.method(globalThis, "fetch", async () => Response.json({}));
  await XAI.request("/chat/completions", { apiKey: "test", json: { model: "grok-3" } });
  assert.equal(warn.mock.callCount(), 0);
});
