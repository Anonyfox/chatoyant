let version = Chatoyant_internal.version

let default_timeout = 120_000 [@@mel.as "DEFAULT_TIMEOUT"]
let default_retries = 3 [@@mel.as "DEFAULT_RETRIES"]
let default_tool_timeout = 10_000 [@@mel.as "DEFAULT_TOOL_TIMEOUT"]
let default_max_tool_iterations = 8 [@@mel.as "DEFAULT_MAX_TOOL_ITERATIONS"]

let message = Chatoyant_internal.public_message [@@mel.as "Message"]
let json_schema_class = Chatoyant_internal.public_json_schema_class [@@mel.as "JsonSchema"]
let schema_class = Chatoyant_internal.public_schema_class [@@mel.as "Schema"]
let tool = Chatoyant_internal.public_tool [@@mel.as "Tool"]
let create_tool = Chatoyant_internal.public_create_tool [@@mel.as "createTool"]
let merge_options = Chatoyant_internal.public_merge_options [@@mel.as "mergeOptions"]
let chat = Chatoyant_internal.public_chat [@@mel.as "Chat"]
let gen_text = Chatoyant_internal.public_gen_text [@@mel.as "genText"]
let gen_stream = Chatoyant_internal.public_gen_stream [@@mel.as "genStream"]
let gen_stream_accumulate = Chatoyant_internal.public_gen_stream_accumulate [@@mel.as "genStreamAccumulate"]
let gen_data = Chatoyant_internal.public_gen_data [@@mel.as "genData"]
let openai_client = Chatoyant_internal.public_openai_client [@@mel.as "OpenAIClient"]
let anthropic_client = Chatoyant_internal.public_anthropic_client [@@mel.as "AnthropicClient"]
let xai_client = Chatoyant_internal.public_xai_client [@@mel.as "XAIClient"]
let local_client = Chatoyant_internal.public_local_client [@@mel.as "LocalClient"]
let openrouter_client = Chatoyant_internal.public_openrouter_client [@@mel.as "OpenRouterClient"]

let create_provider_client =
  Chatoyant_internal.public_create_provider_client [@@mel.as "createProviderClient"]

let create_openai_client = Chatoyant_internal.public_create_openai_client [@@mel.as "createOpenAIClient"]

let create_anthropic_client =
  Chatoyant_internal.public_create_anthropic_client [@@mel.as "createAnthropicClient"]

let create_xai_client = Chatoyant_internal.public_create_xai_client [@@mel.as "createXAIClient"]
let create_local_client = Chatoyant_internal.public_create_local_client [@@mel.as "createLocalClient"]

let create_openrouter_client =
  Chatoyant_internal.public_create_openrouter_client [@@mel.as "createOpenRouterClient"]

let openai_namespace = Chatoyant_internal.public_openai_namespace [@@mel.as "OpenAI"]
let anthropic_namespace = Chatoyant_internal.public_anthropic_namespace [@@mel.as "Anthropic"]
let xai_namespace = Chatoyant_internal.public_xai_namespace [@@mel.as "XAI"]
let local_namespace = Chatoyant_internal.public_local_namespace [@@mel.as "Local"]
let openrouter_namespace = Chatoyant_internal.public_openrouter_namespace [@@mel.as "OpenRouter"]
let core_namespace = Chatoyant_internal.public_core_namespace [@@mel.as "Core"]
let schemas_namespace = Chatoyant_internal.public_schemas_namespace [@@mel.as "Schemas"]
let generate_namespace = Chatoyant_internal.public_generate_namespace [@@mel.as "Generate"]
let shortcuts_namespace = Chatoyant_internal.public_shortcuts_namespace [@@mel.as "Shortcuts"]
let providers_namespace = Chatoyant_internal.public_providers_namespace [@@mel.as "Providers"]
let defaults_namespace = Chatoyant_internal.public_defaults_namespace [@@mel.as "Defaults"]
let chatoyant_namespace = Chatoyant_internal.public_chatoyant_namespace [@@mel.as "Chatoyant"]
