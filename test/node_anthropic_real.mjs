import assert from "node:assert/strict";
import {
  anthropic_decode_text,
  anthropic_smoke_request_json,
} from "../_build/default/js/dist/js/chatoyant_internal.js";

const apiKey = process.env.ANTHROPIC_API_KEY;
assert.ok(apiKey, "ANTHROPIC_API_KEY is required for real Anthropic smoke test");

const body = anthropic_smoke_request_json(
  "Respond with the exact text NODE_SMOKE_OK and nothing else.",
);

const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  },
  body,
});

const textBody = await response.text();
assert.equal(response.ok, true, textBody);

const decoded = anthropic_decode_text(textBody).trim();
assert.equal(decoded, "NODE_SMOKE_OK");
console.log("node anthropic real smoke ok");
