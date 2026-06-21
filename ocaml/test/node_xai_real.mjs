import assert from "node:assert/strict";
import {
  xai_decode_text,
  xai_responses_decode_text,
  xai_responses_smoke_request_json,
  xai_smoke_request_json,
} from "../_build/default/js/dist/js/chatoyant_internal.js";

const apiKey = process.env.XAI_API_KEY;
assert.ok(apiKey, "XAI_API_KEY is required for real xAI smoke test");

const body = xai_smoke_request_json(
  "Respond with the exact text NODE_XAI_SMOKE_OK and nothing else.",
);

const response = await fetch("https://api.x.ai/v1/chat/completions", {
  method: "POST",
  headers: {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
  },
  body,
});

const textBody = await response.text();
assert.equal(response.ok, true, textBody);

const decoded = xai_decode_text(textBody).trim();
assert.equal(decoded, "NODE_XAI_SMOKE_OK");

const responsesBody = xai_responses_smoke_request_json(
  "Respond with the exact text NODE_XAI_RESPONSES_OK and nothing else.",
);
const responsesResponse = await fetch("https://api.x.ai/v1/responses", {
  method: "POST",
  headers: {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
  },
  body: responsesBody,
});

const responsesTextBody = await responsesResponse.text();
assert.equal(responsesResponse.ok, true, responsesTextBody);

const responsesDecoded = xai_responses_decode_text(responsesTextBody).trim();
assert.equal(responsesDecoded, "NODE_XAI_RESPONSES_OK");
console.log("node xai real smoke ok");
