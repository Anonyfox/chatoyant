import assert from "node:assert/strict";
import {
  anthropic_batch_request_json,
  anthropic_batch_result_text,
  anthropic_decode_text,
  anthropic_model_count,
  anthropic_request_json,
  anthropic_stream_text4,
  version,
} from "../_build/default/js/dist/js/chatoyant_internal.js";

assert.equal(version, "0.0.0-port");

const request = JSON.parse(anthropic_request_json());
assert.equal(request.model, "claude-sonnet-4-6");
assert.equal(request.system, "You are helpful");
assert.equal(request.messages[0].content[0].text, "Hello");
assert.equal(request.tool_choice.name, "lookup");
assert.equal(request.thinking.budget_tokens, 2048);
assert.deepEqual(request.stop_sequences, ["END"]);

const responseText = anthropic_decode_text(
  JSON.stringify({
    id: "msg_node",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-6",
    content: [{ type: "text", text: "Hello Node" }],
    stop_reason: "end_turn",
    usage: { input_tokens: 3, output_tokens: 2 },
  }),
);
assert.equal(responseText, "Hello Node");

const streamed = anthropic_stream_text4(
  'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_stream","type":"message","role":"assistant","model":"claude-sonnet-4-6","content":[],"usage":{"input_tokens":4,"output_tokens":0}}}\n\n',
  'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
  'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hel',
  'lo Node"}}\n\n',
);
assert.equal(streamed, "Hello Node");

const batch = JSON.parse(anthropic_batch_request_json());
assert.equal(batch.requests[0].custom_id, "case_1");
assert.equal(batch.requests[0].params.model, "claude-haiku-4-5-20251001");

const modelCount = anthropic_model_count(
  JSON.stringify({
    data: [{ id: "claude-haiku-4-5-20251001", type: "model" }],
    has_more: false,
  }),
);
assert.equal(modelCount, 1);

const batchText = anthropic_batch_result_text(
  JSON.stringify({
    custom_id: "case_1",
    result: {
      type: "succeeded",
      message: {
        id: "msg_1",
        type: "message",
        role: "assistant",
        model: "claude-haiku-4-5-20251001",
        content: [{ type: "text", text: "Batch ok" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    },
  }) + "\n",
);
assert.equal(batchText, "Batch ok");

console.log("node anthropic ok");
