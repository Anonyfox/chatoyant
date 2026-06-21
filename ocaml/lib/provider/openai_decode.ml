let field = Chatoyant_runtime.Json.field

let chat_content json =
  match field "choices" json with
  | Some (Chatoyant_runtime.Json.Array (choice :: _)) -> (
      match field "message" choice with
      | Some message -> Option.bind (field "content" message) Chatoyant_runtime.Json.as_string
      | None -> None)
  | _ -> None

let chat_usage json =
  match field "usage" json with
  | None -> Chatoyant_tokens.Cost.empty_usage
  | Some usage -> Usage.openai_compatible usage

let output_item_text item =
  match field "content" item with
  | Some (Chatoyant_runtime.Json.Array blocks) ->
      blocks
      |> List.filter_map (fun block ->
             match field "text" block with
             | Some value -> Chatoyant_runtime.Json.as_string value
             | None -> None)
      |> String.concat ""
  | _ -> ""

let responses_output_text json =
  match field "output_text" json with
  | Some (Chatoyant_runtime.Json.String text) -> text
  | _ -> (
      match field "output" json with
      | Some (Chatoyant_runtime.Json.Array items) ->
          items |> List.map output_item_text |> String.concat ""
      | _ -> "")

let responses_usage json =
  match field "usage" json with
  | None -> Chatoyant_tokens.Cost.empty_usage
  | Some usage ->
      let input_tokens =
        match field "input_tokens" usage with
        | Some value -> Option.value (Chatoyant_runtime.Json.as_int value) ~default:0
        | None -> 0
      in
      let output_tokens =
        match field "output_tokens" usage with
        | Some value -> Option.value (Chatoyant_runtime.Json.as_int value) ~default:0
        | None -> 0
      in
      {
        Chatoyant_tokens.Cost.empty_usage with
        input_tokens;
        output_tokens;
        total_tokens = input_tokens + output_tokens;
      }

let generation_of_chat_json json =
  {
    Provider.content = Option.value (chat_content json) ~default:"";
    reasoning_content = "";
    usage = chat_usage json;
    usage_source = Chatoyant_tokens.Cost.Provider_reported;
    tool_calls = [];
    finish_reason = None;
    raw = Some json;
  }

let generation_of_responses_json json =
  {
    Provider.content = responses_output_text json;
    reasoning_content = "";
    usage = responses_usage json;
    usage_source = Chatoyant_tokens.Cost.Provider_reported;
    tool_calls = [];
    finish_reason = None;
    raw = Some json;
  }
