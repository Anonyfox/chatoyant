import assert from "node:assert/strict";
import {
  openai_decode_text,
  openrouter_smoke_request_json,
} from "../_build/default/js/dist/js/chatoyant_internal.js";

const apiKey = process.env.OPENROUTER_API_KEY;
assert.ok(apiKey, "OPENROUTER_API_KEY is required for real OpenRouter smoke test");

const body = openrouter_smoke_request_json(
  "Respond with the exact text NODE_OPENROUTER_OK and nothing else.",
);

const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
    "x-title": "Chatoyant OCaml smoke",
  },
  body,
});

const textBody = await response.text();
assert.equal(response.ok, true, textBody);
assert.equal(openai_decode_text(textBody).trim(), "NODE_OPENROUTER_OK");
console.log("node openrouter real smoke ok");
