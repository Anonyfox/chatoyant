# Provider Specs Audit

Raw provider clients must be implemented from official current documentation,
then compared with the existing TypeScript behavior. The result for each
behavior is marked `parity`, `updated`, or `removed` in `PARITY.md`.

## OpenAI

Primary current API surface:

- API overview: https://developers.openai.com/api/reference/overview/
- Responses create/retrieve/delete/count/cancel/compact:
  https://developers.openai.com/api/reference/resources/responses/methods/create/
- Response input items and input-token counting:
  https://developers.openai.com/api/reference/resources/responses/subresources/input_items/methods/list/
- Conversations and conversation items:
  https://developers.openai.com/api/reference/resources/conversations/methods/create/
- Streaming responses: https://developers.openai.com/api/docs/guides/streaming-responses
- Function calling: https://developers.openai.com/api/docs/guides/function-calling
- Structured outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- Chat Completions reference still exists for compatibility:
  https://platform.openai.com/docs/api-reference/chat
- Images: https://developers.openai.com/api/reference/resources/images
- Embeddings: https://developers.openai.com/api/reference/resources/embeddings
- Models: https://developers.openai.com/api/reference/resources/models

Audit notes:

- New baseline should include Responses API as the modern primary surface.
- Chat Completions remains necessary for local/OpenAI-compatible servers and
  parity with current TypeScript behavior.
- OpenAI is now implemented as a standalone provider:
  - typed Responses API request/response construction and decoding, including
    instructions, previous response id, store flag, sampling, max output tokens,
    reasoning object, raw first-party tools, tool choice, text formats, metadata,
    status, output text, reasoning summaries, retrieval, deletion, cancellation,
    compaction, input item listing, input-token counting, conversation CRUD,
    conversation item CRUD/listing, and usage details.
  - typed Chat Completions request/response construction and decoding, including
    developer/system/user/assistant/tool roles, function tools, tool choice,
    strict JSON-schema response formats, logprobs, seeds, stop sequences, usage,
    refusal, and reasoning content.
  - SSE chunk decoding for Chat Completions, a Responses stream accumulator for
    output text, reasoning summary deltas, and completed response usage, plus
    transcription stream event decoding.
  - typed image generation request/response, embedding request/response, and
    model list/retrieve shapes.
  - typed image edits and variations using multipart request bodies.
  - typed Audio speech/transcription/translation, including multipart audio
    uploads, raw speech response bodies, and transcription stream events.
  - typed Files upload/list/retrieve/delete/download with multipart body
    support.
  - typed Moderation request/response.
  - typed Batch create/list/retrieve/cancel.
  - typed Vector Stores create/list/retrieve/update/delete/search plus vector
    store file create/list/retrieve/delete and file batches.
  - typed Fine-tuning job create/list/retrieve/cancel/events/checkpoints.
  - HTTP client functor over `Chatoyant_runtime.Effect.HTTP`.
  - provider adapter functor implementing `Provider.CHAT` through Responses.
  - dedicated OCaml unit tests in `test/test_openai.ml`.
  - Node ESM runtime test in `test/node_openai.mjs` importing Melange output.
  - real opt-in smoke tests in `test/smoke_openai_real.ml` and
    `test/node_openai_real.mjs`, verified against both `/v1/responses` and
    `/v1/chat/completions` with `gpt-4o-mini`.
- Evals, containers, and administration are implemented through separate typed
  generic resource/list/delete envelopes with raw retention.
- Realtime coverage includes server-to-server WebSocket through
  `Openai.Make_realtime`, ephemeral client-secret minting through
  `/realtime/client_secrets`, and WebRTC unified-interface SDP exchange through
  `/realtime/calls`. Realtime event payloads intentionally remain provider JSON
  so newly shipped event variants are retained losslessly.

## Anthropic

Primary current API surface:

- Messages reference: https://docs.anthropic.com/en/api/messages
- Streaming messages: https://docs.anthropic.com/en/api/messages-streaming
- Models reference: https://docs.anthropic.com/en/api/models-list
- Message Batches guide:
  https://docs.anthropic.com/en/docs/build-with-claude/batch-processing
- Files guide: https://docs.anthropic.com/en/docs/build-with-claude/files
- Tool use overview: https://docs.anthropic.com/en/docs/build-with-claude/tool-use/overview
- Fine-grained tool streaming:
  https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/fine-grained-tool-streaming
- Web search tool:
  https://docs.anthropic.com/en/docs/build-with-claude/tool-use/web-search-tool

Audit notes:

- Fine-grained tool streaming can produce invalid or partial JSON and must be
  decoded incrementally without pretending every chunk is complete JSON.
- Extended thinking, cache control, server tools, and content block variants
  need closed typed representations plus unknown-block fallback.
- Initial OCaml scaffold includes Messages request body construction for text,
  tool use, tool result, tools, thinking, system prompt, and sampling fields.
- Anthropic is the first end-to-end provider mirror:
  - typed Messages request construction, including tools, tool choice, thinking,
    stop sequences, metadata, top-p/top-k, beta headers through client config,
    and raw `extra` escape hatch.
  - typed prompt caching support through request-level cache control, cached
    content blocks, cached tool definitions, and hosted-tool cache-control
    helpers.
  - typed response decoding for text, thinking, redacted thinking, tool use,
    tool result, raw unknown blocks, stop reasons, and usage.
  - typed API error decoding.
  - typed SSE event decoding and stream accumulation from raw chunk strings.
  - HTTP client functor over `Chatoyant_runtime.Effect.HTTP`.
  - provider adapter functor implementing `Provider.CHAT` for unified core use.
  - typed Models API list/retrieve.
  - typed Message Batches create/list/retrieve/cancel plus JSONL result-line
    decoding.
  - typed beta Files upload/list/retrieve/delete/download with automatic files
    beta header.
  - dedicated OCaml unit tests in `test/test_anthropic.ml`.
  - Node ESM runtime test in `test/node_anthropic.mjs` importing Melange output.
  - real opt-in smoke tests in `test/smoke_anthropic_real.ml` and
    `test/node_anthropic_real.mjs`, verified against the Anthropic API with
    `claude-haiku-4-5-20251001`; the native smoke also verifies `/v1/models`.
- Server tool blocks now decode to closed variants for hosted tool use,
  web-search/web-fetch results, code-execution-style results, and container
  uploads, with raw fallback for newly introduced blocks. Hosted tool request
  helpers produce raw provider tool JSON without changing normal user-tool
  records.

## xAI

Primary current API surface:

- REST overview: https://docs.x.ai/developers/rest-api-reference
- Chat endpoint: https://docs.x.ai/developers/rest-api-reference/inference/chat
- Generate text: https://docs.x.ai/developers/model-capabilities/text/generate-text
- Chat Completions legacy note:
  https://docs.x.ai/developers/model-capabilities/legacy/chat-completions
- Imagine overview: https://docs.x.ai/developers/model-capabilities/imagine
- Image generation:
  https://docs.x.ai/developers/model-capabilities/images/generation
- Video generation:
  https://docs.x.ai/developers/rest-api-reference/inference/videos
- Text to Speech:
  https://docs.x.ai/developers/model-capabilities/audio/text-to-speech
- Speech to Text:
  https://docs.x.ai/developers/model-capabilities/audio/speech-to-text
- Custom Voices:
  https://docs.x.ai/developers/model-capabilities/audio/custom-voices
- Models: https://docs.x.ai/developers/models
- Model listing: https://docs.x.ai/developers/rest-api-reference/inference/models
- Pricing: https://docs.x.ai/developers/pricing

Audit notes:

- Current docs describe Chat Completions as legacy, with new capabilities moving
  to Responses API. The OCaml baseline should model both where required.
- Image and video generation/editing are first-class provider features.
- Cost ticks and provider-specific unsupported parameters must decode and report
  safely.
- xAI is implemented as a standalone provider, not a renamed OpenAI client:
  - typed preferred Responses API request/response construction and decoding,
    including state controls, text formats, tools, tool choice, status, output
    text, reasoning summaries, response retrieval/deletion, compaction, and
    usage cost ticks.
  - typed Responses SSE event decoding and stream accumulation for output text,
    reasoning summary text, function-call argument events, completed usage, and
    raw fallback events.
  - typed helper fields for `service_tier` and background/deferred requests,
    plus REST deferred response/chat retrieval.
  - typed Chat Completions request construction with xAI web search, function
    tools, tool choice, strict JSON-schema response formats, sampling controls,
    logprobs, seeds, stop sequences, and `extra` for newly shipped fields.
  - typed chat response decoding with reasoning content, raw response
    preservation, normalized usage, and `cost_in_usd_ticks` conversion.
  - OpenAI-compatible SSE chunk accumulation reused only below the xAI module
    boundary, so public types remain xAI-owned.
  - typed Imagine image generation, image edits, video start, and video polling
    request/response/download shapes.
  - typed REST Voice support: `/v1/tts` text-to-speech request JSON with raw
    audio response bodies, built-in voice listing, `/v1/stt` multipart
    transcription with word/channel decoding, and custom voice create/list/
    retrieve/update/download/delete.
  - typed model listing for `/v1/models`.
  - typed Files upload/list/retrieve/delete/download with TTL-aware multipart
    upload ordering.
  - typed Collections management using a separate management API config/key:
    create/list/retrieve/update/delete, document add/list/retrieve/regenerate/
    remove, and collection search.
  - typed Batch API create/list/get/list requests/add requests/results/cancel.
  - HTTP client functor over `Chatoyant_runtime.Effect.HTTP`.
  - provider adapter functor implementing `Provider.CHAT` for unified core use.
  - dedicated OCaml unit tests in `test/test_xai.ml`.
  - Node ESM runtime test in `test/node_xai.mjs` importing Melange output.
  - real opt-in smoke tests in `test/smoke_xai_real.ml` and
    `test/node_xai_real.mjs`, verified against both `/v1/chat/completions` and
    `/v1/responses` with `grok-4.20-0309-non-reasoning`.
- xAI mTLS and WebSocket mode are represented at the runtime boundary: the HTTP
  client is backed by native `Chatoyant.Http.Mutual_tls`, while
  `Chatoyant.Websocket` plus `Xai.Make_websocket` covers Responses WebSocket
  mode, Voice Agent, streaming TTS, and streaming STT. REST async/deferred flows
  and REST audio remain covered through the normal HTTP client.

## OpenRouter

Primary current API surface:

- API overview: https://openrouter.ai/docs/api/reference/overview
- Chat completion request:
  https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request
- Quickstart: https://openrouter.ai/docs/quickstart
- Models list:
  https://openrouter.ai/docs/api/api-reference/models/get-models
- Model by slug:
  https://openrouter.ai/docs/api/api-reference/models/get-model
- Endpoints for model:
  https://openrouter.ai/docs/api/api-reference/endpoints/list-endpoints
- Authentication: https://openrouter.ai/docs/api/reference/authentication

Audit notes:

- OpenRouter is OpenAI-compatible but has its own routing, provider, model,
  credits, attribution headers, and endpoint discovery semantics.
- Treat it as a real provider, not merely a base URL swap.
- OpenRouter now uses the internal OpenAI-compatible kernel:
  - `org/model` slash notation remains deterministic registry routing.
  - chat requests use the OpenAI-compatible Chat Completions shape without
    exposing the shared compatibility policy as public API.
  - attribution headers (`HTTP-Referer`, `X-Title`) are provider-specific.
  - usage `cost` credits decode into normalized actual USD.
  - typed Responses beta create, credits, provider list, and generation lookup.
  - typed model count, user-filtered model list, and model endpoint metadata.
  - typed rerank request/response.
  - typed video generation create/status/download/list-models.
  - client and provider adapter functors are tested with fake HTTP.
  - real opt-in smoke tests in `test/smoke_openrouter_real.ml` and
    `test/node_openrouter_real.mjs`, verified against OpenRouter with
    `openai/gpt-4o-mini`.

## Local OpenAI-Compatible

Baseline:

- Uses OpenAI-compatible Chat Completions request/response/stream semantics.
- Must remain permissive for Ollama, LM Studio, mlx-lm/oMLX, llama.cpp, vLLM,
  and other compatible-but-not-identical servers.

Audit notes:

- Capability detection should be graceful.
- Unsupported parameters should be filtered or reported without breaking the
  default developer experience.
- `<think>...</think>` fallback parsing remains important for local reasoning
  models that do not expose structured reasoning deltas.
- Local now uses the internal OpenAI-compatible kernel:
  - unknown model names can deterministically resolve to Local when the caller
    says local is active.
  - API key defaults to `local`.
  - conservative request normalization strips brittle optional fields commonly
    rejected by local servers (`user`, `logprobs`, `top_logprobs`,
    `parallel_tool_calls`) while preserving chat, tools, structured output,
    stop, seed, and sampling controls.
  - streaming chat chunks split `<think>...</think>` content into reasoning
    text, including tags split across SSE chunk boundaries.
  - explicit opt-in client methods cover OpenAI-compatible `/responses`,
    `/images/generations`, and `/embeddings` for local servers that implement
    those routes, without making the default provider abstraction assume those
    endpoints are portable.
  - client and provider adapter functors are tested with fake HTTP.
  - live local smoke is available through `test/smoke_local_real.ml` and
    `test/node_local_real.mjs` when `LOCAL_BASE_URL` and `LOCAL_MODEL` point at
    a running OpenAI-compatible server.
