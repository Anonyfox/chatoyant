type role =
  | System
  | User
  | Assistant
  | Tool

type tool_call = {
  id : string;
  name : string;
  arguments_json : string;
}

type t = {
  role : role;
  content : string;
  name : string option;
  tool_call_id : string option;
  tool_result_error : bool option;
  tool_calls : tool_call list;
  metadata : (string * Chatoyant_runtime.Json.t) list;
}

let make ?name ?tool_call_id ?tool_result_error ?(tool_calls = []) ?(metadata = []) role content =
  { role; content; name; tool_call_id; tool_result_error; tool_calls; metadata }

let system content = make System content
let user content = make User content
let assistant content = make Assistant content
let assistant_with_tool_calls ?(content = "") calls =
  let tool_calls =
    List.map
      (fun (call : Chatoyant_provider.Provider.tool_call) ->
        { id = call.id; name = call.name; arguments_json = call.arguments_json })
      calls
  in
  make ~tool_calls Assistant content

let tool ?is_error ~tool_call_id content = make ?tool_result_error:is_error ~tool_call_id Tool content
let has_tool_calls message = message.tool_calls <> []

let role_to_string = function
  | System -> "system"
  | User -> "user"
  | Assistant -> "assistant"
  | Tool -> "tool"

let role_of_string = function
  | "system" -> Some System
  | "user" -> Some User
  | "assistant" -> Some Assistant
  | "tool" -> Some Tool
  | _ -> None

let to_provider_role = function
  | System -> Chatoyant_provider.Provider.System
  | User -> Chatoyant_provider.Provider.User
  | Assistant -> Chatoyant_provider.Provider.Assistant
  | Tool -> Chatoyant_provider.Provider.Tool

let to_provider_message message =
  let tool_calls =
    List.map
      (fun (call : tool_call) ->
        let arguments =
          match Chatoyant_runtime.Json.parse call.arguments_json with
          | Ok json -> json
          | Error _ -> Chatoyant_runtime.Json.Null
        in
        {
          Chatoyant_provider.Provider.id = call.id;
          name = call.name;
          arguments;
          arguments_json = call.arguments_json;
          raw = None;
        })
      message.tool_calls
  in
  {
    Chatoyant_provider.Provider.role = to_provider_role message.role;
    content = Some message.content;
    name = message.name;
    tool_call_id = message.tool_call_id;
    tool_calls;
    tool_result_error = message.tool_result_error;
  }

let string value = Chatoyant_runtime.Json.String value

let add_opt name value fields =
  match value with
  | None -> fields
  | Some value -> (name, value) :: fields

let tool_call_to_json call =
  Chatoyant_runtime.Json.Object
    [
      ("id", string call.id);
      ("name", string call.name);
      ("arguments_json", string call.arguments_json);
    ]

let metadata_to_json metadata =
  Chatoyant_runtime.Json.Object metadata

let to_json message =
  [
    ("role", string (role_to_string message.role));
    ("content", string message.content);
    ("tool_calls", Chatoyant_runtime.Json.Array (List.map tool_call_to_json message.tool_calls));
    ("metadata", metadata_to_json message.metadata);
  ]
  |> add_opt "name" (Option.map string message.name)
  |> add_opt "tool_call_id" (Option.map string message.tool_call_id)
  |> add_opt "tool_result_error" (Option.map (fun value -> Chatoyant_runtime.Json.Bool value) message.tool_result_error)
  |> List.rev |> fun fields -> Chatoyant_runtime.Json.Object fields

let field = Chatoyant_runtime.Json.field
let string_field name json = Option.bind (field name json) Chatoyant_runtime.Json.as_string

let tool_call_of_json json =
  match (string_field "id" json, string_field "name" json, string_field "arguments_json" json) with
  | Some id, Some name, Some arguments_json -> Ok { id; name; arguments_json }
  | _ -> Error "invalid message tool call JSON"

let metadata_of_json json =
  match field "metadata" json with
  | Some (Chatoyant_runtime.Json.Object fields) -> fields
  | _ -> []

let of_json json =
  match Option.bind (string_field "role" json) role_of_string with
  | None -> Error "invalid message role"
  | Some role ->
      let content = Option.value (string_field "content" json) ~default:"" in
      let tool_calls =
        match field "tool_calls" json with
        | Some (Chatoyant_runtime.Json.Array values) ->
            let rec loop acc = function
              | [] -> Ok (List.rev acc)
              | value :: rest -> (
                  match tool_call_of_json value with
                  | Ok call -> loop (call :: acc) rest
                  | Error _ as err -> err)
            in
            loop [] values
        | _ -> Ok []
      in
      (match tool_calls with
      | Error _ as err -> err
      | Ok tool_calls ->
          Ok
            {
              role;
              content;
              name = string_field "name" json;
              tool_call_id = string_field "tool_call_id" json;
              tool_result_error =
                Option.bind (field "tool_result_error" json) Chatoyant_runtime.Json.as_bool;
              tool_calls;
              metadata = metadata_of_json json;
            })
