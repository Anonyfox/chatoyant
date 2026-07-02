import assert from "node:assert/strict";
import {
  openai_decode_text,
  openai_responses_decode_text,
  openai_smoke_chat_request_json,
  openai_smoke_responses_request_json,
} from "../_build/default/js/dist/js/chatoyant_internal.js";

const apiKey = process.env.OPENAI_API_KEY;
assert.ok(apiKey, "OPENAI_API_KEY is required for real OpenAI smoke test");

const chatBody = openai_smoke_chat_request_json(
  "Respond with the exact text NODE_OPENAI_CHAT_OK and nothing else.",
);
const chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
  },
  body: chatBody,
});
const chatTextBody = await chatResponse.text();
assert.equal(chatResponse.ok, true, chatTextBody);
assert.equal(openai_decode_text(chatTextBody).trim(), "NODE_OPENAI_CHAT_OK");

const responsesBody = openai_smoke_responses_request_json(
  "Respond with the exact text NODE_OPENAI_RESPONSES_OK and nothing else.",
);
const responsesResponse = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
  },
  body: responsesBody,
});
const responsesTextBody = await responsesResponse.text();
assert.equal(responsesResponse.ok, true, responsesTextBody);
assert.equal(
  openai_responses_decode_text(responsesTextBody).trim(),
  "NODE_OPENAI_RESPONSES_OK",
);

console.log("node openai real smoke ok");
