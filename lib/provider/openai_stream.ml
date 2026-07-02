type tool_call_delta = {
  tool_index : int;
  tool_id : string option;
  tool_name : string option;
  tool_arguments_delta : string option;
}

type delta = {
  delta_content : string option;
  delta_reasoning_content : string option;
  delta_tool_calls : tool_call_delta list;
  delta_finish_reason : string option;
  delta_usage : Chatoyant_runtime.Json.t option;
}

type accumulated = {
  accumulated_content : string;
  accumulated_reasoning_content : string;
  accumulated_finish_reason : string option;
  accumulated_usage : Chatoyant_runtime.Json.t option;
}

let empty =
  {
    accumulated_content = "";
    accumulated_reasoning_content = "";
    accumulated_finish_reason = None;
    accumulated_usage = None;
  }

let field = Chatoyant_runtime.Json.field

let first_choice json =
  match field "choices" json with
  | Some (Chatoyant_runtime.Json.Array (choice :: _)) -> Some choice
  | _ -> None

let string_field name json =
  Option.bind (field name json) Chatoyant_runtime.Json.as_string

let int_field name json =
  Option.bind (field name json) Chatoyant_runtime.Json.as_int

let function_name_and_arguments json =
  match field "function" json with
  | Some fn -> (string_field "name" fn, string_field "arguments" fn)
  | None -> (None, None)

let tool_call_delta_of_json json =
  let name, arguments_delta = function_name_and_arguments json in
  {
    tool_index = Option.value (int_field "index" json) ~default:0;
    tool_id = string_field "id" json;
    tool_name = name;
    tool_arguments_delta = arguments_delta;
  }

let tool_calls_of_delta delta_json =
  match field "tool_calls" delta_json with
  | Some (Chatoyant_runtime.Json.Array calls) ->
      List.map tool_call_delta_of_json calls
  | _ -> []

let delta_of_json json =
  let usage = field "usage" json in
  match first_choice json with
  | None ->
      {
        delta_content = None;
        delta_reasoning_content = None;
        delta_tool_calls = [];
        delta_finish_reason = None;
        delta_usage = usage;
      }
  | Some choice ->
      let finish_reason = string_field "finish_reason" choice in
      let delta_json =
        Option.value (field "delta" choice) ~default:Chatoyant_runtime.Json.Null
      in
      {
        delta_content = string_field "content" delta_json;
        delta_reasoning_content = string_field "reasoning_content" delta_json;
        delta_tool_calls = tool_calls_of_delta delta_json;
        delta_finish_reason = finish_reason;
        delta_usage = usage;
      }

let apply_delta acc delta =
  {
    accumulated_content =
      acc.accumulated_content ^ Option.value delta.delta_content ~default:"";
    accumulated_reasoning_content =
      acc.accumulated_reasoning_content
      ^ Option.value delta.delta_reasoning_content ~default:"";
    accumulated_finish_reason =
      (match delta.delta_finish_reason with
      | Some _ -> delta.delta_finish_reason
      | None -> acc.accumulated_finish_reason);
    accumulated_usage =
      (match delta.delta_usage with
      | Some _ -> delta.delta_usage
      | None -> acc.accumulated_usage);
  }

let apply_chunk_json acc json = apply_delta acc (delta_of_json json)
