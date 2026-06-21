type id =
  | Openai
  | Anthropic
  | Xai
  | Local
  | Openrouter

type role =
  | System
  | User
  | Assistant
  | Tool

type tool_definition = {
  tool_name : string;
  tool_description : string option;
  tool_parameters : Chatoyant_runtime.Json.t;
  tool_strict : bool option;
}

type tool_call = {
  id : string;
  name : string;
  arguments : Chatoyant_runtime.Json.t;
  arguments_json : string;
  raw : Chatoyant_runtime.Json.t option;
}

type message = {
  role : role;
  content : string option;
  name : string option;
  tool_call_id : string option;
  tool_calls : tool_call list;
  tool_result_error : bool option;
}

type options = {
  model : string;
  temperature : float option;
  max_tokens : int option;
  timeout_ms : int option;
  tools : tool_definition list;
  tool_choice : string option;
  extra : Chatoyant_runtime.Json.t option;
}

type error =
  | Missing_api_key of { provider : id; env_key : string }
  | Http_error of { status : int; body : string }
  | Decode_error of string
  | Unsupported of string
  | Runtime_error of string

type generation = {
  content : string;
  reasoning_content : string;
  usage : Chatoyant_tokens.Cost.usage;
  usage_source : Chatoyant_tokens.Cost.source;
  tool_calls : tool_call list;
  finish_reason : string option;
  raw : Chatoyant_runtime.Json.t option;
}

module type CHAT = sig
  val id : id
  val generate : message list -> options -> (generation, error) result
end

let string_of_id = function
  | Openai -> "openai"
  | Anthropic -> "anthropic"
  | Xai -> "xai"
  | Local -> "local"
  | Openrouter -> "openrouter"

let id_of_string = function
  | "openai" -> Some Openai
  | "anthropic" -> Some Anthropic
  | "xai" -> Some Xai
  | "local" -> Some Local
  | "openrouter" -> Some Openrouter
  | _ -> None

let error_to_string = function
  | Missing_api_key { provider; env_key } ->
      Printf.sprintf "missing %s API key from %s" (string_of_id provider) env_key
  | Http_error { status; body } -> Printf.sprintf "HTTP %d: %s" status body
  | Decode_error message -> "decode error: " ^ message
  | Unsupported message -> "unsupported: " ^ message
  | Runtime_error message -> "runtime error: " ^ message

let string value = Chatoyant_runtime.Json.String value

let add_opt name value fields =
  match value with
  | None -> fields
  | Some value -> (name, value) :: fields

let tool_definition_to_json (tool : tool_definition) =
  [
    ("name", string tool.tool_name);
    ("parameters", tool.tool_parameters);
  ]
  |> add_opt "description" (Option.map string tool.tool_description)
  |> add_opt "strict" (Option.map (fun value -> Chatoyant_runtime.Json.Bool value) tool.tool_strict)
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let tool_call_to_json (call : tool_call) =
  [
    ("id", string call.id);
    ("name", string call.name);
    ("arguments", call.arguments);
    ("arguments_json", string call.arguments_json);
  ]
  |> add_opt "raw" call.raw
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let generation_to_json (generation : generation) =
  [
    ("content", string generation.content);
    ("reasoning_content", string generation.reasoning_content);
    ("usage", Chatoyant_tokens.Cost.usage_to_json generation.usage);
    ( "usage_source",
      string (Chatoyant_tokens.Cost.source_to_string generation.usage_source) );
    ("tool_calls", Chatoyant_runtime.Json.Array (List.map tool_call_to_json generation.tool_calls));
  ]
  |> add_opt "finish_reason" (Option.map string generation.finish_reason)
  |> add_opt "raw" generation.raw
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields
