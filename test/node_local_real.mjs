import assert from "node:assert/strict";

const baseUrl = process.env.LOCAL_BASE_URL;
const model = process.env.LOCAL_MODEL;
assert.ok(baseUrl, "LOCAL_BASE_URL is required for real Local smoke test");
assert.ok(model, "LOCAL_MODEL is required for real Local smoke test");

const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${process.env.LOCAL_API_KEY ?? "local"}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    model,
    messages: [
      {
        role: "user",
        content: "Respond with the exact text NODE_LOCAL_OK and nothing else.",
      },
    ],
    temperature: 0,
    max_tokens: 32,
    stream: false,
  }),
});

const textBody = await response.text();
assert.equal(response.ok, true, textBody);
const json = JSON.parse(textBody);
const text = json.choices?.[0]?.message?.content ?? json.output_text ?? "";
assert.equal(String(text).trim(), "NODE_LOCAL_OK");
console.log("node local real smoke ok");
