let version = "0.0.0-port"

module Chatoyant_js_base = struct
  module Runtime = Chatoyant_runtime
  module Tokens = Chatoyant_tokens
  module Schema = Chatoyant_schema
  module Provider = Chatoyant_provider
  module Core = Chatoyant_core
end

module Js_fake_provider : Chatoyant_js_base.Provider.Provider.CHAT = struct
  let id = Chatoyant_js_base.Provider.Provider.Openai

  let generate messages _options =
    if messages = [] then Error (Chatoyant_js_base.Provider.Provider.Runtime_error "missing messages")
    else
      Ok
        {
          Chatoyant_js_base.Provider.Provider.content = "fake js";
          reasoning_content = "";
          usage =
            {
              Chatoyant_js_base.Tokens.Cost.empty_usage with
              input_tokens = 10;
              output_tokens = 5;
              total_tokens = 15;
            };
          usage_source = Chatoyant_js_base.Tokens.Cost.Provider_reported;
          tool_calls = [];
          finish_reason = Some "stop";
          raw = None;
        }
end

module Js_clock = struct
  let value = ref 1_000

  let now_ms () =
    let current = !value in
    value := current + 50;
    current
end

module Js_session = Chatoyant_js_base.Core.Session.Make (Js_fake_provider) (Js_clock)
module Js_shortcuts = Chatoyant_js_base.Core.Shortcuts.Make (Js_fake_provider) (Js_clock)

type js_value
type js_chat_class
type js_function

let default_timeout = 120_000 [@@mel.as "DEFAULT_TIMEOUT"]
let default_retries = 3 [@@mel.as "DEFAULT_RETRIES"]
let default_tool_timeout = 10_000 [@@mel.as "DEFAULT_TOOL_TIMEOUT"]
let default_max_tool_iterations = 8 [@@mel.as "DEFAULT_MAX_TOOL_ITERATIONS"]

let json_field = Chatoyant_js_base.Runtime.Json.field

let json_string_field name json =
  Option.bind (json_field name json) Chatoyant_js_base.Runtime.Json.as_string

let json_float_field name json =
  Option.bind (json_field name json) Chatoyant_js_base.Runtime.Json.as_float

let json_int_field name json =
  Option.bind (json_field name json) Chatoyant_js_base.Runtime.Json.as_int

let parse_json_or_object text =
  match Chatoyant_js_base.Runtime.Json.parse text with
  | Ok json -> json
  | Error _ -> Chatoyant_js_base.Runtime.Json.Object []

let options_of_json_text text =
  let json = parse_json_or_object text in
  {
    Chatoyant_js_base.Core.Options.default with
    model = json_string_field "model" json;
    temperature = json_float_field "temperature" json;
    max_tokens =
      (match json_int_field "maxTokens" json with
      | Some _ as value -> value
      | None -> json_int_field "max_tokens" json);
    timeout_ms =
      (match json_int_field "timeout" json with
      | Some _ as value -> value
      | None -> json_int_field "timeout_ms" json);
    extra = json_field "extra" json;
  }

let provider_error_to_string = function
  | Chatoyant_js_base.Provider.Provider.Missing_api_key { provider; env_key } ->
      "missing API key for "
      ^ Chatoyant_js_base.Provider.Provider.string_of_id provider
      ^ " (" ^ env_key ^ ")"
  | Http_error { status; body } ->
      "HTTP " ^ string_of_int status ^ ": " ^ body
  | Decode_error message -> "decode error: " ^ message
  | Unsupported message -> "unsupported: " ^ message
  | Runtime_error message -> message

let json_string value = Chatoyant_js_base.Runtime.Json.String value

let json_object_to_string fields =
  Chatoyant_js_base.Runtime.Json.Object fields |> Chatoyant_js_base.Runtime.Json.to_string

let ok_state state =
  json_object_to_string
    [
      ("ok", Chatoyant_js_base.Runtime.Json.Bool true);
      ("state", Chatoyant_js_base.Runtime.Json.to_string state |> json_string);
    ]

let ok_generation state result =
  json_object_to_string
    [
      ("ok", Chatoyant_js_base.Runtime.Json.Bool true);
      ("state", Chatoyant_js_base.Runtime.Json.to_string (Js_session.to_json state) |> json_string);
      ("text", json_string result.Chatoyant_js_base.Core.Result.content);
      ("result", Chatoyant_js_base.Core.Result.generation_to_json result);
    ]

let error_response message =
  json_object_to_string
    [ ("ok", Chatoyant_js_base.Runtime.Json.Bool false); ("error", json_string message) ]

let json_schema_error_result keyword message =
  Chatoyant_js_base.Runtime.Json.Object
    [
      ("valid", Chatoyant_js_base.Runtime.Json.Bool false);
      ( "errors",
        Chatoyant_js_base.Runtime.Json.Array
          [
            Chatoyant_js_base.Runtime.Json.Object
              [
                ("instancePath", Chatoyant_js_base.Runtime.Json.String "");
                ("schemaPath", Chatoyant_js_base.Runtime.Json.String "");
                ("keyword", Chatoyant_js_base.Runtime.Json.String keyword);
                ("message", Chatoyant_js_base.Runtime.Json.String message);
              ];
          ] );
    ]
  |> Chatoyant_js_base.Runtime.Json.to_string

let json_schema_options_of_text text =
  let json = parse_json_or_object text in
  let resources =
    match json_field "resources" json with
    | Some (Chatoyant_js_base.Runtime.Json.Array resources) ->
        resources
        |> List.filter_map (function
             | Chatoyant_js_base.Runtime.Json.Object fields -> (
                 match
                   ( Option.bind
                       (List.assoc_opt "uri" fields)
                       Chatoyant_js_base.Runtime.Json.as_string,
                     List.assoc_opt "schema" fields )
                 with
                 | Some uri, Some schema ->
                     Some Chatoyant_js_base.Schema.Json_schema.Resolver.{ uri; schema }
                 | _ -> None)
             | _ -> None)
    | _ -> []
  in
  {
    Chatoyant_js_base.Schema.Json_schema.Validator.format_assertion =
      (match json_field "formatAssertion" json with
      | Some (Chatoyant_js_base.Runtime.Json.Bool value) -> value
      | _ -> false);
    resources;
  }

let json_schema_validate schema_text data_text options_text =
  match (Chatoyant_js_base.Runtime.Json.parse schema_text, Chatoyant_js_base.Runtime.Json.parse data_text) with
  | Error message, _ -> json_schema_error_result "schema" message
  | _, Error message -> json_schema_error_result "data" message
  | Ok schema, Ok data -> (
      let options = json_schema_options_of_text options_text in
      match Chatoyant_js_base.Schema.Json_schema.validate_json ~options schema data with
      | Error error -> json_schema_error_result "schema" error.message
      | Ok result -> Chatoyant_js_base.Schema.Json_schema.Output.to_json result |> Chatoyant_js_base.Runtime.Json.to_string)

let json_schema_project_openai_strict schema_text =
  match Chatoyant_js_base.Runtime.Json.parse schema_text with
  | Error message -> json_schema_error_result "schema" message
  | Ok json -> (
      match Chatoyant_js_base.Schema.Json_schema.of_json json with
      | Error error -> json_schema_error_result "schema" error.message
      | Ok schema ->
          let projected = Chatoyant_js_base.Schema.Json_schema.Project.openai_strict schema in
          projected.schema |> Chatoyant_js_base.Schema.Json_schema.to_json |> Chatoyant_js_base.Runtime.Json.to_string)

let session_of_state state_json =
  match Chatoyant_js_base.Runtime.Json.parse state_json with
  | Error message -> Error message
  | Ok json -> Js_session.of_json json

let js_chat_create_state config_json =
  let config = parse_json_or_object config_json in
  let model = Option.value (json_string_field "model" config) ~default:"gpt-4o" in
  Js_session.create ~model () |> Js_session.to_json |> Chatoyant_js_base.Runtime.Json.to_string

let js_chat_model state_json =
  match session_of_state state_json with
  | Error _ -> "gpt-4o"
  | Ok session -> Js_session.model session

let js_chat_set_model state_json model =
  match session_of_state state_json with
  | Error message -> error_response message
  | Ok session ->
      ignore (Js_session.set_model model session);
      ok_state (Js_session.to_json session)

let js_chat_add_message state_json role content =
  match session_of_state state_json with
  | Error message -> error_response message
  | Ok session ->
      let session =
        match role with
        | "system" -> Js_session.system content session
        | "assistant" -> Js_session.assistant content session
        | "user" | _ -> Js_session.user content session
      in
      ok_state (Js_session.to_json session)

let js_chat_clear_messages state_json =
  match session_of_state state_json with
  | Error message -> error_response message
  | Ok session ->
      ignore (Js_session.clear_messages session);
      ok_state (Js_session.to_json session)

let js_chat_messages_json state_json =
  match Chatoyant_js_base.Runtime.Json.parse state_json with
  | Ok json -> (
      match json_field "messages" json with
      | Some messages -> Chatoyant_js_base.Runtime.Json.to_string messages
      | None -> "[]")
  | Error _ -> "[]"

let js_chat_last_result_json state_json =
  match Chatoyant_js_base.Runtime.Json.parse state_json with
  | Ok json -> (
      match json_field "lastResult" json with
      | Some result -> Chatoyant_js_base.Runtime.Json.to_string result
      | None -> "null")
  | Error _ -> "null"

let js_chat_generate state_json options_json =
  match session_of_state state_json with
  | Error message -> error_response message
  | Ok session -> (
      let options = options_of_json_text options_json in
      match Js_session.generate_with_result ~options session with
      | Error error -> error_response (provider_error_to_string error)
      | Ok result -> ok_generation session result)

let js_chat_roundtrip_state state_json =
  match session_of_state state_json with
  | Error message -> error_response message
  | Ok session -> ok_state (Js_session.to_json session)

let message : js_function =
  [%mel.raw
    {|
class Message {
  constructor(role, content, options = {}) {
    if (!["system", "user", "assistant", "tool"].includes(role)) {
      throw new TypeError("Invalid role: must be 'system' | 'user' | 'assistant' | 'tool'");
    }
    if (typeof content !== "string") {
      throw new TypeError("Invalid content: must be a string");
    }
    this.role = role;
    this.content = content;
    this.name = options.name;
    this.toolCallId = options.toolCallId ?? options.tool_call_id;
    this.toolCalls = options.toolCalls ?? options.tool_calls;
    this.metadata = options.metadata;
  }

  toJSON() {
    const json = { role: this.role, content: this.content };
    if (this.name !== undefined) json.name = this.name;
    if (this.toolCallId !== undefined) json.toolCallId = this.toolCallId;
    if (this.toolCalls !== undefined) json.toolCalls = this.toolCalls;
    if (this.metadata !== undefined) json.metadata = this.metadata;
    return json;
  }

  static fromJSON(json) {
    if (!json || typeof json !== "object") {
      throw new TypeError("Invalid message JSON: must be an object");
    }
    return new Message(json.role, json.content, json);
  }

  static system(content, metadata) { return new Message("system", content, { metadata }); }
  static user(content, metadata) { return new Message("user", content, { metadata }); }
  static assistant(content, metadata) { return new Message("assistant", content, { metadata }); }
  static assistantToolCall(toolCalls, metadata) {
    return new Message("assistant", "", { toolCalls, metadata });
  }
  static tool(content, toolCallId, metadata) {
    return new Message("tool", content, { toolCallId, metadata });
  }

  withContent(content) {
    return new Message(this.role, content, this.toJSON());
  }

  withMetadata(metadata) {
    return new Message(this.role, this.content, {
      ...this.toJSON(),
      metadata: { ...(this.metadata || {}), ...(metadata || {}) },
    });
  }

  isSystem() { return this.role === "system"; }
  isUser() { return this.role === "user"; }
  isAssistant() { return this.role === "assistant"; }
  isTool() { return this.role === "tool"; }
}
|}]
  [@@mel.as "Message"]

let json_schema_class : js_function =
  [%mel.raw
    {|
class JsonSchema {
  constructor(schema = true) {
    this.schema = Schema.toJSON(schema);
  }

  static parse(schema) {
    return new JsonSchema(schema);
  }

  static fromJSON(json) {
    return new JsonSchema(json);
  }

  static validate(schema, data, options = {}) {
    return JSON.parse(json_schema_validate(JSON.stringify(Schema.toJSON(schema)), JSON.stringify(data), JSON.stringify(options || {})));
  }

  static projectOpenAIStrict(schema) {
    return new JsonSchema(JSON.parse(json_schema_project_openai_strict(JSON.stringify(Schema.toJSON(schema)))));
  }

  validate(data, options = {}) {
    return JsonSchema.validate(this.schema, data, options).valid;
  }

  validateDetailed(data, options = {}) {
    return JsonSchema.validate(this.schema, data, options);
  }

  toJSON() {
    return this.schema;
  }

  stringify() {
    return JSON.stringify(this.schema);
  }
}
|}]
  [@@mel.as "JsonSchema"]

let schema_class : js_function =
  [%mel.raw
    {|
class Schema {
  constructor(fields) {
    if (fields && typeof fields === "object") Object.assign(this, fields);
  }

  toJSON() {
    return Schema.toJSON(this);
  }

  getParametersSchema() {
    return this.toJSON();
  }

  stringify() {
    return JSON.stringify(this.toJSON());
  }

  validate(data) {
    return Schema.validate(this, data);
  }

  parse(data) {
    return Schema.parse(this, data);
  }

  static create(schemaLike) {
    if (typeof schemaLike === "function") return new schemaLike();
    if (schemaLike instanceof Schema) return schemaLike;
    return new Schema(schemaLike || {});
  }

  static parse(schemaLike, data, options = {}) {
    const detailed = Schema.validateDetailed(schemaLike, data, options);
    if (!detailed.valid) {
      const first = detailed.errors?.[0];
      throw new TypeError(first?.message || "JSON value does not match schema");
    }
    return data;
  }

  static validate(schemaLike, data, options = {}) {
    return Schema.validateDetailed(schemaLike, data, options).valid;
  }

  static validateDetailed(schemaLike, data, options = {}) {
    return JsonSchema.validate(Schema.toJSON(schemaLike), data, options);
  }

  static stringify(schemaLike) {
    return JSON.stringify(Schema.toJSON(schemaLike));
  }

  static clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  static toObject(value) {
    if (value instanceof Schema) {
      const out = {};
      for (const [key, field] of Object.entries(value)) {
        if (typeof field !== "function") out[key] = field;
      }
      return out;
    }
    return JSON.parse(JSON.stringify(value));
  }

  static toJSON(schemaLike) {
    if (schemaLike instanceof JsonSchema) return schemaLike.toJSON();
    if (typeof schemaLike === "function") return Schema.toJSON(new schemaLike());
    if (schemaLike instanceof Schema) return Schema._schemaFromInstance(schemaLike);
    if (Schema._isField(schemaLike)) return Schema._fieldSchema(schemaLike);
    if (schemaLike && typeof schemaLike.toJSON === "function") return schemaLike.toJSON();
    if (schemaLike && typeof schemaLike === "object") {
      if (Object.keys(schemaLike).length === 0) return {};
      if (Schema._looksLikeJsonSchema(schemaLike)) return schemaLike;
      return Schema._schemaFromShape(schemaLike);
    }
    if (schemaLike === true || schemaLike === false) return schemaLike;
    return {};
  }

  static _schemaFromInstance(instance) {
    const fields = {};
    for (const [key, value] of Object.entries(instance)) {
      if (!key.startsWith("_") && typeof value !== "function") fields[key] = value;
    }
    return Schema._schemaFromShape(fields);
  }

  static _schemaFromShape(shape) {
    const properties = {};
    const required = [];
    for (const [key, value] of Object.entries(shape || {})) {
      const isField = Schema._isField(value);
      properties[key] = Schema._fieldSchema(value);
      if (!isField || !value.optional) required.push(key);
    }
    return { type: "object", properties, required, additionalProperties: false };
  }

  static _looksLikeJsonSchema(value) {
    return Boolean(value && typeof value === "object" && (
      "$ref" in value || "$defs" in value || "$schema" in value || "type" in value ||
      "properties" in value || "items" in value || "prefixItems" in value ||
      "anyOf" in value || "oneOf" in value || "allOf" in value || "enum" in value ||
      "const" in value || "not" in value || "if" in value || "then" in value ||
      "else" in value || "required" in value || "additionalProperties" in value ||
      "unevaluatedProperties" in value || "unevaluatedItems" in value ||
      "patternProperties" in value || "propertyNames" in value ||
      "dependentRequired" in value || "dependentSchemas" in value ||
      "contains" in value || "minContains" in value || "maxContains" in value ||
      "minItems" in value || "maxItems" in value || "uniqueItems" in value ||
      "minLength" in value || "maxLength" in value || "pattern" in value ||
      "format" in value || "minimum" in value || "maximum" in value ||
      "exclusiveMinimum" in value || "exclusiveMaximum" in value ||
      "multipleOf" in value || value === true || value === false
    ));
  }

  static _isField(value) {
    return Boolean(value && typeof value === "object" && value.__chatoyantSchemaField === true);
  }

  static _fieldSchema(value) {
    if (Schema._isField(value)) {
      const schema = Schema.clone(value.schema);
      return value.optional ? { anyOf: [schema, { type: "null" }] } : schema;
    }
    return Schema.toJSON(value);
  }

  static _field(schema, options = {}) {
    const out = { ...schema };
    if (options.description !== undefined) out.description = options.description;
    if (options.default !== undefined) out.default = options.default;
    if (options.minLength !== undefined) out.minLength = options.minLength;
    if (options.maxLength !== undefined) out.maxLength = options.maxLength;
    if (options.pattern !== undefined) out.pattern = options.pattern;
    if (options.format !== undefined) out.format = options.format;
    if (options.minimum !== undefined) out.minimum = options.minimum;
    if (options.maximum !== undefined) out.maximum = options.maximum;
    if (options.exclusiveMinimum !== undefined) out.exclusiveMinimum = options.exclusiveMinimum;
    if (options.exclusiveMaximum !== undefined) out.exclusiveMaximum = options.exclusiveMaximum;
    if (options.multipleOf !== undefined) out.multipleOf = options.multipleOf;
    if (options.minItems !== undefined) out.minItems = options.minItems;
    if (options.maxItems !== undefined) out.maxItems = options.maxItems;
    if (options.uniqueItems !== undefined) out.uniqueItems = options.uniqueItems;
    return { __chatoyantSchemaField: true, optional: Boolean(options.optional), schema: out, options };
  }

  static String(options = {}) { return Schema._field({ type: "string" }, options); }
  static Number(options = {}) { return Schema._field({ type: "number" }, options); }
  static Integer(options = {}) { return Schema._field({ type: "integer" }, options); }
  static Boolean(options = {}) { return Schema._field({ type: "boolean" }, options); }
  static Null(options = {}) { return Schema._field({ type: "null" }, options); }
  static Literal(value, options = {}) { return Schema._field({ const: value }, options); }
  static Enum(values, options = {}) { return Schema._field({ enum: Array.from(values || []) }, options); }
  static Array(items, options = {}) {
    return Schema._field({ type: "array", items: Schema._fieldSchema(items) }, options);
  }
  static Object(shape, options = {}) {
    return Schema._field(Schema.toJSON(typeof shape === "function" ? new shape() : shape), options);
  }
}
|}]
  [@@mel.as "Schema"]

let tool : js_function =
  [%mel.raw
    {|
class Tool {
  constructor(definition) {
    if (!definition || typeof definition !== "object") {
      throw new TypeError("Tool definition is required");
    }
    if (!definition.name || typeof definition.name !== "string") {
      throw new TypeError("Tool name is required and must be a string");
    }
    if (!definition.description || typeof definition.description !== "string") {
      throw new TypeError("Tool description is required and must be a string");
    }
    if (!definition.parameters) {
      throw new TypeError("Tool parameters schema is required");
    }
    if (typeof definition.execute !== "function") {
      throw new TypeError("Tool execute function is required");
    }
    this.name = definition.name;
    this.description = definition.description;
    this.parameters = definition.parameters;
    this.resultSchema = definition.resultSchema;
    this.timeout = definition.timeout ?? DEFAULT_TOOL_TIMEOUT;
    this._execute = definition.execute;
  }

  getParametersSchema() {
    if (this.parameters !== undefined) return Schema.toJSON(this.parameters);
    if (this.parameters && typeof this.parameters.toJSON === "function") return this.parameters.toJSON();
    if (this.parameters && typeof this.parameters.getParametersSchema === "function") return this.parameters.getParametersSchema();
    if (this.parameters && typeof this.parameters === "object") return this.parameters;
    return { type: "object", additionalProperties: true };
  }

  validateArgs(args) { return JsonSchema.validate(this.getParametersSchema(), args).valid; }
  parseArgs(args) {
    const detailed = JsonSchema.validate(this.getParametersSchema(), args);
    if (!detailed.valid) {
      const first = detailed.errors?.[0];
      throw new TypeError(first?.message || `Invalid arguments for tool ${this.name}`);
    }
    return args;
  }
  validateResult(result) {
    if (!this.resultSchema) return true;
    return JsonSchema.validate(Schema.toJSON(this.resultSchema), result).valid;
  }

  async execute(input) {
    return this._execute(input);
  }

  async executeWithTimeout(input, timeoutOverride) {
    const timeout = timeoutOverride ?? this.timeout;
    let timer;
    try {
      return await Promise.race([
        this._execute(input),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Tool ${this.name} timed out after ${timeout}ms`)), timeout);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async executeCall(call, ctx, timeoutOverride) {
    try {
      const args = this.parseArgs(call.args);
      const result = await this.executeWithTimeout({ args, ctx }, timeoutOverride);
      if (!this.validateResult(result)) {
        return { id: call.id, result: null, success: false, error: `Invalid result for tool ${this.name}` };
      }
      return { id: call.id, result, success: true };
    } catch (error) {
      return { id: call.id, result: null, success: false, error: error?.message || String(error) };
    }
  }
}
|}]
  [@@mel.as "Tool"]

let create_tool : js_function =
  [%mel.raw {| function createTool(definition) { return new Tool(definition); } |}]
  [@@mel.as "createTool"]

let merge_options : js_function =
  [%mel.raw {| function mergeOptions(defaults = {}, overrides = {}) { return { ...(defaults || {}), ...(overrides || {}) }; } |}]
  [@@mel.as "mergeOptions"]

let chat : js_chat_class =
  [%mel.raw
    {|
class Chat {
  constructor(config = {}) {
    this._config = config || {};
    this._defaults = this._config.defaults || {};
    this._model = this._resolvePreset(this._config.model || "gpt-4o", this._defaults.provider || this._config.provider);
    this._messages = [];
    this._lastResult = null;
    this._state = js_chat_create_state(JSON.stringify(config || {}));
    this._tools = [];
    this._localBaseUrl = this._config.localBaseUrl || this._defaults.localBaseUrl;
    this._localApiKey = this._config.localApiKey || this._defaults.localApiKey;
    this._localTimeout = this._config.localTimeout || this._defaults.localTimeout;
  }

  static fromJSON(json) {
    const chat = new Chat({ model: json?.model || "gpt-4o", defaults: json?.config?.defaults || json?.config || {} });
    chat._messages = (json?.messages || []).map((message) => Message.fromJSON(message));
    chat._lastResult = json?.lastResult || null;
    chat._syncStateFromMessages();
    return chat;
  }

  get model() {
    return this._model;
  }

  set model(value) {
    this._model = String(value);
    this._syncStateFromMessages();
  }

  get messages() {
    return this._messages.slice();
  }

  get tools() {
    return this._tools.slice();
  }

  get lastResult() {
    return this._lastResult;
  }

  system(content, metadata) {
    this._messages.push(Message.system(String(content ?? ""), metadata));
    this._syncStateFromMessages();
    return this;
  }

  user(content, metadata) {
    this._messages.push(Message.user(String(content ?? ""), metadata));
    this._syncStateFromMessages();
    return this;
  }

  assistant(content, metadata) {
    this._messages.push(Message.assistant(String(content ?? ""), metadata));
    this._syncStateFromMessages();
    return this;
  }

  addMessage(message) {
    this._messages.push(message instanceof Message ? message : Message.fromJSON(message));
    this._syncStateFromMessages();
    return this;
  }

  addMessages(messages) {
    for (const message of messages || []) {
      this.addMessage(message);
    }
    return this;
  }

  clearMessages() {
    this._messages = [];
    this._syncStateFromMessages();
    return this;
  }

  addTool(tool) {
    this._tools.push(tool);
    return this;
  }

  addTools(tools) {
    this._tools.push(...(tools || []));
    return this;
  }

  clearTools() {
    this._tools = [];
    return this;
  }

  async generate(options = {}) {
    const result = await this.generateWithResult(options);
    return result.content;
  }

  async generateWithResult(options = {}) {
    const opts = mergeOptions(this._defaults, options || {});
    if (opts.__chatoyantTestFake || this._config.__chatoyantTestFake) {
      return this._generateFake(opts);
    }

    const start = Date.now();
    const result = await this._generateWithToolLoop(opts);
    result.timing = result.timing || {};
    result.timing.latencyMs = Date.now() - start;
    result.timing.latency_ms = result.timing.latencyMs;
    this._lastResult = result;
    this._messages.push(Message.assistant(result.content || ""));
    this._syncStateFromMessages();
    return result;
  }

  async *stream(options = {}) {
    if (this._tools.length > 0 || options.__chatoyantTestFake || this._config.__chatoyantTestFake) {
      yield await this.generate(options);
      return;
    }
    let content = "";
    const start = Date.now();
    for await (const chunk of this._streamDirect(options || {})) {
      content += chunk;
      yield chunk;
    }
    this._messages.push(Message.assistant(content));
    this._lastResult = {
      content,
      reasoningContent: "",
      usage: this._emptyUsage(),
      timing: { latencyMs: Date.now() - start },
      cost: { estimatedUsd: 0 },
      provider: this._detectProvider(options),
      model: options.model || this._model,
      cached: false,
      iterations: 1,
      toolCalls: [],
    };
    this._syncStateFromMessages();
  }

  async streamAccumulate(options = {}) {
    let content = "";
    for await (const chunk of this.stream(options)) {
      content += chunk;
      if (typeof options.onDelta === "function") {
        options.onDelta(chunk);
      }
    }
    return content;
  }

  async generateData(_schema, options = {}) {
    const text = await this.generate(options);
    try {
      return JSON.parse(text);
    } catch (_) {
      return text;
    }
  }

  toJSON() {
    const json = {
      model: this._model,
      messages: this._messages.map((message) => message.toJSON()),
      config: { defaults: this._defaults },
    };
    if (this._lastResult) json.lastResult = this._lastResult;
    return json;
  }

  stringify() {
    return JSON.stringify(this.toJSON());
  }

  clone() {
    return Chat.fromJSON(this.toJSON());
  }

  fork() {
    const json = this.toJSON();
    delete json.lastResult;
    return Chat.fromJSON(json);
  }

  _syncStateFromMessages() {
    let response = JSON.parse(js_chat_set_model(js_chat_create_state(JSON.stringify({ model: this._model })), this._model));
    let state = response.ok ? response.state : js_chat_create_state(JSON.stringify({ model: this._model }));
    for (const message of this._messages) {
      if (message.role === "tool") continue;
      const added = JSON.parse(js_chat_add_message(state, message.role, message.content));
      if (added.ok) state = added.state;
    }
    this._state = state;
  }

  _resolvePreset(model, provider = "openai") {
    const presets = {
      openai: { fast: "gpt-4o-mini", cheap: "gpt-4o-mini", best: "gpt-4o", balanced: "gpt-4o", reasoning: "o4-mini" },
      anthropic: { fast: "claude-haiku-4-5-20251001", cheap: "claude-haiku-4-5-20251001", best: "claude-sonnet-4-6", balanced: "claude-sonnet-4-6", reasoning: "claude-sonnet-4-6" },
      xai: { fast: "grok-4-1-fast-non-reasoning", cheap: "grok-4-1-fast-non-reasoning", best: "grok-4", balanced: "grok-4", reasoning: "grok-4" },
    };
    return presets[provider]?.[model] || presets.openai[model] || model;
  }

  _detectProvider(options = {}) {
    if (options.provider) return options.provider;
    if (this._defaults.provider) return this._defaults.provider;
    const model = options.model || this._model;
    if (options.localBaseUrl || this._localBaseUrl) return "local";
    if (typeof model === "string" && model.startsWith("claude")) return "anthropic";
    if (typeof model === "string" && model.startsWith("grok")) return "xai";
    if (typeof model === "string" && model.includes("/")) return "openrouter";
    return "openai";
  }

  _env(name) {
    return globalThis.process?.env?.[name];
  }

  _apiKey(provider, options = {}) {
    if (options.apiKey) return options.apiKey;
    if (this._config.apiKey) return this._config.apiKey;
    if (provider === "openai") return this._env("OPENAI_API_KEY");
    if (provider === "anthropic") return this._env("ANTHROPIC_API_KEY");
    if (provider === "xai") return this._env("XAI_API_KEY") || this._env("API_KEY_XAI");
    if (provider === "openrouter") return this._env("OPENROUTER_API_KEY") || this._env("API_KEY_OPENROUTER");
    if (provider === "local") return options.localApiKey || this._localApiKey || this._env("LOCAL_API_KEY") || "local";
    return undefined;
  }

  _baseUrl(provider, options = {}) {
    if (options.baseUrl) return options.baseUrl.replace(/\/$/, "");
    if (provider === "openai") return "https://api.openai.com/v1";
    if (provider === "anthropic") return "https://api.anthropic.com/v1";
    if (provider === "xai") return "https://api.x.ai/v1";
    if (provider === "openrouter") return "https://openrouter.ai/api/v1";
    if (provider === "local") {
      const baseUrl = options.localBaseUrl || this._localBaseUrl || this._env("LOCAL_BASE_URL");
      if (!baseUrl) throw new Error("Missing localBaseUrl or LOCAL_BASE_URL for local provider");
      return baseUrl.replace(/\/$/, "");
    }
    throw new Error(`Unsupported provider: ${provider}`);
  }

  _wireMessages(provider, messages) {
    if (provider === "anthropic") {
      return messages.filter((m) => m.role !== "system").map((m) => {
        if (m.role === "tool") {
          return {
            role: "user",
            content: [{ type: "tool_result", tool_use_id: m.toolCallId, content: m.content }],
          };
        }
        if (m.toolCalls?.length) {
          const content = [];
          if (m.content) content.push({ type: "text", text: m.content });
          for (const call of m.toolCalls) {
            content.push({ type: "tool_use", id: call.id, name: call.name, input: call.args ?? call.arguments ?? {} });
          }
          return { role: "assistant", content };
        }
        return { role: m.role === "assistant" ? "assistant" : "user", content: m.content };
      });
    }
    return messages.map((m) => {
      const out = { role: m.role, content: m.content };
      if (m.name) out.name = m.name;
      if (m.toolCallId) out.tool_call_id = m.toolCallId;
      if (m.toolCalls?.length) {
        out.tool_calls = m.toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: JSON.stringify(call.args ?? call.arguments ?? {}) },
        }));
      }
      return out;
    });
  }

  _toolDefinitions(provider) {
    if (!this._tools.length) return undefined;
    if (provider === "anthropic") {
      return this._tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.getParametersSchema(),
      }));
    }
    return this._tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.getParametersSchema(),
        strict: true,
      },
    }));
  }

  async _fetchJson(url, init, timeoutMs) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    let timer;
    if (controller && timeoutMs) {
      timer = setTimeout(() => controller.abort(), timeoutMs);
    }
    try {
      const response = await fetch(url, { ...init, signal: controller?.signal });
      const text = await response.text();
      let json;
      try { json = text ? JSON.parse(text) : {}; } catch (_) { json = { raw: text }; }
      if (!response.ok) {
        const message = json?.error?.message || json?.message || text || `HTTP ${response.status}`;
        throw new Error(message);
      }
      return json;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async _generateWithToolLoop(options = {}) {
    const maxIterations = options.maxToolIterations ?? DEFAULT_MAX_TOOL_ITERATIONS;
    let messages = this._messages.slice();
    let finalResult = null;
    let totalUsage = this._emptyUsage();

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      const result = await this._callProvider(messages, options);
      totalUsage = this._addUsage(totalUsage, result.usage || this._emptyUsage());
      result.usage = totalUsage;
      result.iterations = iteration;
      finalResult = result;

      if (!result.toolCalls?.length) {
        this._messages = messages.slice();
        return result;
      }

      messages = messages.concat([new Message("assistant", result.content || "", { toolCalls: result.toolCalls })]);
      for (const call of result.toolCalls) {
        const tool = this._tools.find((candidate) => candidate.name === call.name);
        let toolResult;
        if (!tool) {
          toolResult = { id: call.id, result: null, success: false, error: `Unknown tool: ${call.name}` };
        } else {
          toolResult = await tool.executeCall(
            { id: call.id, name: call.name, args: call.args },
            { model: result.model, provider: result.provider },
            options.toolTimeout,
          );
        }
        messages.push(Message.tool(JSON.stringify(toolResult), call.id, { success: toolResult.success }));
      }
    }

    throw new Error(`tool iteration limit exceeded after ${maxIterations} turns`);
  }

  async _callProvider(messages, options = {}) {
    const provider = this._detectProvider(options);
    if (provider === "anthropic") return this._callAnthropic(messages, options);
    return this._callOpenAICompatible(provider, messages, options);
  }

  async *_streamDirect(options = {}) {
    const provider = this._detectProvider(options);
    if (provider === "anthropic") {
      yield* this._streamAnthropic(this._messages, options);
    } else {
      yield* this._streamOpenAICompatible(provider, this._messages, options);
    }
  }

  async _callOpenAICompatible(provider, messages, options = {}) {
    const model = options.model || this._model;
    const apiKey = this._apiKey(provider, options);
    if (!apiKey && provider !== "local") throw new Error(`Missing API key for ${provider}`);
    const baseUrl = this._baseUrl(provider, options);
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    if (provider === "openrouter") {
      if (options.httpReferer) headers["HTTP-Referer"] = options.httpReferer;
      if (options.title) headers["X-Title"] = options.title;
    }
    const body = {
      model,
      messages: this._wireMessages(provider, messages),
      temperature: options.temperature,
      max_tokens: options.maxTokens ?? options.max_tokens,
      stream: false,
    };
    const tools = this._toolDefinitions(provider);
    if (tools?.length) body.tools = tools;
    if (options.toolChoice) body.tool_choice = options.toolChoice;
    if (options.extra && typeof options.extra === "object") Object.assign(body, options.extra);
    const json = await this._fetchJson(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }, options.timeout ?? DEFAULT_TIMEOUT);
    const choice = json.choices?.[0] || {};
    const message = choice.message || {};
    const usage = this._usageFromOpenAI(json.usage || {}, provider);
    const toolCalls = (message.tool_calls || []).map((call) => ({
      id: call.id,
      name: call.function?.name || "",
      args: this._parseJson(call.function?.arguments || "{}"),
      arguments: call.function?.arguments || "{}",
    }));
    return {
      content: message.content || "",
      reasoningContent: message.reasoning_content || "",
      usage,
      timing: {},
      cost: { estimatedUsd: 0, actualUsd: usage.costUsd || undefined },
      provider,
      model: json.model || model,
      cached: usage.cachedTokens > 0,
      iterations: 1,
      toolCalls,
      finishReason: choice.finish_reason,
      raw: json,
    };
  }

  async *_streamOpenAICompatible(provider, messages, options = {}) {
    const model = options.model || this._model;
    const apiKey = this._apiKey(provider, options);
    if (!apiKey && provider !== "local") throw new Error(`Missing API key for ${provider}`);
    const baseUrl = this._baseUrl(provider, options);
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const body = {
      model,
      messages: this._wireMessages(provider, messages),
      temperature: options.temperature,
      max_tokens: options.maxTokens ?? options.max_tokens,
      stream: true,
    };
    if (options.extra && typeof options.extra === "object") Object.assign(body, options.extra);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }
    yield* this._parseSse(response, (json) => {
      const choice = json.choices?.[0];
      return choice?.delta?.content || "";
    });
  }

  async _callAnthropic(messages, options = {}) {
    const model = options.model || this._model;
    const apiKey = this._apiKey("anthropic", options);
    if (!apiKey) throw new Error("Missing API key for anthropic");
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n") || undefined;
    const body = {
      model,
      messages: this._wireMessages("anthropic", messages),
      max_tokens: options.maxTokens ?? options.max_tokens ?? 4096,
      temperature: options.temperature,
      system,
    };
    const tools = this._toolDefinitions("anthropic");
    if (tools?.length) body.tools = tools;
    if (options.extra && typeof options.extra === "object") Object.assign(body, options.extra);
    const json = await this._fetchJson(`${this._baseUrl("anthropic", options)}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": options.anthropicVersion || "2023-06-01",
      },
      body: JSON.stringify(body),
    }, options.timeout ?? DEFAULT_TIMEOUT);
    const blocks = json.content || [];
    const text = blocks.filter((block) => block.type === "text").map((block) => block.text || "").join("");
    const toolCalls = blocks.filter((block) => block.type === "tool_use").map((block) => ({
      id: block.id,
      name: block.name,
      args: block.input || {},
      arguments: JSON.stringify(block.input || {}),
    }));
    const usage = this._usageFromAnthropic(json.usage || {});
    return {
      content: text,
      reasoningContent: blocks.filter((block) => block.type === "thinking").map((block) => block.thinking || "").join(""),
      usage,
      timing: {},
      cost: { estimatedUsd: 0 },
      provider: "anthropic",
      model: json.model || model,
      cached: usage.cachedTokens > 0,
      iterations: 1,
      toolCalls,
      finishReason: json.stop_reason,
      raw: json,
    };
  }

  async *_streamAnthropic(messages, options = {}) {
    const model = options.model || this._model;
    const apiKey = this._apiKey("anthropic", options);
    if (!apiKey) throw new Error("Missing API key for anthropic");
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n") || undefined;
    const body = {
      model,
      messages: this._wireMessages("anthropic", messages),
      max_tokens: options.maxTokens ?? options.max_tokens ?? 4096,
      temperature: options.temperature,
      system,
      stream: true,
    };
    if (options.extra && typeof options.extra === "object") Object.assign(body, options.extra);
    const response = await fetch(`${this._baseUrl("anthropic", options)}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": options.anthropicVersion || "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }
    yield* this._parseSse(response, (json) => {
      if (json.type === "content_block_delta" && json.delta?.type === "text_delta") return json.delta.text || "";
      return "";
    });
  }

  async *_parseSse(response, selectText) {
    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) >= 0) {
        const event = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        for (const line of event.split(/\r?\n/)) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const text = selectText(JSON.parse(data));
            if (text) yield text;
          } catch (_) {
            // Ignore malformed provider stream frames instead of killing the iterator.
          }
        }
      }
    }
  }

  async _generateFake(options = {}) {
    this._syncStateFromMessages();
    const response = JSON.parse(js_chat_generate(this._state, JSON.stringify(options || {})));
    if (!response.ok) throw new Error(response.error || "generation failed");
    this._state = response.state;
    this._lastResult = this._normalizeResult(response.result);
    this._messages.push(Message.assistant(this._lastResult.content));
    return this._lastResult;
  }

  _normalizeResult(result) {
    const usage = result.usage || {};
    return {
      content: result.content || "",
      reasoningContent: result.reasoning_content || result.reasoningContent || "",
      usage: {
        inputTokens: usage.input_tokens ?? usage.inputTokens ?? 0,
        outputTokens: usage.output_tokens ?? usage.outputTokens ?? 0,
        reasoningTokens: usage.reasoning_tokens ?? usage.reasoningTokens ?? 0,
        cachedTokens: usage.cached_tokens ?? usage.cachedTokens ?? 0,
        cacheWriteTokens: usage.cache_write_tokens ?? usage.cacheWriteTokens ?? 0,
        totalTokens: usage.total_tokens ?? usage.totalTokens ?? 0,
        costUsd: usage.actual_cost_usd ?? usage.costUsd ?? 0,
      },
      timing: {
        latencyMs: result.timing?.latency_ms ?? result.timing?.latencyMs ?? 0,
        timeToFirstTokenMs: result.timing?.time_to_first_token_ms ?? result.timing?.timeToFirstTokenMs,
      },
      cost: {
        estimatedUsd: result.cost?.estimated_usd ?? result.cost?.estimatedUsd ?? 0,
        actualUsd: result.cost?.actual_usd ?? result.cost?.actualUsd,
      },
      provider: result.provider || "openai",
      model: result.model || this._model,
      cached: !!result.cached,
      iterations: result.iterations || 1,
      toolCalls: result.tool_calls || result.toolCalls || [],
      finishReason: result.finish_reason || result.finishReason,
      raw: result.raw,
    };
  }

  _emptyUsage() {
    return { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cachedTokens: 0, cacheWriteTokens: 0, totalTokens: 0, costUsd: 0 };
  }

  _addUsage(left, right) {
    return {
      inputTokens: (left.inputTokens || 0) + (right.inputTokens || 0),
      outputTokens: (left.outputTokens || 0) + (right.outputTokens || 0),
      reasoningTokens: (left.reasoningTokens || 0) + (right.reasoningTokens || 0),
      cachedTokens: (left.cachedTokens || 0) + (right.cachedTokens || 0),
      cacheWriteTokens: (left.cacheWriteTokens || 0) + (right.cacheWriteTokens || 0),
      totalTokens: (left.totalTokens || 0) + (right.totalTokens || 0),
      costUsd: (left.costUsd || 0) + (right.costUsd || 0),
    };
  }

  _usageFromOpenAI(usage, provider) {
    const promptDetails = usage.prompt_tokens_details || {};
    const completionDetails = usage.completion_tokens_details || {};
    const costUsd =
      provider === "openrouter" && typeof usage.cost === "number"
        ? usage.cost * 0.000001
        : typeof usage.cost_in_usd_ticks === "number"
          ? usage.cost_in_usd_ticks / 10000000000
          : 0;
    return {
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      reasoningTokens: completionDetails.reasoning_tokens || 0,
      cachedTokens: promptDetails.cached_tokens || 0,
      cacheWriteTokens: promptDetails.cache_write_tokens || 0,
      totalTokens: usage.total_tokens || ((usage.prompt_tokens || 0) + (usage.completion_tokens || 0)),
      costUsd,
    };
  }

  _usageFromAnthropic(usage) {
    const input = usage.input_tokens || 0;
    const output = usage.output_tokens || 0;
    return {
      inputTokens: input,
      outputTokens: output,
      reasoningTokens: 0,
      cachedTokens: usage.cache_read_input_tokens || 0,
      cacheWriteTokens: usage.cache_creation_input_tokens || 0,
      totalTokens: input + output,
      costUsd: 0,
    };
  }

  _parseJson(text) {
    try { return JSON.parse(text); } catch (_) { return {}; }
  }
}
|}]
  [@@mel.as "Chat"]

let gen_text : js_function =
  [%mel.raw
    {|
async function genText(prompt, options = {}) {
  const chat = new Chat({ model: options && options.model });
  if (options && options.system) {
    chat.system(options.system);
  }
  chat.user(prompt);
  return chat.generate(options || {});
}
|}]
  [@@mel.as "genText"]

let gen_stream : js_function =
  [%mel.raw
    {|
async function* genStream(prompt, options = {}) {
  const chat = new Chat({ model: options && options.model });
  if (options && options.system) {
    chat.system(options.system);
  }
  chat.user(prompt);
  yield* chat.stream(options || {});
}
|}]
  [@@mel.as "genStream"]

let gen_stream_accumulate : js_function =
  [%mel.raw
    {|
async function genStreamAccumulate(prompt, options = {}) {
  const chat = new Chat({ model: options && options.model });
  if (options && options.system) {
    chat.system(options.system);
  }
  chat.user(prompt);
  return chat.streamAccumulate(options || {});
}
|}]
  [@@mel.as "genStreamAccumulate"]

let gen_data : js_function =
  [%mel.raw
    {|
async function genData(prompt, schema, options = {}) {
  const chat = new Chat({ model: options && options.model });
  if (options && options.system) {
    chat.system(options.system);
  }
  chat.user(prompt);
  return chat.generateData(schema, options || {});
}
|}]
  [@@mel.as "genData"]

let make_provider_client_class : js_function =
  [%mel.raw
    {|
function makeProviderClientClass(provider) {
  return class ProviderClient {
    constructor(config = {}) {
      this.provider = provider;
      this.config = config || {};
    }

    _chat(model) {
      return new Chat({
        ...this.config,
        model: model || this.config.model,
        defaults: { ...(this.config.defaults || {}), provider },
      });
    }

    async chat(messages, options = {}) {
      const chat = this._chat(options.model);
      chat.addMessages((messages || []).map((message) => message instanceof Message ? message : Message.fromJSON(message)));
      return chat.generateWithResult({ ...this.config, ...options, provider });
    }

    async chatSimple(messages, options = {}) {
      const result = await this.chat(messages, options);
      return result.content;
    }

    async message(messages, options = {}) {
      return this.chat(messages, options);
    }
  };
}
|}]
  [@@mel.as "makeProviderClientClass"]

let openai_client : js_function =
  [%mel.raw {| makeProviderClientClass("openai") |}]
  [@@mel.as "OpenAIClient"]

let anthropic_client : js_function =
  [%mel.raw {| makeProviderClientClass("anthropic") |}]
  [@@mel.as "AnthropicClient"]

let xai_client : js_function =
  [%mel.raw {| makeProviderClientClass("xai") |}]
  [@@mel.as "XAIClient"]

let local_client : js_function =
  [%mel.raw {| makeProviderClientClass("local") |}]
  [@@mel.as "LocalClient"]

let openrouter_client : js_function =
  [%mel.raw {| makeProviderClientClass("openrouter") |}]
  [@@mel.as "OpenRouterClient"]

let create_provider_client : js_function =
  [%mel.raw
    {|
function createProviderClient(provider, config = {}) {
  if (provider === "openai") return new OpenAIClient(config);
  if (provider === "anthropic") return new AnthropicClient(config);
  if (provider === "xai") return new XAIClient(config);
  if (provider === "local") return new LocalClient(config);
  if (provider === "openrouter") return new OpenRouterClient(config);
  const Client = makeProviderClientClass(provider);
  return new Client(config);
}
|}]
  [@@mel.as "createProviderClient"]

let create_openai_client : js_function =
  [%mel.raw {| function createOpenAIClient(config = {}) { return createProviderClient("openai", config); } |}]
  [@@mel.as "createOpenAIClient"]

let create_anthropic_client : js_function =
  [%mel.raw {| function createAnthropicClient(config = {}) { return createProviderClient("anthropic", config); } |}]
  [@@mel.as "createAnthropicClient"]

let create_xai_client : js_function =
  [%mel.raw {| function createXAIClient(config = {}) { return createProviderClient("xai", config); } |}]
  [@@mel.as "createXAIClient"]

let create_local_client : js_function =
  [%mel.raw {| function createLocalClient(config = {}) { return createProviderClient("local", config); } |}]
  [@@mel.as "createLocalClient"]

let create_openrouter_client : js_function =
  [%mel.raw {| function createOpenRouterClient(config = {}) { return createProviderClient("openrouter", config); } |}]
  [@@mel.as "createOpenRouterClient"]

let openai_namespace : js_value =
  [%mel.raw
    {| Object.freeze({ Client: OpenAIClient, create: createOpenAIClient, createClient: createOpenAIClient }) |}]
  [@@mel.as "OpenAI"]

let anthropic_namespace : js_value =
  [%mel.raw
    {| Object.freeze({ Client: AnthropicClient, create: createAnthropicClient, createClient: createAnthropicClient }) |}]
  [@@mel.as "Anthropic"]

let xai_namespace : js_value =
  [%mel.raw {| Object.freeze({ Client: XAIClient, create: createXAIClient, createClient: createXAIClient }) |}]
  [@@mel.as "XAI"]

let local_namespace : js_value =
  [%mel.raw {| Object.freeze({ Client: LocalClient, create: createLocalClient, createClient: createLocalClient }) |}]
  [@@mel.as "Local"]

let openrouter_namespace : js_value =
  [%mel.raw
    {| Object.freeze({ Client: OpenRouterClient, create: createOpenRouterClient, createClient: createOpenRouterClient }) |}]
  [@@mel.as "OpenRouter"]

let core_namespace : js_value =
  [%mel.raw {| Object.freeze({ Chat, Message, Tool, createTool }) |}]
  [@@mel.as "Core"]

let schemas_namespace : js_value =
  [%mel.raw {| Object.freeze({ Schema, JsonSchema }) |}]
  [@@mel.as "Schemas"]

let generate_namespace : js_value =
  [%mel.raw
    {|
Object.freeze({
  text: genText,
  data: genData,
  stream: genStream,
  streamAccumulate: genStreamAccumulate,
  genText,
  genData,
  genStream,
  genStreamAccumulate,
})
|}]
  [@@mel.as "Generate"]

let shortcuts_namespace : js_value =
  [%mel.raw
    {|
Object.freeze({
  text: genText,
  data: genData,
  stream: genStream,
  streamAccumulate: genStreamAccumulate,
  genText,
  genData,
  genStream,
  genStreamAccumulate,
})
|}]
  [@@mel.as "Shortcuts"]

let providers_namespace : js_value =
  [%mel.raw
    {|
Object.freeze({
  OpenAI,
  Anthropic,
  XAI,
  Local,
  OpenRouter,
  OpenAIClient,
  AnthropicClient,
  XAIClient,
  LocalClient,
  OpenRouterClient,
  create: createProviderClient,
  createProviderClient,
  createOpenAIClient,
  createAnthropicClient,
  createXAIClient,
  createLocalClient,
  createOpenRouterClient,
})
|}]
  [@@mel.as "Providers"]

let defaults_namespace : js_value =
  [%mel.raw
    {|
Object.freeze({
  timeout: 120000,
  retries: 3,
  toolTimeout: 10000,
  maxToolIterations: 8,
  DEFAULT_TIMEOUT: 120000,
  DEFAULT_RETRIES: 3,
  DEFAULT_TOOL_TIMEOUT: 10000,
  DEFAULT_MAX_TOOL_ITERATIONS: 8,
})
|}]
  [@@mel.as "Defaults"]

let chatoyant_namespace : js_value =
  [%mel.raw
    {|
Object.freeze({
  version: "0.0.0-port",
  Core,
  Schemas,
  Generate,
  Shortcuts,
  Providers,
  Defaults,
  OpenAI,
  Anthropic,
  XAI,
  Local,
  OpenRouter,
  Chat,
  Message,
  Tool,
  createTool,
  mergeOptions,
  Schema,
  JsonSchema,
  genText,
  genData,
  genStream,
  genStreamAccumulate,
  OpenAIClient,
  AnthropicClient,
  XAIClient,
  LocalClient,
  OpenRouterClient,
  createProviderClient,
  createOpenAIClient,
  createAnthropicClient,
  createXAIClient,
  createLocalClient,
  createOpenRouterClient,
})
|}]
  [@@mel.as "Chatoyant"]

let public_message : js_function = [%mel.raw {| Message |}]
let public_json_schema_class : js_function = [%mel.raw {| JsonSchema |}]
let public_schema_class : js_function = [%mel.raw {| Schema |}]
let public_tool : js_function = [%mel.raw {| Tool |}]
let public_create_tool : js_function = [%mel.raw {| createTool |}]
let public_merge_options : js_function = [%mel.raw {| mergeOptions |}]
let public_chat : js_chat_class = [%mel.raw {| Chat |}]
let public_gen_text : js_function = [%mel.raw {| genText |}]
let public_gen_stream : js_function = [%mel.raw {| genStream |}]
let public_gen_stream_accumulate : js_function = [%mel.raw {| genStreamAccumulate |}]
let public_gen_data : js_function = [%mel.raw {| genData |}]
let public_openai_client : js_function = [%mel.raw {| OpenAIClient |}]
let public_anthropic_client : js_function = [%mel.raw {| AnthropicClient |}]
let public_xai_client : js_function = [%mel.raw {| XAIClient |}]
let public_local_client : js_function = [%mel.raw {| LocalClient |}]
let public_openrouter_client : js_function = [%mel.raw {| OpenRouterClient |}]
let public_create_provider_client : js_function = [%mel.raw {| createProviderClient |}]
let public_create_openai_client : js_function = [%mel.raw {| createOpenAIClient |}]
let public_create_anthropic_client : js_function = [%mel.raw {| createAnthropicClient |}]
let public_create_xai_client : js_function = [%mel.raw {| createXAIClient |}]
let public_create_local_client : js_function = [%mel.raw {| createLocalClient |}]
let public_create_openrouter_client : js_function = [%mel.raw {| createOpenRouterClient |}]
let public_openai_namespace : js_value = [%mel.raw {| OpenAI |}]
let public_anthropic_namespace : js_value = [%mel.raw {| Anthropic |}]
let public_xai_namespace : js_value = [%mel.raw {| XAI |}]
let public_local_namespace : js_value = [%mel.raw {| Local |}]
let public_openrouter_namespace : js_value = [%mel.raw {| OpenRouter |}]
let public_core_namespace : js_value = [%mel.raw {| Core |}]
let public_schemas_namespace : js_value = [%mel.raw {| Schemas |}]
let public_generate_namespace : js_value = [%mel.raw {| Generate |}]
let public_shortcuts_namespace : js_value = [%mel.raw {| Shortcuts |}]
let public_providers_namespace : js_value = [%mel.raw {| Providers |}]
let public_defaults_namespace : js_value = [%mel.raw {| Defaults |}]
let public_chatoyant_namespace : js_value = [%mel.raw {| Chatoyant |}]

let chat_session_json () =
  let session =
    Js_session.create ~model:"gpt-4o" ()
    |> Js_session.system "You are helpful"
    |> Js_session.user "Hello"
  in
  match Js_session.generate_with_result session with
  | Error _ -> "{}"
  | Ok _ -> Js_session.to_json session |> Chatoyant_js_base.Runtime.Json.to_string

let chat_session_roundtrip json_text =
  match Chatoyant_js_base.Runtime.Json.parse json_text with
  | Error message -> "ERROR:" ^ message
  | Ok json -> (
      match Js_session.of_json json with
      | Error message -> "ERROR:" ^ message
      | Ok session -> Js_session.to_json session |> Chatoyant_js_base.Runtime.Json.to_string)

let chat_shortcut_text prompt =
  match Js_shortcuts.gen_text ~model:"gpt-4o" prompt with
  | Error _ -> "ERROR"
  | Ok text -> text

let chat_stream_accumulate_json () =
  let frame =
    Chatoyant_js_base.Core.Stream.
      {
        content_delta = Some "streamed";
        reasoning_delta = None;
        tool_call_deltas = [];
        usage =
          Some
            {
              Chatoyant_js_base.Tokens.Cost.empty_usage with
              input_tokens = 2;
              output_tokens = 3;
              total_tokens = 5;
            };
        usage_source = Chatoyant_js_base.Tokens.Cost.Provider_reported;
        finish_reason = Some "stop";
        raw = None;
      }
  in
  let session = Js_session.create ~model:"gpt-4o" () |> Js_session.user "Hello" in
  Js_session.stream_accumulate [ frame ] session
  |> Chatoyant_js_base.Core.Result.generation_to_json
  |> Chatoyant_js_base.Runtime.Json.to_string

let anthropic_request_json () =
  let tool_schema =
    Chatoyant_js_base.Runtime.Json.Object
      [
        ("type", Chatoyant_js_base.Runtime.Json.String "object");
        ("properties", Chatoyant_js_base.Runtime.Json.Object []);
      ]
  in
  Chatoyant_js_base.Provider.Anthropic.
    {
      model = "claude-sonnet-4-6";
      system = Some "You are helpful";
      messages = [ { message_role = User; message_content = [ Text "Hello" ] } ];
      max_tokens = 4096;
      stream = false;
      temperature = Some 0.2;
      top_p = Some 0.9;
      top_k = Some 50;
      stop_sequences = [ "END" ];
      metadata_user_id = Some "node_user";
      tools =
        [
          {
            tool_name = "lookup";
            tool_description = Some "Lookup data";
            input_schema = tool_schema;
          };
        ];
      tool_choice = Some (Tool "lookup");
      thinking = Some (Enabled { budget_tokens = 2048 });
      extra = [];
    }
  |> Chatoyant_js_base.Provider.Anthropic.request_json
  |> Chatoyant_js_base.Runtime.Json.to_string

let anthropic_smoke_request_json prompt =
  Chatoyant_js_base.Provider.Anthropic.
    {
      model = "claude-haiku-4-5-20251001";
      system = None;
      messages = [ { message_role = User; message_content = [ Text prompt ] } ];
      max_tokens = 32;
      stream = false;
      temperature = Some 0.0;
      top_p = None;
      top_k = None;
      stop_sequences = [];
      metadata_user_id = None;
      tools = [];
      tool_choice = None;
      thinking = None;
      extra = [];
    }
  |> Chatoyant_js_base.Provider.Anthropic.request_json
  |> Chatoyant_js_base.Runtime.Json.to_string

let anthropic_decode_text response_json =
  match Chatoyant_js_base.Runtime.Json.parse response_json with
  | Error message -> "ERROR:" ^ message
  | Ok json ->
      json
      |> Chatoyant_js_base.Provider.Anthropic.response_of_json
      |> Chatoyant_js_base.Provider.Anthropic.text_of_response

let anthropic_stream_text chunks =
  match Chatoyant_js_base.Provider.Anthropic.response_of_stream_chunks chunks with
  | Error message -> "ERROR:" ^ message
  | Ok response -> Chatoyant_js_base.Provider.Anthropic.text_of_response response

let anthropic_stream_text4 a b c d = anthropic_stream_text [ a; b; c; d ]

let anthropic_batch_request_json () =
  let request =
    Chatoyant_js_base.Provider.Anthropic.
      {
        model = "claude-haiku-4-5-20251001";
        system = None;
        messages = [ { message_role = User; message_content = [ Text "Hello" ] } ];
        max_tokens = 32;
        stream = false;
        temperature = Some 0.0;
        top_p = None;
        top_k = None;
        stop_sequences = [];
        metadata_user_id = None;
        tools = [];
        tool_choice = None;
        thinking = None;
        extra = [];
      }
  in
  Chatoyant_js_base.Provider.Anthropic.batch_create_json
    [ { custom_id = "case_1"; params = request } ]
  |> Chatoyant_js_base.Runtime.Json.to_string

let anthropic_model_count models_json =
  match Chatoyant_js_base.Runtime.Json.parse models_json with
  | Error _ -> -1
  | Ok json -> List.length (Chatoyant_js_base.Provider.Anthropic.model_list_of_json json).models

let anthropic_batch_result_text jsonl =
  match Chatoyant_js_base.Provider.Anthropic.batch_result_lines_of_jsonl jsonl with
  | Error message -> "ERROR:" ^ message
  | Ok ({ result = Batch_succeeded response; _ } :: _) ->
      Chatoyant_js_base.Provider.Anthropic.text_of_response response
  | Ok _ -> ""

let openai_chat_request_json () =
  let schema =
    Chatoyant_js_base.Runtime.Json.Object
      [
        ("type", Chatoyant_js_base.Runtime.Json.String "object");
        ( "properties",
          Chatoyant_js_base.Runtime.Json.Object
            [
              ( "answer",
                Chatoyant_js_base.Runtime.Json.Object
                  [ ("type", Chatoyant_js_base.Runtime.Json.String "string") ] );
            ] );
        ( "required",
          Chatoyant_js_base.Runtime.Json.Array [ Chatoyant_js_base.Runtime.Json.String "answer" ] );
        ("additionalProperties", Chatoyant_js_base.Runtime.Json.Bool false);
      ]
  in
  Chatoyant_js_base.Provider.Openai.
    {
      chat_model = "gpt-4o-mini";
      chat_messages =
        [
          {
            message_role = Developer;
            message_content = Some "Return compact JSON.";
            message_name = None;
            message_tool_call_id = None;
            message_tool_calls = [];
          };
          {
            message_role = User;
            message_content = Some "Say hello.";
            message_name = None;
            message_tool_call_id = None;
            message_tool_calls = [];
          };
        ];
      chat_stream = false;
      chat_temperature = Some 0.0;
      chat_max_tokens = Some 64;
      chat_top_p = None;
      chat_stop = [];
      chat_user = None;
      chat_seed = None;
      chat_logprobs = None;
      chat_top_logprobs = None;
      chat_n = None;
      chat_tools = [];
      chat_tool_choice = None;
      chat_parallel_tool_calls = None;
      chat_response_format =
        Some
          (Json_schema
             {
               schema_name = "answer";
               schema_description = None;
               schema_value = schema;
               schema_strict = true;
             });
      chat_extra = [];
    }
  |> Chatoyant_js_base.Provider.Openai.chat_request_json
  |> Chatoyant_js_base.Runtime.Json.to_string

let openai_responses_request_json () =
  let schema =
    Chatoyant_js_base.Runtime.Json.Object
      [
        ("type", Chatoyant_js_base.Runtime.Json.String "object");
        ( "properties",
          Chatoyant_js_base.Runtime.Json.Object
            [
              ( "answer",
                Chatoyant_js_base.Runtime.Json.Object
                  [ ("type", Chatoyant_js_base.Runtime.Json.String "string") ] );
            ] );
        ( "required",
          Chatoyant_js_base.Runtime.Json.Array [ Chatoyant_js_base.Runtime.Json.String "answer" ] );
        ("additionalProperties", Chatoyant_js_base.Runtime.Json.Bool false);
      ]
  in
  Chatoyant_js_base.Provider.Openai.
    {
      responses_model = "gpt-4o-mini";
      responses_input = Input_text "Say hello.";
      responses_instructions = Some "Return compact JSON.";
      responses_previous_response_id = None;
      responses_store = Some false;
      responses_stream = false;
      responses_temperature = Some 0.0;
      responses_top_p = None;
      responses_max_output_tokens = Some 64;
      responses_reasoning = None;
      responses_tools = [];
      responses_tool_choice = None;
      responses_text_format =
        Some
          (Responses_json_schema
             {
               response_schema_name = "answer";
               response_schema_description = None;
               response_schema_value = schema;
               response_schema_strict = true;
             });
      responses_parallel_tool_calls = None;
      responses_truncation = None;
      responses_metadata = [];
      responses_extra = [];
    }
  |> Chatoyant_js_base.Provider.Openai.responses_request_json
  |> Chatoyant_js_base.Runtime.Json.to_string

let openai_smoke_chat_request_json prompt =
  Chatoyant_js_base.Provider.Openai.
    {
      chat_model = "gpt-4o-mini";
      chat_messages =
        [
          {
            message_role = User;
            message_content = Some prompt;
            message_name = None;
            message_tool_call_id = None;
            message_tool_calls = [];
          };
        ];
      chat_stream = false;
      chat_temperature = Some 0.0;
      chat_max_tokens = Some 32;
      chat_top_p = None;
      chat_stop = [];
      chat_user = None;
      chat_seed = None;
      chat_logprobs = None;
      chat_top_logprobs = None;
      chat_n = None;
      chat_tools = [];
      chat_tool_choice = None;
      chat_parallel_tool_calls = None;
      chat_response_format = None;
      chat_extra = [];
    }
  |> Chatoyant_js_base.Provider.Openai.chat_request_json
  |> Chatoyant_js_base.Runtime.Json.to_string

let openai_smoke_responses_request_json prompt =
  Chatoyant_js_base.Provider.Openai.
    {
      responses_model = "gpt-4o-mini";
      responses_input = Input_text prompt;
      responses_instructions = None;
      responses_previous_response_id = None;
      responses_store = Some false;
      responses_stream = false;
      responses_temperature = Some 0.0;
      responses_top_p = None;
      responses_max_output_tokens = Some 32;
      responses_reasoning = None;
      responses_tools = [];
      responses_tool_choice = None;
      responses_text_format = None;
      responses_parallel_tool_calls = None;
      responses_truncation = None;
      responses_metadata = [];
      responses_extra = [];
    }
  |> Chatoyant_js_base.Provider.Openai.responses_request_json
  |> Chatoyant_js_base.Runtime.Json.to_string

let openai_decode_text response_json =
  match Chatoyant_js_base.Runtime.Json.parse response_json with
  | Error message -> "ERROR:" ^ message
  | Ok json -> (Chatoyant_js_base.Provider.Openai.chat_response_of_json json).chat_response_content

let openai_responses_decode_text response_json =
  match Chatoyant_js_base.Runtime.Json.parse response_json with
  | Error message -> "ERROR:" ^ message
  | Ok json -> (Chatoyant_js_base.Provider.Openai.responses_response_of_json json).responses_output_text

let openai_stream_text chunks =
  match Chatoyant_js_base.Provider.Openai.chat_response_of_stream_chunks chunks with
  | Error message -> "ERROR:" ^ message
  | Ok response -> response.chat_response_content

let openai_stream_text4 a b c d = openai_stream_text [ a; b; c; d ]

let compatible_request_fixture model =
  let schema =
    Chatoyant_js_base.Runtime.Json.Object
      [
        ("type", Chatoyant_js_base.Runtime.Json.String "object");
        ("properties", Chatoyant_js_base.Runtime.Json.Object []);
      ]
  in
  Chatoyant_js_base.Provider.Openai.
    {
      chat_model = model;
      chat_messages =
        [
          {
            message_role = User;
            message_content = Some "Hello";
            message_name = None;
            message_tool_call_id = None;
            message_tool_calls = [];
          };
        ];
      chat_stream = true;
      chat_temperature = Some 0.2;
      chat_max_tokens = Some 64;
      chat_top_p = Some 0.9;
      chat_stop = [ "END" ];
      chat_user = Some "strip_for_local";
      chat_seed = Some 7;
      chat_logprobs = Some true;
      chat_top_logprobs = Some 2;
      chat_n = Some 1;
      chat_tools =
        [
          {
            tool_name = "lookup";
            tool_description = Some "Lookup data";
            tool_parameters = schema;
            tool_strict = Some true;
          };
        ];
      chat_tool_choice = Some Auto;
      chat_parallel_tool_calls = Some false;
      chat_response_format =
        Some
          (Json_schema
             {
               schema_name = "answer";
               schema_description = None;
               schema_value = schema;
               schema_strict = true;
             });
      chat_extra = [];
    }

let local_request_json () =
  compatible_request_fixture "Qwen3-4B-MLX"
  |> Chatoyant_js_base.Provider.Local.chat_request_json
  |> Chatoyant_js_base.Runtime.Json.to_string

let openrouter_request_json () =
  compatible_request_fixture "anthropic/claude-sonnet-4.5"
  |> Chatoyant_js_base.Provider.Openrouter.chat_request_json
  |> Chatoyant_js_base.Runtime.Json.to_string

let openrouter_smoke_request_json prompt =
  Chatoyant_js_base.Provider.Openai.
    {
      chat_model = "openai/gpt-4o-mini";
      chat_messages =
        [
          {
            message_role = User;
            message_content = Some prompt;
            message_name = None;
            message_tool_call_id = None;
            message_tool_calls = [];
          };
        ];
      chat_stream = false;
      chat_temperature = Some 0.0;
      chat_max_tokens = Some 32;
      chat_top_p = None;
      chat_stop = [];
      chat_user = None;
      chat_seed = None;
      chat_logprobs = None;
      chat_top_logprobs = None;
      chat_n = None;
      chat_tools = [];
      chat_tool_choice = None;
      chat_parallel_tool_calls = None;
      chat_response_format = None;
      chat_extra = [];
    }
  |> Chatoyant_js_base.Provider.Openrouter.chat_request_json
  |> Chatoyant_js_base.Runtime.Json.to_string

let local_stream chunks =
  match Chatoyant_js_base.Provider.Local.chat_response_of_stream_chunks chunks with
  | Error message -> ("ERROR:" ^ message, "")
  | Ok response -> (response.chat_response_content, response.chat_response_reasoning_content)

let local_stream_text4 a b c d =
  let text, _ = local_stream [ a; b; c; d ] in
  text

let local_stream_reasoning4 a b c d =
  let _, reasoning = local_stream [ a; b; c; d ] in
  reasoning

let xai_request_json () =
  let schema =
    Chatoyant_js_base.Runtime.Json.Object
      [
        ("type", Chatoyant_js_base.Runtime.Json.String "object");
        ( "properties",
          Chatoyant_js_base.Runtime.Json.Object
            [
              ( "answer",
                Chatoyant_js_base.Runtime.Json.Object
                  [ ("type", Chatoyant_js_base.Runtime.Json.String "string") ] );
            ] );
        ( "required",
          Chatoyant_js_base.Runtime.Json.Array [ Chatoyant_js_base.Runtime.Json.String "answer" ] );
        ("additionalProperties", Chatoyant_js_base.Runtime.Json.Bool false);
      ]
  in
  Chatoyant_js_base.Provider.Xai.
    {
      chat_model = "grok-4-1-fast-non-reasoning";
      chat_messages =
        [
          {
            message_role = User;
            message_content = Some "Return a JSON greeting.";
            message_name = None;
            message_tool_call_id = None;
            message_tool_calls = [];
          };
        ];
      chat_stream = false;
      chat_temperature = Some 0.0;
      chat_max_tokens = Some 64;
      chat_top_p = None;
      chat_stop = [];
      chat_user = None;
      chat_seed = None;
      chat_logprobs = None;
      chat_top_logprobs = None;
      chat_n = None;
      chat_response_format =
        Some
          (Json_schema
             {
               schema_name = "answer";
               schema_description = None;
               schema_value = schema;
               schema_strict = true;
             });
      chat_tools = [ Web_search ];
      chat_tool_choice = Some Auto;
      chat_parallel_tool_calls = None;
      chat_extra = [];
    }
  |> Chatoyant_js_base.Provider.Xai.chat_request_json
  |> Chatoyant_js_base.Runtime.Json.to_string

let xai_smoke_request_json prompt =
  Chatoyant_js_base.Provider.Xai.
    {
      chat_model = "grok-4.20-0309-non-reasoning";
      chat_messages =
        [
          {
            message_role = User;
            message_content = Some prompt;
            message_name = None;
            message_tool_call_id = None;
            message_tool_calls = [];
          };
        ];
      chat_stream = false;
      chat_temperature = Some 0.0;
      chat_max_tokens = Some 32;
      chat_top_p = None;
      chat_stop = [];
      chat_user = None;
      chat_seed = None;
      chat_logprobs = None;
      chat_top_logprobs = None;
      chat_n = None;
      chat_response_format = None;
      chat_tools = [];
      chat_tool_choice = None;
      chat_parallel_tool_calls = None;
      chat_extra = [];
    }
  |> Chatoyant_js_base.Provider.Xai.chat_request_json
  |> Chatoyant_js_base.Runtime.Json.to_string

let xai_responses_request_json () =
  let schema =
    Chatoyant_js_base.Runtime.Json.Object
      [
        ("type", Chatoyant_js_base.Runtime.Json.String "object");
        ( "properties",
          Chatoyant_js_base.Runtime.Json.Object
            [
              ( "answer",
                Chatoyant_js_base.Runtime.Json.Object
                  [ ("type", Chatoyant_js_base.Runtime.Json.String "string") ] );
            ] );
        ( "required",
          Chatoyant_js_base.Runtime.Json.Array [ Chatoyant_js_base.Runtime.Json.String "answer" ] );
        ("additionalProperties", Chatoyant_js_base.Runtime.Json.Bool false);
      ]
  in
  Chatoyant_js_base.Provider.Xai.
    {
      responses_model = "grok-4.20-0309-non-reasoning";
      responses_input = Responses_text "Return a JSON greeting.";
      responses_instructions = Some "Be concise.";
      responses_previous_response_id = None;
      responses_store = Some false;
      responses_stream = false;
      responses_temperature = Some 0.0;
      responses_top_p = None;
      responses_max_output_tokens = Some 64;
      responses_tools = [ Web_search ];
      responses_tool_choice = Some Auto;
      responses_text_format =
        Some
          (Json_schema
             {
               schema_name = "answer";
               schema_description = None;
               schema_value = schema;
               schema_strict = true;
             });
      responses_parallel_tool_calls = None;
      responses_top_logprobs = None;
      responses_truncation = Some "disabled";
      responses_extra = [];
    }
  |> Chatoyant_js_base.Provider.Xai.responses_request_json
  |> Chatoyant_js_base.Runtime.Json.to_string

let xai_responses_smoke_request_json prompt =
  Chatoyant_js_base.Provider.Xai.
    {
      responses_model = "grok-4.20-0309-non-reasoning";
      responses_input = Responses_text prompt;
      responses_instructions = None;
      responses_previous_response_id = None;
      responses_store = Some false;
      responses_stream = false;
      responses_temperature = Some 0.0;
      responses_top_p = None;
      responses_max_output_tokens = Some 32;
      responses_tools = [];
      responses_tool_choice = None;
      responses_text_format = None;
      responses_parallel_tool_calls = None;
      responses_top_logprobs = None;
      responses_truncation = None;
      responses_extra = [];
    }
  |> Chatoyant_js_base.Provider.Xai.responses_request_json
  |> Chatoyant_js_base.Runtime.Json.to_string

let xai_decode_text response_json =
  match Chatoyant_js_base.Runtime.Json.parse response_json with
  | Error message -> "ERROR:" ^ message
  | Ok json -> (Chatoyant_js_base.Provider.Xai.chat_response_of_json json).response_content

let xai_responses_decode_text response_json =
  match Chatoyant_js_base.Runtime.Json.parse response_json with
  | Error message -> "ERROR:" ^ message
  | Ok json -> (Chatoyant_js_base.Provider.Xai.responses_response_of_json json).responses_output_text

let xai_stream_text chunks =
  match Chatoyant_js_base.Provider.Xai.stream_response_of_chunks chunks with
  | Error message -> "ERROR:" ^ message
  | Ok response -> response.response_content

let xai_stream_text4 a b c d = xai_stream_text [ a; b; c; d ]

let xai_image_request_json prompt =
  Chatoyant_js_base.Provider.Xai.
    {
      image_model = Some "grok-imagine-image-quality";
      image_prompt = prompt;
      image_n = Some 1;
      image_response_format = Some Base64_json;
      image_aspect_ratio = Some "1:1";
      image_resolution = Some "1024x1024";
      image_user = None;
      image_extra = [];
    }
  |> Chatoyant_js_base.Provider.Xai.image_request_json
  |> Chatoyant_js_base.Runtime.Json.to_string

let xai_video_request_json prompt =
  Chatoyant_js_base.Provider.Xai.
    {
      video_model = Some "grok-imagine-video-1.5";
      video_prompt = prompt;
      video_duration = Some 6;
      video_aspect_ratio = Some "16:9";
      video_resolution = Some "1280x720";
      video_image_url = None;
      video_url = None;
      video_extra = [];
    }
  |> Chatoyant_js_base.Provider.Xai.video_request_json
  |> Chatoyant_js_base.Runtime.Json.to_string
