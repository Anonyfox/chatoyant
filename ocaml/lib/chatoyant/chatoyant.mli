(** Aggregate public entrypoint for the OCaml implementation. *)

module Runtime = Chatoyant_runtime
module Tokens = Chatoyant_tokens
module Schema = Chatoyant_schema
module Provider = Chatoyant_provider
module Core = Chatoyant_core

module Clock = Chatoyant_native.Clock
module Env = Chatoyant_native.Env
module Http = Chatoyant_native.Http
module Websocket = Chatoyant_native.Websocket
module Error = Chatoyant_native.Error
module Chat = Chatoyant_native.Chat

type client = Chatoyant_native.client

val openai :
  ?https:Http.https ->
  ?max_response_size:int ->
  ?base_url:string ->
  ?timeout_ms:int ->
  ?model:string ->
  ?defaults:Core.Options.t ->
  ?api_key:string ->
  ?system:string ->
  ?tools:Core.Tool.t list ->
  < net : _ Eio.Net.t ; clock : _ Eio.Time.clock ; .. > ->
  client

val anthropic :
  ?https:Http.https ->
  ?max_response_size:int ->
  ?base_url:string ->
  ?timeout_ms:int ->
  ?beta_headers:string list ->
  ?model:string ->
  ?defaults:Core.Options.t ->
  ?api_key:string ->
  ?system:string ->
  ?tools:Core.Tool.t list ->
  < net : _ Eio.Net.t ; clock : _ Eio.Time.clock ; .. > ->
  client

val xai :
  ?https:Http.https ->
  ?max_response_size:int ->
  ?base_url:string ->
  ?timeout_ms:int ->
  ?model:string ->
  ?defaults:Core.Options.t ->
  ?api_key:string ->
  ?system:string ->
  ?tools:Core.Tool.t list ->
  < net : _ Eio.Net.t ; clock : _ Eio.Time.clock ; .. > ->
  client

val openrouter :
  ?https:Http.https ->
  ?max_response_size:int ->
  ?timeout_ms:int ->
  ?http_referer:string ->
  ?title:string ->
  ?headers:(string * string) list ->
  ?model:string ->
  ?defaults:Core.Options.t ->
  ?api_key:string ->
  ?system:string ->
  ?tools:Core.Tool.t list ->
  < net : _ Eio.Net.t ; clock : _ Eio.Time.clock ; .. > ->
  client

val local :
  ?https:Http.https ->
  ?max_response_size:int ->
  ?api_key:string ->
  ?timeout_ms:int ->
  ?headers:(string * string) list ->
  ?model:string ->
  ?defaults:Core.Options.t ->
  ?system:string ->
  ?tools:Core.Tool.t list ->
  < net : _ Eio.Net.t ; clock : _ Eio.Time.clock ; .. > ->
  base_url:string ->
  client

val gen_result :
  ?system:string ->
  ?tools:Core.Tool.t list ->
  ?options:Core.Options.t ->
  ?timeout_ms:int ->
  ?temperature:float ->
  ?max_tokens:int ->
  ?extra:Runtime.Json.t ->
  client ->
  string ->
  (Core.Result.generation, Provider.Provider.error) result

val gen_text :
  ?system:string ->
  ?tools:Core.Tool.t list ->
  ?options:Core.Options.t ->
  ?timeout_ms:int ->
  ?temperature:float ->
  ?max_tokens:int ->
  ?extra:Runtime.Json.t ->
  client ->
  string ->
  (string, Provider.Provider.error) result

val gen_data :
  ?name:string ->
  ?description:string ->
  ?strict:bool ->
  codec:'a Schema.Codec.t ->
  ?system:string ->
  ?tools:Core.Tool.t list ->
  ?options:Core.Options.t ->
  ?timeout_ms:int ->
  ?temperature:float ->
  ?max_tokens:int ->
  ?extra:Runtime.Json.t ->
  client ->
  string ->
  ('a, Provider.Provider.error) result

module Generate = Chatoyant_native.Generate
