(** Raw Anthropic Messages API request shapes. *)

type role = User | Assistant
type cache_ttl = Ttl_5m | Ttl_1h | Cache_ttl of string

type cache_control =
  | Ephemeral_cache of cache_ttl option
  | Raw_cache_control of Chatoyant_runtime.Json.t
      (** Prompt caching marker. Anthropic accepts [cache_control] at the
          request top level, on cacheable content blocks, and on tool
          definitions. *)

type content_block =
  | Text of string
  | Cached_block of { block : content_block; cache_control : cache_control }
  | Thinking of string
  | Redacted_thinking of string
  | Tool_use of { id : string; name : string; input : Chatoyant_runtime.Json.t }
  | Tool_result of {
      tool_use_id : string;
      content : string;
      is_error : bool option;
    }
  | Server_tool_use of {
      id : string;
      name : string;
      input : Chatoyant_runtime.Json.t;
      raw : Chatoyant_runtime.Json.t;
    }
  | Web_search_tool_result of {
      tool_use_id : string;
      content : Chatoyant_runtime.Json.t;
      raw : Chatoyant_runtime.Json.t;
    }
  | Web_fetch_tool_result of {
      tool_use_id : string;
      content : Chatoyant_runtime.Json.t;
      raw : Chatoyant_runtime.Json.t;
    }
  | Code_execution_tool_result of {
      tool_use_id : string;
      content : Chatoyant_runtime.Json.t;
      raw : Chatoyant_runtime.Json.t;
    }
  | Container_upload of {
      file_id : string option;
      raw : Chatoyant_runtime.Json.t;
    }
  | Raw_block of Chatoyant_runtime.Json.t

type message = { message_role : role; message_content : content_block list }

type tool = {
  tool_name : string;
  tool_description : string option;
  input_schema : Chatoyant_runtime.Json.t;
  tool_cache_control : cache_control option;
}

type tool_choice = Auto | Any | Tool of string | No_tool
type thinking = Disabled | Enabled of { budget_tokens : int }

type request = {
  model : string;
  messages : message list;
  system : string option;
  system_blocks : content_block list;
  max_tokens : int;
  stream : bool;
  temperature : float option;
  top_p : float option;
  top_k : int option;
  stop_sequences : string list;
  metadata_user_id : string option;
  tools : tool list;
  tool_choice : tool_choice option;
  thinking : thinking option;
  cache_control : cache_control option;
  extra : (string * Chatoyant_runtime.Json.t) list;
}

type stop_reason =
  | End_turn
  | Max_tokens
  | Stop_sequence
  | Tool_use_stop
  | Pause_turn
  | Refusal
  | Unknown_stop of string

type usage = Chatoyant_tokens.Cost.usage

type response = {
  response_id : string option;
  response_model : string option;
  response_role : role option;
  response_content : content_block list;
  response_stop_reason : stop_reason option;
  response_stop_sequence : string option;
  response_usage : usage;
  response_raw : Chatoyant_runtime.Json.t;
}

type api_error = {
  error_type : string option;
  error_message : string;
  error_raw : Chatoyant_runtime.Json.t option;
}

type model = {
  model_id : string;
  model_display_name : string option;
  model_created_at : string option;
  model_type : string option;
  model_raw : Chatoyant_runtime.Json.t;
}

type model_list = {
  models : model list;
  first_id : string option;
  last_id : string option;
  has_more : bool;
  raw : Chatoyant_runtime.Json.t;
}

type batch_request = { custom_id : string; params : request }

type batch_counts = {
  processing : int;
  succeeded : int;
  errored : int;
  canceled : int;
  expired : int;
}

type batch_status =
  | In_progress
  | Canceling
  | Ended
  | Unknown_batch_status of string

type message_batch = {
  batch_id : string;
  batch_type : string option;
  processing_status : batch_status;
  request_counts : batch_counts;
  ended_at : string option;
  created_at : string option;
  expires_at : string option;
  archived_at : string option;
  cancel_initiated_at : string option;
  results_url : string option;
  raw : Chatoyant_runtime.Json.t;
}

type batch_list = {
  batches : message_batch list;
  first_id : string option;
  last_id : string option;
  has_more : bool;
  raw : Chatoyant_runtime.Json.t;
}

type batch_result =
  | Batch_succeeded of response
  | Batch_errored of api_error
  | Batch_canceled
  | Batch_expired
  | Batch_unknown of Chatoyant_runtime.Json.t

type batch_result_line = {
  result_custom_id : string;
  result : batch_result;
  result_raw : Chatoyant_runtime.Json.t;
}

type file_upload = {
  upload_filename : string;
  upload_content_type : string option;
  upload_body : string;
}

type file_metadata = {
  file_id : string;
  file_type : string option;
  filename : string option;
  mime_type : string option;
  size_bytes : int option;
  created_at : string option;
  downloadable : bool option;
  file_raw : Chatoyant_runtime.Json.t;
}

type file_list = {
  files : file_metadata list;
  first_id : string option;
  last_id : string option;
  has_more : bool;
  raw : Chatoyant_runtime.Json.t;
}

type file_delete = {
  deleted_file_id : string option;
  deleted : bool;
  raw : Chatoyant_runtime.Json.t;
}

type stream_delta =
  | Text_delta of string
  | Thinking_delta of string
  | Signature_delta of string
  | Input_json_delta of string
  | Unknown_delta of Chatoyant_runtime.Json.t

type stream_event =
  | Message_start of response
  | Content_block_start of { index : int; block : content_block }
  | Content_block_delta of { index : int; delta : stream_delta }
  | Content_block_stop of int
  | Message_delta of {
      stop_reason : stop_reason option;
      stop_sequence : string option;
      usage : usage;
    }
  | Message_stop
  | Ping
  | Error of api_error
  | Unknown_event of {
      event_type : string option;
      raw : Chatoyant_runtime.Json.t;
    }

type stream_state

val empty_stream_state : stream_state
val apply_stream_event : stream_state -> stream_event -> stream_state
val stream_state_to_response : stream_state -> response
val role_to_string : role -> string
val cache_ttl_to_string : cache_ttl -> string
val cache_control_json : cache_control -> Chatoyant_runtime.Json.t
val ephemeral_cache_control : ?ttl:cache_ttl -> unit -> cache_control
val content_block_json : content_block -> Chatoyant_runtime.Json.t
val tool_json : tool -> Chatoyant_runtime.Json.t

val web_search_tool_json :
  ?name:string ->
  ?cache_control:cache_control ->
  ?max_uses:int ->
  ?allowed_domains:string list ->
  ?blocked_domains:string list ->
  ?user_location:Chatoyant_runtime.Json.t ->
  unit ->
  Chatoyant_runtime.Json.t

val web_fetch_tool_json :
  ?name:string ->
  ?cache_control:cache_control ->
  unit ->
  Chatoyant_runtime.Json.t

val code_execution_tool_json :
  ?name:string ->
  ?cache_control:cache_control ->
  unit ->
  Chatoyant_runtime.Json.t

val request_json_with_raw_tools :
  request -> Chatoyant_runtime.Json.t list -> Chatoyant_runtime.Json.t

val request_json : request -> Chatoyant_runtime.Json.t
val authorization_headers : api_key:string -> (string * string) list
val content_block_of_json : Chatoyant_runtime.Json.t -> content_block
val response_of_json : Chatoyant_runtime.Json.t -> response
val api_error_of_json : Chatoyant_runtime.Json.t -> api_error
val model_of_json : Chatoyant_runtime.Json.t -> model
val model_list_of_json : Chatoyant_runtime.Json.t -> model_list
val batch_create_json : batch_request list -> Chatoyant_runtime.Json.t
val message_batch_of_json : Chatoyant_runtime.Json.t -> message_batch
val batch_list_of_json : Chatoyant_runtime.Json.t -> batch_list
val batch_result_line_of_json : Chatoyant_runtime.Json.t -> batch_result_line

val batch_result_lines_of_jsonl :
  string -> (batch_result_line list, string) result

val file_metadata_of_json : Chatoyant_runtime.Json.t -> file_metadata
val file_list_of_json : Chatoyant_runtime.Json.t -> file_list
val file_delete_of_json : Chatoyant_runtime.Json.t -> file_delete

val stream_event_of_sse :
  Chatoyant_runtime.Sse.event -> (stream_event, string) result

val stream_events_of_chunks : string list -> (stream_event list, string) result
val response_of_stream_chunks : string list -> (response, string) result
val text_of_response : response -> string
val generation_of_response : response -> Provider.generation

module Make_client (Http : Chatoyant_runtime.Effect.HTTP) : sig
  type config = {
    api_key : string;
    base_url : string;
    timeout_ms : int option;
    beta_headers : string list;
  }

  type admin_config = {
    admin_api_key : string;
    admin_base_url : string;
    admin_timeout_ms : int option;
  }

  val default_base_url : string
  val create_message : config -> request -> (response, api_error) result

  val create_message_with_raw_tools :
    config ->
    raw_tools:Chatoyant_runtime.Json.t list ->
    request ->
    (response, api_error) result

  val list_models : config -> (model_list, api_error) result
  val retrieve_model : config -> model_id:string -> (model, api_error) result

  val create_message_batch :
    config -> batch_request list -> (message_batch, api_error) result

  val list_message_batches : config -> (batch_list, api_error) result

  val retrieve_message_batch :
    config -> batch_id:string -> (message_batch, api_error) result

  val cancel_message_batch :
    config -> batch_id:string -> (message_batch, api_error) result

  val message_batch_results :
    config -> batch_id:string -> (batch_result_line list, api_error) result

  val upload_file : config -> file_upload -> (file_metadata, api_error) result
  val list_files : config -> (file_list, api_error) result

  val retrieve_file :
    config -> file_id:string -> (file_metadata, api_error) result

  val delete_file : config -> file_id:string -> (file_delete, api_error) result
  val download_file : config -> file_id:string -> (string, api_error) result

  val admin_get_json :
    admin_config -> path:string -> (Chatoyant_runtime.Json.t, api_error) result

  val get_usage_report_messages :
    admin_config ->
    ?starting_at:string ->
    ?ending_at:string ->
    ?bucket_width:string ->
    ?group_by:string list ->
    unit ->
    (Chatoyant_runtime.Json.t, api_error) result

  val get_cost_report :
    admin_config ->
    ?starting_at:string ->
    ?ending_at:string ->
    ?bucket_width:string ->
    ?group_by:string list ->
    unit ->
    (Chatoyant_runtime.Json.t, api_error) result
end

module Make_provider
    (Http : Chatoyant_runtime.Effect.HTTP)
    (Config : sig
      val api_key : string
      val base_url : string
      val timeout_ms : int option
      val beta_headers : string list
    end) : Provider.CHAT
