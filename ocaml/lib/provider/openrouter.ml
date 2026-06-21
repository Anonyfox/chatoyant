type request = Openai.chat_request
type response = Openai.chat_response
type responses_request = Openai.responses_request
type responses_response = Openai.responses_response

type credits = {
  total_credits : float;
  total_usage : float;
  raw : Chatoyant_runtime.Json.t;
}

type provider_info = {
  provider_id : string option;
  provider_name : string option;
  provider_raw : Chatoyant_runtime.Json.t;
}

type provider_list = {
  providers : provider_info list;
  raw : Chatoyant_runtime.Json.t;
}

type generation = {
  generation_id : string option;
  generation_model : string option;
  generation_provider_name : string option;
  generation_total_cost : float option;
  generation_created_at : string option;
  generation_raw : Chatoyant_runtime.Json.t;
}

type model_count = {
  model_count : int;
  model_count_raw : Chatoyant_runtime.Json.t;
}

type model_endpoint = {
  model_endpoint_name : string option;
  model_endpoint_provider_name : string option;
  model_endpoint_context_length : int option;
  model_endpoint_max_completion_tokens : int option;
  model_endpoint_quantization : string option;
  model_endpoint_status : string option;
  model_endpoint_supported_parameters : string list;
  model_endpoint_pricing : Chatoyant_runtime.Json.t option;
  model_endpoint_raw : Chatoyant_runtime.Json.t;
}

type model_endpoint_list = {
  model_endpoint_model_id : string option;
  model_endpoint_model_name : string option;
  model_endpoint_model_description : string option;
  model_endpoint_model_created : int option;
  model_endpoint_model_architecture : Chatoyant_runtime.Json.t option;
  model_endpoints : model_endpoint list;
  model_endpoint_list_raw : Chatoyant_runtime.Json.t;
}

type rerank_document =
  | Rerank_text of string
  | Rerank_object of Chatoyant_runtime.Json.t

type rerank_request = {
  rerank_model : string;
  rerank_query : string;
  rerank_documents : rerank_document list;
  rerank_top_n : int option;
  rerank_provider : Chatoyant_runtime.Json.t option;
  rerank_extra : (string * Chatoyant_runtime.Json.t) list;
}

type rerank_result = {
  rerank_index : int option;
  rerank_relevance_score : float option;
  rerank_document : Chatoyant_runtime.Json.t option;
  rerank_result_raw : Chatoyant_runtime.Json.t;
}

type rerank_response = {
  rerank_id : string option;
  rerank_model_name : string option;
  rerank_provider_name : string option;
  rerank_results : rerank_result list;
  rerank_usage : Chatoyant_runtime.Json.t option;
  rerank_raw : Chatoyant_runtime.Json.t;
}

type video_request = {
  video_model : string;
  video_prompt : string;
  video_aspect_ratio : string option;
  video_callback_url : string option;
  video_duration : int option;
  video_frame_images : Chatoyant_runtime.Json.t list;
  video_generate_audio : bool option;
  video_input_references : Chatoyant_runtime.Json.t list;
  video_provider : Chatoyant_runtime.Json.t option;
  video_resolution : string option;
  video_seed : int option;
  video_size : string option;
  video_extra : (string * Chatoyant_runtime.Json.t) list;
}

type video_status =
  | Video_pending
  | Video_running
  | Video_completed
  | Video_failed
  | Video_cancelled
  | Video_unknown_status of string

type video_job = {
  video_job_id : string option;
  video_polling_url : string option;
  video_status : video_status;
  video_error : string option;
  video_generation_id : string option;
  video_unsigned_urls : string list;
  video_usage : Chatoyant_runtime.Json.t option;
  video_raw : Chatoyant_runtime.Json.t;
}

type video_model = {
  video_model_id : string option;
  video_model_name : string option;
  video_model_canonical_slug : string option;
  video_model_created : int option;
  video_model_raw : Chatoyant_runtime.Json.t;
}

type video_model_list = {
  video_models : video_model list;
  video_models_raw : Chatoyant_runtime.Json.t;
}

type management_resource = {
  management_id : string option;
  management_name : string option;
  management_raw : Chatoyant_runtime.Json.t;
}

type management_list = {
  management_data : management_resource list;
  management_raw : Chatoyant_runtime.Json.t;
}

type management_delete = {
  management_delete_id : string option;
  management_deleted : bool;
  management_delete_raw : Chatoyant_runtime.Json.t;
}

let base_url = "https://openrouter.ai/api/v1"

let default_config =
  Openai_compatible.openrouter_config ~api_key:"openrouter" ()

let chat_request_json request =
  Openai_compatible.chat_request_json default_config request

let authorization_headers ?http_referer ?title ~api_key () =
  Openai_compatible.authorization_headers
    (Openai_compatible.openrouter_config ?http_referer ?title ~api_key ())

let chat_response_of_stream_chunks chunks =
  Openai_compatible.chat_response_of_stream_chunks default_config chunks

let field = Chatoyant_runtime.Json.field
let string value = Chatoyant_runtime.Json.String value
let bool value = Chatoyant_runtime.Json.Bool value
let int value = Chatoyant_runtime.Json.Float (Float.of_int value)
let string_field name json = Option.bind (field name json) Chatoyant_runtime.Json.as_string
let float_field name json = Option.bind (field name json) Chatoyant_runtime.Json.as_float
let int_field name json = Option.bind (field name json) Chatoyant_runtime.Json.as_int
let bool_field name json = Option.bind (field name json) Chatoyant_runtime.Json.as_bool

let add_opt name encode value fields =
  match value with
  | None -> fields
  | Some value -> (name, encode value) :: fields

let add_non_empty name encode values fields =
  match values with
  | [] -> fields
  | _ -> (name, Chatoyant_runtime.Json.Array (List.map encode values)) :: fields

let rerank_document_json = function
  | Rerank_text text -> string text
  | Rerank_object json -> json

let rerank_request_json request =
  [
    ("model", string request.rerank_model);
    ("query", string request.rerank_query);
    ("documents", Chatoyant_runtime.Json.Array (List.map rerank_document_json request.rerank_documents));
  ]
  |> add_opt "top_n" int request.rerank_top_n
  |> add_opt "provider" (fun value -> value) request.rerank_provider
  |> List.rev_append request.rerank_extra
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let video_request_json request =
  [
    ("model", string request.video_model);
    ("prompt", string request.video_prompt);
  ]
  |> add_opt "aspect_ratio" string request.video_aspect_ratio
  |> add_opt "callback_url" string request.video_callback_url
  |> add_opt "duration" int request.video_duration
  |> add_non_empty "frame_images" (fun value -> value) request.video_frame_images
  |> add_opt "generate_audio" bool request.video_generate_audio
  |> add_non_empty "input_references" (fun value -> value) request.video_input_references
  |> add_opt "provider" (fun value -> value) request.video_provider
  |> add_opt "resolution" string request.video_resolution
  |> add_opt "seed" int request.video_seed
  |> add_opt "size" string request.video_size
  |> List.rev_append request.video_extra
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let credits_of_json json =
  let data = Option.value (field "data" json) ~default:json in
  {
    total_credits = Option.value (float_field "total_credits" data) ~default:0.0;
    total_usage = Option.value (float_field "total_usage" data) ~default:0.0;
    raw = json;
  }

let provider_info_of_json json =
  {
    provider_id =
      (match string_field "id" json with
      | Some _ as value -> value
      | None -> string_field "slug" json);
    provider_name = string_field "name" json;
    provider_raw = json;
  }

let provider_list_of_json json =
  let values =
    match field "data" json with
    | Some (Chatoyant_runtime.Json.Array values) -> values
    | _ -> []
  in
  { providers = List.map provider_info_of_json values; raw = json }

let generation_of_json json =
  let data = Option.value (field "data" json) ~default:json in
  {
    generation_id = string_field "id" data;
    generation_model = string_field "model" data;
    generation_provider_name = string_field "provider_name" data;
    generation_total_cost =
      (match float_field "total_cost" data with
      | Some _ as value -> value
      | None -> float_field "cost" data);
    generation_created_at = string_field "created_at" data;
    generation_raw = json;
  }

let model_count_of_json json =
  let data = Option.value (field "data" json) ~default:json in
  {
    model_count = Option.value (int_field "count" data) ~default:0;
    model_count_raw = json;
  }

let string_list_field name json =
  match field name json with
  | Some (Chatoyant_runtime.Json.Array values) ->
      List.filter_map Chatoyant_runtime.Json.as_string values
  | _ -> []

let model_endpoint_of_json json =
  {
    model_endpoint_name = string_field "name" json;
    model_endpoint_provider_name =
      (match string_field "provider_name" json with
      | Some _ as value -> value
      | None -> string_field "provider" json);
    model_endpoint_context_length = int_field "context_length" json;
    model_endpoint_max_completion_tokens = int_field "max_completion_tokens" json;
    model_endpoint_quantization = string_field "quantization" json;
    model_endpoint_status = string_field "status" json;
    model_endpoint_supported_parameters = string_list_field "supported_parameters" json;
    model_endpoint_pricing = field "pricing" json;
    model_endpoint_raw = json;
  }

let model_endpoint_list_of_json json =
  let data = Option.value (field "data" json) ~default:json in
  let endpoint_values =
    match field "endpoints" data with
    | Some (Chatoyant_runtime.Json.Array values) -> values
    | _ -> (
        match data with
        | Chatoyant_runtime.Json.Array values -> values
        | _ -> [])
  in
  {
    model_endpoint_model_id = string_field "id" data;
    model_endpoint_model_name = string_field "name" data;
    model_endpoint_model_description = string_field "description" data;
    model_endpoint_model_created = int_field "created" data;
    model_endpoint_model_architecture = field "architecture" data;
    model_endpoints = List.map model_endpoint_of_json endpoint_values;
    model_endpoint_list_raw = json;
  }

let rerank_result_of_json json =
  {
    rerank_index = int_field "index" json;
    rerank_relevance_score =
      (match float_field "relevance_score" json with
      | Some _ as value -> value
      | None -> float_field "score" json);
    rerank_document = field "document" json;
    rerank_result_raw = json;
  }

let rerank_response_of_json json =
  {
    rerank_id = string_field "id" json;
    rerank_model_name = string_field "model" json;
    rerank_provider_name = string_field "provider" json;
    rerank_results =
      (match field "results" json with
      | Some (Chatoyant_runtime.Json.Array values) -> List.map rerank_result_of_json values
      | _ -> []);
    rerank_usage = field "usage" json;
    rerank_raw = json;
  }

let video_status_of_string = function
  | "pending" | "queued" -> Video_pending
  | "running" | "processing" -> Video_running
  | "completed" | "done" | "succeeded" -> Video_completed
  | "failed" | "error" -> Video_failed
  | "cancelled" | "canceled" -> Video_cancelled
  | value -> Video_unknown_status value

let video_job_of_json json =
  {
    video_job_id = string_field "id" json;
    video_polling_url = string_field "polling_url" json;
    video_status =
      json |> string_field "status" |> Option.map video_status_of_string
      |> Option.value ~default:(Video_unknown_status "");
    video_error = string_field "error" json;
    video_generation_id = string_field "generation_id" json;
    video_unsigned_urls = string_list_field "unsigned_urls" json;
    video_usage = field "usage" json;
    video_raw = json;
  }

let video_model_of_json json =
  {
    video_model_id = string_field "id" json;
    video_model_name = string_field "name" json;
    video_model_canonical_slug = string_field "canonical_slug" json;
    video_model_created = int_field "created" json;
    video_model_raw = json;
  }

let video_model_list_of_json json =
  {
    video_models =
      (match field "data" json with
      | Some (Chatoyant_runtime.Json.Array values) -> List.map video_model_of_json values
      | _ -> []);
    video_models_raw = json;
  }

let management_resource_of_json json =
  let data = Option.value (field "data" json) ~default:json in
  {
    management_id =
      (match string_field "id" data with
      | Some _ as value -> value
      | None -> string_field "hash" data);
    management_name = string_field "name" data;
    management_raw = data;
  }

let management_list_of_json json =
  let values =
    match field "data" json with
    | Some (Chatoyant_runtime.Json.Array values) -> values
    | _ -> (
        match field "items" json with
        | Some (Chatoyant_runtime.Json.Array values) -> values
        | _ -> [])
  in
  { management_data = List.map management_resource_of_json values; management_raw = json }

let management_delete_of_json json =
  {
    management_delete_id =
      (match string_field "id" json with
      | Some _ as value -> value
      | None -> string_field "hash" json);
    management_deleted = Option.value (bool_field "deleted" json) ~default:false;
    management_delete_raw = json;
  }

let compatible_config api_key timeout_ms http_referer title headers =
  Openai_compatible.openrouter_config ?timeout_ms ?http_referer ?title ~headers ~api_key ()

module Make_client (Http : Chatoyant_runtime.Effect.HTTP) = struct
  module Client = Openai_compatible.Make_client (Http)

  type config = {
    api_key : string;
    timeout_ms : int option;
    http_referer : string option;
    title : string option;
    headers : (string * string) list;
  }

  type management_config = {
    management_api_key : string;
    management_base_url : string;
    management_timeout_ms : int option;
  }

  let default_management_base_url = base_url

  let to_compatible config =
    compatible_config config.api_key config.timeout_ms config.http_referer config.title config.headers

  let endpoint_of_base base_url path =
    let base =
      if String.ends_with ~suffix:"/" base_url then
        String.sub base_url 0 (String.length base_url - 1)
      else base_url
    in
    base ^ path

  let endpoint config path =
    let compatible = to_compatible config in
    endpoint_of_base compatible.base_url path

  let management_endpoint config path =
    endpoint_of_base config.management_base_url path

  let request ?(method_ = "POST") config path body =
    {
      Http.method_;
      url = endpoint config path;
      headers = Openai_compatible.authorization_headers (to_compatible config);
      body;
      timeout_ms = config.timeout_ms;
    }

  let management_request ?(method_ = "GET") config path body =
    {
      Http.method_;
      url = management_endpoint config path;
      headers =
        [
          ("Authorization", "Bearer " ^ config.management_api_key);
          ("Content-Type", "application/json");
        ];
      body;
      timeout_ms = config.management_timeout_ms;
    }

  let parse_response decode response =
    if response.Http.status < 200 || response.status >= 300 then
      match Chatoyant_runtime.Json.parse response.body with
      | Ok json -> Error (Openai.api_error_of_json json)
      | Error _ ->
          Error
            {
              Openai.error_type = Some "http_error";
              error_message = "OpenRouter HTTP " ^ string_of_int response.status ^ ": " ^ response.body;
              error_code = None;
              error_param = None;
              error_raw = None;
            }
    else
      match Chatoyant_runtime.Json.parse response.body with
      | Error message ->
          Error
            {
              Openai.error_type = Some "decode_error";
              error_message = message;
              error_code = None;
              error_param = None;
              error_raw = None;
            }
      | Ok json -> Ok (decode json)

  let map_http_error = function
    | Http.Timeout ms ->
        {
          Openai.error_type = Some "timeout_error";
          error_message = "Request timed out after " ^ string_of_int ms ^ "ms";
          error_code = None;
          error_param = None;
          error_raw = None;
        }
    | Network message ->
        { Openai.error_type = Some "network_error"; error_message = message; error_code = None; error_param = None; error_raw = None }
    | Invalid_response message ->
        { Openai.error_type = Some "invalid_response"; error_message = message; error_code = None; error_param = None; error_raw = None }

  let send decode request =
    match Http.send request with
    | Error error -> Error (map_http_error error)
    | Ok response -> parse_response decode response

  let raw_response request =
    match Http.send request with
    | Error error -> Error (map_http_error error)
    | Ok response when response.status < 200 || response.status >= 300 ->
        (match Chatoyant_runtime.Json.parse response.body with
        | Ok json -> Error (Openai.api_error_of_json json)
        | Error _ ->
            Error
              {
                Openai.error_type = Some "http_error";
                error_message = "OpenRouter HTTP " ^ string_of_int response.status ^ ": " ^ response.body;
                error_code = None;
                error_param = None;
                error_raw = None;
              })
    | Ok response -> Ok response.body

  let query params =
    let values =
      List.filter_map
        (fun (name, value) -> Option.map (fun value -> name ^ "=" ^ value) value)
        params
    in
    match values with
    | [] -> ""
    | _ -> "?" ^ String.concat "&" values

  let pct_encode_path_segment text =
    let is_unreserved = function
      | 'A' .. 'Z' | 'a' .. 'z' | '0' .. '9' | '-' | '_' | '.' | '~' -> true
      | _ -> false
    in
    let buffer = Buffer.create (String.length text) in
    String.iter
      (fun ch ->
        if is_unreserved ch then Buffer.add_char buffer ch
        else Buffer.add_string buffer (Printf.sprintf "%%%02X" (Char.code ch)))
      text;
    Buffer.contents buffer

  let model_endpoints_path ~author ~slug =
    "/models/" ^ pct_encode_path_segment author ^ "/" ^ pct_encode_path_segment slug ^ "/endpoints"

  let invalid_model_id model_id =
    Error
      {
        Openai.error_type = Some "invalid_request_error";
        error_message =
          "OpenRouter model_id must be in author/slug form for endpoint metadata: " ^ model_id;
        error_code = None;
        error_param = Some "model_id";
        error_raw = None;
      }

  let create_chat config request =
    Client.create_chat (to_compatible config) request

  let create_response config request_body =
    send Openai.responses_response_of_json
      (request config "/responses" (Json (Openai.responses_request_json request_body)))

  let list_models config = Client.list_models (to_compatible config)

  let list_user_models config =
    send Openai.model_list_of_json (request ~method_:"GET" config "/models/user" Empty)

  let count_models ?output_modalities config =
    let path =
      "/models/count" ^ query [ ("output_modalities", output_modalities) ]
    in
    send model_count_of_json (request ~method_:"GET" config path Empty)

  let retrieve_model config ~model_id =
    Client.retrieve_model (to_compatible config) ~model_id

  let list_model_endpoints config ~author ~slug =
    send model_endpoint_list_of_json
      (request ~method_:"GET" config (model_endpoints_path ~author ~slug) Empty)

  let list_model_endpoints_by_id config ~model_id =
    match String.split_on_char '/' model_id with
    | author :: slug_parts when author <> "" && slug_parts <> [] ->
        let slug = String.concat "/" slug_parts in
        if slug = "" then invalid_model_id model_id
        else list_model_endpoints config ~author ~slug
    | _ -> invalid_model_id model_id

  let get_credits config =
    send credits_of_json (request ~method_:"GET" config "/credits" Empty)

  let list_providers config =
    send provider_list_of_json (request ~method_:"GET" config "/providers" Empty)

  let retrieve_generation config ~generation_id =
    send generation_of_json
      (request ~method_:"GET" config ("/generation?id=" ^ generation_id) Empty)

  let rerank config request_body =
    send rerank_response_of_json (request config "/rerank" (Json (rerank_request_json request_body)))

  let create_video config request_body =
    send video_job_of_json (request config "/videos" (Json (video_request_json request_body)))

  let get_video config ~job_id =
    send video_job_of_json (request ~method_:"GET" config ("/videos/" ^ job_id) Empty)

  let download_video ?index config ~job_id =
    let path =
      "/videos/" ^ job_id ^ "/content"
      ^ query [ ("index", Option.map string_of_int index) ]
    in
    raw_response (request ~method_:"GET" config path Empty)

  let list_video_models config =
    send video_model_list_of_json (request ~method_:"GET" config "/videos/models" Empty)

  let management_get config ~path =
    send management_resource_of_json (management_request config path Empty)

  let management_list config ~path =
    send management_list_of_json (management_request config path Empty)

  let management_post config ~path body =
    send management_resource_of_json (management_request ~method_:"POST" config path (Json body))

  let management_patch config ~path body =
    send management_resource_of_json (management_request ~method_:"PATCH" config path (Json body))

  let management_delete config ~path =
    send management_delete_of_json (management_request ~method_:"DELETE" config path Empty)

  let list_keys config =
    management_list config ~path:"/keys"

  let get_current_key config =
    management_get config ~path:"/key"

  let create_key config body =
    management_post config ~path:"/keys" body

  let update_key config ~key_hash body =
    management_patch config ~path:("/keys/" ^ key_hash) body

  let delete_key config ~key_hash =
    management_delete config ~path:("/keys/" ^ key_hash)

  let list_guardrails config =
    management_list config ~path:"/guardrails"

  let create_guardrail config body =
    management_post config ~path:"/guardrails" body

  let get_guardrail config ~guardrail_id =
    management_get config ~path:("/guardrails/" ^ guardrail_id)

  let update_guardrail config ~guardrail_id body =
    management_patch config ~path:("/guardrails/" ^ guardrail_id) body

  let delete_guardrail config ~guardrail_id =
    management_delete config ~path:("/guardrails/" ^ guardrail_id)
end

module Make_provider
    (Http : Chatoyant_runtime.Effect.HTTP)
    (Config : sig
      val api_key : string
      val timeout_ms : int option
      val http_referer : string option
      val title : string option
      val headers : (string * string) list
    end) =
struct
  module Provider_impl =
    Openai_compatible.Make_provider (Http) (struct
      let provider_id = Provider.Openrouter

      let config =
        compatible_config Config.api_key Config.timeout_ms Config.http_referer Config.title Config.headers
    end)

  let id = Provider_impl.id
  let generate = Provider_impl.generate
end
