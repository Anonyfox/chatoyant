import {
  xai_decode_text,
  xai_image_request_json,
  xai_request_json,
  xai_responses_decode_text,
  xai_responses_request_json,
  xai_stream_text4,
  xai_video_request_json,
} from "../_build/default/js/dist/js/chatoyant_internal.js";

const request = JSON.parse(xai_request_json());
if (request.model !== "grok-4-1-fast-non-reasoning") {
  throw new Error("unexpected xAI model");
}
if (request.tools?.[0]?.type !== "web_search") {
  throw new Error("missing xAI web_search tool");
}
if (request.response_format?.type !== "json_schema") {
  throw new Error("missing xAI json_schema response format");
}

const responsesRequest = JSON.parse(xai_responses_request_json());
if (responsesRequest.model !== "grok-4.20-0309-non-reasoning") {
  throw new Error("unexpected xAI Responses model");
}
if (responsesRequest.text?.format?.type !== "json_schema") {
  throw new Error("missing xAI Responses text format");
}
if (responsesRequest.store !== false) {
  throw new Error("xAI Responses smoke should not store history");
}

const decoded = xai_decode_text(
  JSON.stringify({
    id: "chatcmpl_xai",
    model: "grok-4-1-fast-non-reasoning",
    choices: [
      {
        message: {
          role: "assistant",
          content: "Hello from JS Grok",
        },
      },
    ],
    usage: {
      prompt_tokens: 2,
      completion_tokens: 3,
      total_tokens: 5,
      cost_in_usd_ticks: 1000000000,
    },
  }),
);
if (decoded !== "Hello from JS Grok") {
  throw new Error(`bad xAI decode: ${decoded}`);
}

const responsesDecoded = xai_responses_decode_text(
  JSON.stringify({
    id: "resp_xai",
    model: "grok-4.20-0309-non-reasoning",
    status: "completed",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: "Hello from JS Responses" }],
      },
    ],
    usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
  }),
);
if (responsesDecoded !== "Hello from JS Responses") {
  throw new Error(`bad xAI Responses decode: ${responsesDecoded}`);
}

const streamed = xai_stream_text4(
  'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
  'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
  'data: {"choices":[{"finish_reason":"stop","delta":{}}]}\n\n',
  "data: [DONE]\n\n",
);
if (streamed !== "Hello") {
  throw new Error(`bad xAI stream decode: ${streamed}`);
}

const image = JSON.parse(xai_image_request_json("Draw a cube"));
if (image.model !== "grok-imagine-image-quality" || image.response_format !== "b64_json") {
  throw new Error("bad xAI image request");
}

const video = JSON.parse(xai_video_request_json("Animate a cube"));
if (video.model !== "grok-imagine-video-1.5" || video.duration !== 6) {
  throw new Error("bad xAI video request");
}

console.log("node xai ok");
