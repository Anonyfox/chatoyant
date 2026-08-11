(** Meta Model API (Muse Spark) adapter.

    Rides the OpenAI-compatible [/v1/responses] protocol at
    {:https://api.meta.ai/v1} and reuses the OpenAI serializers and client.
    Encodes the Muse Spark wire rules: reasoning cannot be disabled
    ([reasoning_effort] "none"/"off" is omitted instead of sent), only the
    "auto" [tool_choice] is forwarded, [stop] sequences are dropped, sampling
    parameters pass through, and [web_search] becomes the built-in server-side
    tool. For raw endpoint access beyond generation, use {!Openai.Make_client}
    with {!default_base_url}. *)

val default_base_url : string
(** [https://api.meta.ai/v1] *)

val models : string list
(** Hosted Muse Spark model ids, current generation first. The [-contributor]
    variant is the discounted tier that permits Meta to train on request data —
    priced and recognized, but never a preset default. *)

val responses_request :
  Provider.message list -> Provider.options -> Openai.responses_request
(** Build the Responses-API request for one generation turn, applying the Muse
    Spark wire rules above. *)

module Make_provider
    (Http : Chatoyant_runtime.Effect.HTTP)
    (Config : sig
      val api_key : string
      val base_url : string
      val timeout_ms : int option
    end) : sig
  val id : Provider.id

  val generate :
    Provider.message list ->
    Provider.options ->
    (Provider.generation, Provider.error) result
end
