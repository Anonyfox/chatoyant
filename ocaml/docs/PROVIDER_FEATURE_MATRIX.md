# Provider Feature Matrix

This file is the current-docs target for raw provider parity. It is intentionally
more exhaustive than `PARITY.md`: every row should eventually be either
implemented, intentionally unsupported, or blocked by a runtime capability such
as WebSocket transport or mTLS client certificates.

Sources reread on 2026-06-21:

- OpenAI API overview, Responses, Realtime, Administration, Chat Completions,
  Images, Embeddings, Models, Files, Vector Stores, Batches, Audio, Moderation,
  Evals, Containers, Fine-tuning.
- Anthropic Messages, streaming, Models, Message Batches, Files, tool use,
  web search, code execution, admin/usage references.
- xAI overview, Inference REST API, Responses, Chat, Images, Videos, Voice,
  Models, Files, Collections, Batches, async requests, priority processing,
  mTLS, WebSocket mode.
- OpenRouter Chat Completions, Responses beta, Models, Providers, Credits,
  Generation lookup, Rankings, Rerank, Video generation, Presets, API keys,
  Guardrails, Workspaces, Organization, OAuth/authentication.

## Status Legend

- `done`: typed request/response/client tests exist.
- `partial`: useful typed coverage exists, but endpoint families or event
  variants are missing.
- `blocked`: requires a runtime capability not yet represented in the current
  HTTP effect boundary, or an external service/runtime not available locally.
- `profile-opt-in`: exposed explicitly for callers that know their server
  supports the endpoint, but not used by default provider abstraction flows.
- `skip`: intentionally not part of the SDK surface unless later requested.

## OpenAI

| Feature | Status | Notes |
| --- | --- | --- |
| Responses create/retrieve/delete/cancel/compact/input items/token count/conversations | done | Typed non-stream create/retrieve/delete/cancel/compact, input item listing, input-token counting, conversation CRUD, conversation item create/retrieve/delete/list, and typed SSE event decoding/accumulation with raw fallback. |
| Chat Completions | done | Typed chat request/response/SSE, tools, tool choice, structured output, refusal, reasoning content. |
| Images generation/edit/variation | done | JSON generation plus multipart edits and variations covered with typed requests/responses. |
| Embeddings | done | Typed request/response and usage. |
| Models | done | List/retrieve typed. |
| Files | done | Upload/list/retrieve/delete/download typed with multipart body support. |
| Vector Stores | done | Create/list/retrieve/update/delete/search, vector store files, and vector store file batches covered. |
| Batches | done | Create/list/retrieve/cancel typed. Full JSONL workflow now has Files prerequisite available. |
| Audio | done | Speech, transcription, and translation are typed, including multipart upload, raw audio response, and transcript stream event decoding with raw fallback. |
| Realtime | blocked | Requires WebRTC/WebSocket effect boundary. |
| Moderation | done | Typed request/response/client coverage. |
| Fine-tuning/checkpoints | done | Fine-tuning create/list/retrieve/cancel/events and checkpoint listing covered. |
| Evals/containers | done | Evals, runs, run output items, containers, and container files covered through typed generic resource/list/delete envelopes with raw retention. |
| Administration | done | Separate admin-key config plus generic admin GET/list/POST/PATCH/DELETE and admin API key helpers. |

## Anthropic

| Feature | Status | Notes |
| --- | --- | --- |
| Messages | done | Typed request/response/error/SSE/client/provider adapter. |
| Models | done | List/retrieve typed in this pass. |
| Message Batches | done | Create/list/retrieve/cancel typed; result JSONL lines decode to typed variants with raw fallback. |
| Files | done | Beta Files upload/list/retrieve/delete/download typed with automatic `files-api-2025-04-14` beta header. |
| Tool use/server tools | done | User tools, stream deltas, hosted tool JSON helpers, server tool use blocks, web search/fetch results, code execution results, and container uploads covered with raw fallback. |
| Admin/usage/cost reports | done | Separate admin-key config plus usage and cost report helpers returning provider JSON losslessly. |

## xAI

| Feature | Status | Notes |
| --- | --- | --- |
| Responses | done | Typed request/response/client/smoke plus priority/service-tier helpers, deferred request retrieval, and Responses SSE event decoding/accumulation with raw fallback. |
| Chat Completions | done | Typed chat/image-understanding compatible request, stream, cost ticks. |
| Images | done | Generation/edit request/response covered. |
| Videos | done | Start/status/download covered. |
| Models | done | List typed. |
| Voice | done | REST TTS raw-audio body, built-in voice listing, REST STT multipart transcription with word/channel decoding, and custom voice create/list/retrieve/update/download/delete are typed/tested. WebSocket voice streaming remains in the WebSocket row. |
| Files/Collections | done | Files upload/list/retrieve/delete/download covered on inference API. Collections CRUD, document add/list/retrieve/regenerate/remove, and search covered on management API config. |
| Batches | done | Create/list/get/list requests/add requests/results/cancel typed. Request payloads preserve provider JSON for chat/image/video prepared requests. |
| mTLS/WebSocket | blocked | Deferred request retrieval is implemented for REST. mTLS client-certificate auth and WebSocket mode require runtime transport/auth extensions. |

## OpenRouter

| Feature | Status | Notes |
| --- | --- | --- |
| Chat Completions | done | Built on hidden OpenAI-compatible kernel with attribution, credit-cost usage, client/provider tests and real smoke. |
| Responses beta | done | Typed create through OpenAI Responses shapes, scoped to OpenRouter client. |
| Models | done | List/retrieve via compatible kernel plus count, user-filtered list, and model endpoint metadata. |
| Credits | done | Typed credits endpoint. |
| Generation lookup | done | Typed generation lookup endpoint. |
| Rankings/rerank/video | done | Rerank request/response and video create/status/download/list-models typed. Benchmarks/rankings remain a separate analytics surface. |
| Presets/API keys/guardrails/workspaces/org | done | Separate management-key config plus generic management methods. API key and guardrail helpers are typed/tested; presets/workspaces/org use the same generic path helpers until fixture demand justifies narrow wrappers. |

## Local OpenAI-Compatible

| Feature | Status | Notes |
| --- | --- | --- |
| Chat Completions | done | Conservative normalization, default local auth, fake HTTP tests. |
| Streaming | done | OpenAI-compatible SSE plus `<think>` fallback across chunk boundaries. |
| Models | done | List/retrieve when server supports OpenAI-compatible model endpoints. |
| Responses/Images/Embeddings | profile-opt-in | Explicit Local client methods are typed/tested for `/responses`, `/images/generations`, and `/embeddings`, but default chat flows stay conservative because local servers diverge widely. |
| Live smoke | blocked | No `LOCAL_BASE_URL` and no common local server port responded during the last pass. |
