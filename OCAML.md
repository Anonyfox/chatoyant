# OCaml Guide

Chatoyant's OCaml API is the primary implementation surface. It assumes Eio,
returns `result` values for provider operations, and keeps schemas, tools, and
messages typed all the way to the provider boundary.

## Install Shape

The package is intended to be consumed as the `chatoyant` opam package:

```lisp
(libraries chatoyant)
```

Use `chatoyant.ppx` when you want derived codecs, typed structured outputs, or
the `module%tool` syntax:

```lisp
(preprocess (pps chatoyant.ppx))
```

## One-Shot Text

```ocaml
open Chatoyant

let run env =
  let ai = Chatoyant.openai ~model:"gpt-6-luna" env in
  match Chatoyant.gen_text ai "Summarize Eio in one sentence." with
  | Ok text -> print_endline text
  | Error err -> prerr_endline (Chatoyant.Error.provider err)

let () = Eio_main.run run
```

`Chatoyant.openai`, `Chatoyant.anthropic`, `Chatoyant.xai`, `Chatoyant.meta`,
`Chatoyant.openrouter`, and `Chatoyant.local` construct stateful chat clients.
Provider constructors read the standard provider API key environment variable
when `~api_key` is omitted.

User messages accept image/file attachments
(`Chatoyant.Provider.Provider.attachment`), rendered into each provider's
wire blocks — OpenAI/Meta content parts and Responses input items, Anthropic
image/document blocks:

```ocaml
let attachment =
  {
    Chatoyant.Provider.Provider.attachment_kind = File_attachment;
    attachment_source = Attachment_file_id file_id;
    attachment_filename = Some "spec.pdf";
  }
in
Chatoyant.Chat.user ~attachments:[ attachment ] "Read the attached spec." chat
```

Upload once through the raw file clients (`Openai.Make_client.upload_file`,
`Anthropic.Make_client.upload_file`) and attach by file id — follow-up turns
re-send only the id, never the bytes. Anthropic file-id sources need the
`files-api-2025-04-14` beta header (`~beta_headers` on the provider
constructor).

## Structured Data

Record and variant codecs can be generated directly from normal OCaml types.
Doc comments become JSON Schema descriptions.

```ocaml
type billing_status =
  | Pending
  | Paid
[@@deriving chatoyant]

type invoice = {
  vendor : string; (** Legal vendor name. *)
  total : float [@minimum 0.]; (** Total amount in USD. *)
  due_date : string option; (** ISO-8601 due date when present. *)
  tags : string list [@min_items 1]; (** Search tags. *)
  status : billing_status; (** Payment status. *)
}
[@@deriving chatoyant]

let extract_invoice ai email =
  [%chatoyant.gen_data: invoice] ai ("Extract invoice data:\n" ^ email)
```

The generated `invoice_codec` can also be passed explicitly to
`Chatoyant.gen_data ~codec:invoice_codec` when a larger abstraction needs to
store codecs as values.

## Tools As Modules

The preferred tool shape is one small module per tool. The handler stays a
plain OCaml function, so it can be unit-tested directly without network calls or
LLM machinery.

```ocaml
module%tool Calculate = struct
  type operation =
    | Add
    | Divide

  type request = {
    operation : operation; (** Operation to apply. *)
    values : float list [@min_items 1]; (** Numbers to combine in order. *)
  }

  type answer = {
    expression : string;
    result : float;
  }

  (** Combine numbers with a typed arithmetic operation. *)
  let run : request -> (answer, string) result =
   fun { operation; values } ->
    match operation, values with
    | _, [] -> Error "at least one value is required"
    | Add, values ->
        Ok { expression = "add"; result = List.fold_left ( +. ) 0. values }
    | Divide, first :: rest ->
        List.fold_left
          (fun acc value -> Result.bind acc (fun n ->
             if value = 0. then Error "division by zero" else Ok (n /. value)))
          (Ok first) rest
        |> Result.map (fun result -> { expression = "divide"; result })
end
```

The PPX derives `Calculate.tool`, `Calculate.request_schema`,
`Calculate.request_to_json`, and `Calculate.request_of_json`.

Effectful tools use an ordinary first environment argument and receive a
generated `make` function:

```ocaml
module%tool Lookup_city_metric = struct
  type ('net, 'clock) env = {
    net : 'net Eio.Net.t;
    clock : 'clock Eio.Time.clock;
    base_url : string;
  }

  type request = {
    city : string; (** City name, for example Berlin. *)
  }

  type metric = {
    city : string;
    metric : float;
    source : string;
  }

  (** Look up a city metric over HTTP. *)
  let run : ('net, 'clock) env -> request -> (metric, string) result =
   fun { net; clock; base_url } { city } ->
    let url = base_url ^ "/metric?city=" ^ Uri.pct_encode city in
    match Chatoyant.Http.get_json ~net ~clock url with
    | Error err -> Error (Chatoyant.Http.error_to_string err)
    | Ok json -> metric_of_json json
end
```

Then compose the chat:

```ocaml
let run env =
  let metric_env =
    { Lookup_city_metric.net = env#net; clock = env#clock; base_url = "http://localhost:8080" }
  in
  let ai =
    Chatoyant.openai ~model:"gpt-6-luna"
      ~tools:[ Calculate.tool; Lookup_city_metric.make metric_env ]
      env
  in
  Chatoyant.Chat.system "Use tools when useful." ai
  |> Chatoyant.Chat.user "Divide 83 by 3 and look up Berlin."
  |> Chatoyant.Chat.generate
```

## Chat State

`Chatoyant.Chat` is stateful by design, matching the useful shape of the JS
`Chat` class while staying idiomatic in OCaml.

```ocaml
let ai = Chatoyant.openai ~model:"gpt-6-luna" env

let result =
  ai
  |> Chatoyant.Chat.system "Be terse."
  |> Chatoyant.Chat.user "Hello."
  |> Chatoyant.Chat.generate_with_result

let messages = Chatoyant.Chat.messages ai
let last = Chatoyant.Chat.last_result ai
let snapshot = Chatoyant.Chat.to_json ai
let restored = Chatoyant.Chat.of_json env snapshot
```

The one-shot helpers `Chatoyant.gen_text`, `Chatoyant.gen_result`, and
`Chatoyant.gen_data` do not mutate the chat history. Use `Chatoyant.Chat.*`
when conversation state is the point.

## Realtime And mTLS

Native OCaml uses Eio for both HTTP and WebSocket effects. Low-level Realtime
sessions stay provider-owned so rapidly changing event shapes are preserved as
JSON.

```ocaml
let openai_realtime env api_key =
  let module Ws = (val Chatoyant.Websocket.make ~net:env#net ~clock:env#clock ()) in
  let module Realtime = Chatoyant.Provider.Openai.Make_realtime (Ws) in
  Realtime.connect
    {
      realtime_api_key = api_key;
      realtime_model = "gpt-realtime-2";
      realtime_base_url = Realtime.default_base_url;
      realtime_timeout_ms = Some 30_000;
      realtime_headers = [];
      realtime_safety_identifier = None;
    }
    (fun socket ->
      Realtime.send_json socket
        (Chatoyant.Runtime.Json.Object
           [ ("type", Chatoyant.Runtime.Json.String "response.create") ]))
```

xAI voice, streaming TTS/STT, and Responses WebSocket mode use the same
`Chatoyant.Websocket` effect through `Chatoyant.Provider.Xai.Make_websocket`.
Enterprise mTLS endpoints use the normal provider constructors with a native
TLS mode:

```ocaml
let cert =
  Chatoyant.Http.
    {
      certificate_pem = my_certificate_pem;
      private_key_pem = my_private_key_pem;
      authenticator = None;
    }

let ai = Chatoyant.xai ~https:(Chatoyant.Http.Mutual_tls cert) env
```

## Error Handling

Provider operations return `('a, Chatoyant.Provider.Provider.error) result`.
The helper `Chatoyant.Error.provider` renders an error for logs or CLI output,
but the structured provider error remains available for application decisions.

Local OpenAI-compatible inference is treated as unmetered. Remote providers use
provider-reported token usage and cost metadata when available and estimate only
when a provider omits the numbers.

Model presets resolve as follows:

| Preset | OpenAI | Anthropic | xAI | Meta |
| --- | --- | --- | --- | --- |
| fast / cheap | gpt-6-luna | claude-haiku-5-5 | grok-4.20-0309-non-reasoning | muse-spark-1.3 |
| balanced | gpt-6.1-sol | claude-sonnet-5-5 | grok-4.3 | muse-spark-1.3 |
| best / reasoning | gpt-6-astra | claude-fable-5-1 | grok-4.7 | muse-spark-1.3 |

Also recognized: gpt-6.1-terra (text/image input, 1,050,000 context tokens,
128,000 max output tokens), gpt-6-sol, gpt-5.6-cyber, gpt-5.5-cyber, gpt-5.3-codex,
chat-latest, gpt-5-search-api, claude-mythos-5-1, claude-opus-5-5,
claude-opus-5, grok-4.6, grok-build-0.1, muse-spark-1.3-contributor,
muse-wonder-1.0, grok-imagine-image-2.0, grok-imagine-image-quality,
grok-imagine-video-1.5, and grok-imagine-video-1.5-lite.

OpenAI prices use the short-context tier (up to 272K input tokens); higher
long-context rates are not modelled. GPT-5.6 Sol uses OpenAI's promotional
price, at least through 2026-11-21. Haiku 5.5 prompts above 100K tokens
and Grok Build prompts at or above 200K tokens have higher rates not modelled here.

Retired on first-party APIs (ids still resolve for pricing/detection): claude-opus-4-1, claude-opus-4, claude-sonnet-4, claude-3-5-haiku/claude-3-*; xAI no longer lists grok-4-1-fast-*, grok-code-fast-1, grok-3*, grok-4-0709.
