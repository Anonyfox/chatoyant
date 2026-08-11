(* Meta Model API (Muse Spark) adapter.

   Muse Spark is served at https://api.meta.ai/v1 with OpenAI-compatible
   endpoints; this adapter rides /v1/responses like the first-party OpenAI
   adapter and reuses its serializers and client. Wire rules that differ from
   OpenAI (per Meta's Model API docs, verified 2026-08):
   - reasoning is always on; [reasoning_effort] "none" is rejected with an
     HTTP 400 — the field is omitted instead (the model picks its own level).
     Accepted efforts: minimal, low, medium, high, xhigh.
   - [tool_choice] supports only "auto"; named, "required", and "none" are
     rejected with an HTTP 400 — anything else is omitted.
   - [stop] sequences are not supported and are dropped.
   - sampling (temperature, top_p, penalties) is fully supported.
   - web search runs as a built-in server-side tool ({"type":"web_search"}). *)

let default_base_url = "https://api.meta.ai/v1"

let models =
  [ "muse-spark-1.2"; "muse-spark-1.1"; "muse-spark-1.2-contributor" ]

let string value = Chatoyant_runtime.Json.String value

let reasoning_json (options : Provider.options) =
  match options.reasoning_effort with
  | Some "none" | Some "off" | None -> None
  | Some effort ->
      Some (Chatoyant_runtime.Json.Object [ ("effort", string effort) ])

let tool_choice (options : Provider.options) =
  match options.tool_choice with Some "auto" -> Some Openai.Auto | _ -> None

let web_search_tool =
  Chatoyant_runtime.Json.Object [ ("type", string "web_search") ]

let tools_json (options : Provider.options) =
  let function_tools =
    List.map Openai.responses_tool_of_provider_tool options.tools
  in
  match options.web_search with
  | Some true -> function_tools @ [ web_search_tool ]
  | _ -> function_tools

let extra_fields (options : Provider.options) =
  let fields =
    match options.extra with
    | Some (Chatoyant_runtime.Json.Object fields) -> fields
    | _ -> []
  in
  let add name value fields =
    if List.mem_assoc name fields then fields else (name, value) :: fields
  in
  ( fields |> fun fields ->
    match options.frequency_penalty with
    | None -> fields
    | Some value ->
        add "frequency_penalty" (Chatoyant_runtime.Json.Float value) fields )
  |> fun fields ->
  match options.presence_penalty with
  | None -> fields
  | Some value ->
      add "presence_penalty" (Chatoyant_runtime.Json.Float value) fields

let responses_request messages (options : Provider.options) :
    Openai.responses_request =
  {
    responses_model = options.model;
    responses_input =
      Input_items
        (List.concat_map Openai.responses_input_items_of_provider_message
           messages);
    responses_instructions = None;
    responses_previous_response_id = None;
    responses_store = Some false;
    responses_stream = false;
    responses_temperature = options.temperature;
    responses_top_p = options.top_p;
    responses_max_output_tokens = options.max_tokens;
    responses_reasoning = reasoning_json options;
    responses_tools = tools_json options;
    responses_tool_choice = tool_choice options;
    responses_text_format = None;
    responses_parallel_tool_calls = None;
    responses_truncation = None;
    responses_metadata = [];
    responses_extra = extra_fields options;
  }

module Make_provider
    (Http : Chatoyant_runtime.Effect.HTTP)
    (Config : sig
      val api_key : string
      val base_url : string
      val timeout_ms : int option
    end) =
struct
  module Client = Openai.Make_client (Http)

  let id = Provider.Meta

  let generate messages (options : Provider.options) =
    let request = responses_request messages options in
    let config =
      {
        Client.api_key = Config.api_key;
        base_url = Config.base_url;
        timeout_ms = Config.timeout_ms;
      }
    in
    match Client.create_response config request with
    | Ok response -> Ok (Openai.generation_of_responses_response response)
    | Error error -> Error (Provider.Runtime_error error.error_message)
end
