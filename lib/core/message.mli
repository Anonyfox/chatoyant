(** Provider-neutral chat messages. *)

type role = System | User | Assistant | Tool
type tool_call = { id : string; name : string; arguments_json : string }

type attachment = Chatoyant_provider.Provider.attachment
(** Provider-neutral image/file attachment; see
    {!Chatoyant_provider.Provider.attachment}. File-id sources keep follow-up
    turns cheap: history re-sends only the id, never the bytes. *)

type t = {
  role : role;
  content : string;
  name : string option;
  tool_call_id : string option;
  tool_result_error : bool option;
  tool_calls : tool_call list;
  metadata : (string * Chatoyant_runtime.Json.t) list;
  attachments : attachment list;
}

val make :
  ?name:string ->
  ?tool_call_id:string ->
  ?tool_result_error:bool ->
  ?tool_calls:tool_call list ->
  ?metadata:(string * Chatoyant_runtime.Json.t) list ->
  ?attachments:attachment list ->
  role ->
  string ->
  t

val system : string -> t
val user : ?attachments:attachment list -> string -> t
val assistant : string -> t

val assistant_with_tool_calls :
  ?content:string -> Chatoyant_provider.Provider.tool_call list -> t

val tool : ?is_error:bool -> tool_call_id:string -> string -> t
val has_tool_calls : t -> bool
val to_provider_message : t -> Chatoyant_provider.Provider.message
val role_to_string : role -> string
val role_of_string : string -> role option
val tool_call_to_json : tool_call -> Chatoyant_runtime.Json.t
val to_json : t -> Chatoyant_runtime.Json.t
val tool_call_of_json : Chatoyant_runtime.Json.t -> (tool_call, string) result
val of_json : Chatoyant_runtime.Json.t -> (t, string) result
