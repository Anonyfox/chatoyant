import {
  local_request_json,
  local_stream_reasoning4,
  local_stream_text4,
  openrouter_request_json,
} from "../_build/default/js/dist/js/chatoyant_internal.js";

const local = JSON.parse(local_request_json());
if (local.model !== "Qwen3-4B-MLX") {
  throw new Error("unexpected local model");
}
if (local.logprobs !== undefined || local.top_logprobs !== undefined) {
  throw new Error("local request should strip logprob fields");
}
if (local.parallel_tool_calls !== undefined || local.user !== undefined) {
  throw new Error("local request should strip brittle optional fields");
}
if (!local.tools?.length || local.response_format?.type !== "json_schema") {
  throw new Error("local request should preserve tools and structured output");
}

const chunks = [
  'data: {"choices":[{"delta":{"content":"Visible <thi"}}]}\n\n',
  'data: {"choices":[{"delta":{"content":"nk>secret</thi"}}]}\n\n',
  'data: {"choices":[{"delta":{"content":"nk> text"},"finish_reason":"stop"}],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}\n\n',
  "data: [DONE]\n\n",
];
const text = local_stream_text4(...chunks);
const reasoning = local_stream_reasoning4(...chunks);
if (text !== "Visible  text" || reasoning !== "secret") {
  throw new Error(`bad local think split: ${JSON.stringify({ text, reasoning })}`);
}

const openrouter = JSON.parse(openrouter_request_json());
if (openrouter.model !== "anthropic/claude-sonnet-4.5") {
  throw new Error("unexpected OpenRouter model");
}
if (openrouter.logprobs !== true || openrouter.parallel_tool_calls !== false) {
  throw new Error("OpenRouter should preserve full compatible fields");
}

console.log("node openai-compatible ok");
