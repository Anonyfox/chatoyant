let version = Chatoyant_internal.version

let default_timeout = 120_000 [@@mel.as "DEFAULT_TIMEOUT"]
let default_retries = 3 [@@mel.as "DEFAULT_RETRIES"]
let default_tool_timeout = 10_000 [@@mel.as "DEFAULT_TOOL_TIMEOUT"]
let default_max_tool_iterations = 8 [@@mel.as "DEFAULT_MAX_TOOL_ITERATIONS"]

let message = Chatoyant_internal.public_message [@@mel.as "Message"]
let json_schema_class = Chatoyant_internal.public_json_schema_class [@@mel.as "JsonSchema"]
let schema_class = Chatoyant_internal.public_schema_class [@@mel.as "Schema"]
let schema_error = Chatoyant_internal.public_schema_error [@@mel.as "SchemaError"]
let provider_error = Chatoyant_internal.public_provider_error [@@mel.as "ProviderError"]
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
let tokens_namespace = Chatoyant_internal.public_tokens_namespace [@@mel.as "Tokens"]
let generate_namespace = Chatoyant_internal.public_generate_namespace [@@mel.as "Generate"]
let shortcuts_namespace = Chatoyant_internal.public_shortcuts_namespace [@@mel.as "Shortcuts"]
let providers_namespace = Chatoyant_internal.public_providers_namespace [@@mel.as "Providers"]
let defaults_namespace = Chatoyant_internal.public_defaults_namespace [@@mel.as "Defaults"]
let chatoyant_namespace = Chatoyant_internal.public_chatoyant_namespace [@@mel.as "Chatoyant"]

let providers = Chatoyant_internal.public_providers [@@mel.as "PROVIDERS"]
let provider_ids = Chatoyant_internal.public_provider_ids [@@mel.as "PROVIDER_IDS"]
let openai_models = Chatoyant_internal.public_openai_models [@@mel.as "OPENAI_MODELS"]
let anthropic_models = Chatoyant_internal.public_anthropic_models [@@mel.as "ANTHROPIC_MODELS"]
let xai_models = Chatoyant_internal.public_xai_models [@@mel.as "XAI_MODELS"]
let models_by_provider = Chatoyant_internal.public_models_by_provider [@@mel.as "MODELS_BY_PROVIDER"]

let detect_provider_by_model =
  Chatoyant_internal.public_detect_provider_by_model [@@mel.as "detectProviderByModel"]

let is_provider_active = Chatoyant_internal.public_is_provider_active [@@mel.as "isProviderActive"]
let active_providers = Chatoyant_internal.public_active_providers [@@mel.as "activeProviders"]

let assert_provider_active =
  Chatoyant_internal.public_assert_provider_active [@@mel.as "assertProviderActive"]

let get_api_key = Chatoyant_internal.public_get_api_key [@@mel.as "getApiKey"]
let get_base_url = Chatoyant_internal.public_get_base_url [@@mel.as "getBaseUrl"]
let resolve_provider = Chatoyant_internal.public_resolve_provider [@@mel.as "resolveProvider"]

let get_models_for_provider =
  Chatoyant_internal.public_get_models_for_provider [@@mel.as "getModelsForProvider"]

let get_all_known_models = Chatoyant_internal.public_get_all_known_models [@@mel.as "getAllKnownModels"]
let is_known_model = Chatoyant_internal.public_is_known_model [@@mel.as "isKnownModel"]

let context_windows = Chatoyant_internal.public_context_windows [@@mel.as "CONTEXT_WINDOWS"]
let pricing = Chatoyant_internal.public_pricing [@@mel.as "PRICING"]
let token_ratios = Chatoyant_internal.public_token_ratios [@@mel.as "TOKEN_RATIOS"]

let estimate_tokens = Chatoyant_internal.public_estimate_tokens [@@mel.as "estimateTokens"]

let estimate_prompt_tokens =
  Chatoyant_internal.public_estimate_prompt_tokens [@@mel.as "estimatePromptTokens"]

let estimate_tokens_many = Chatoyant_internal.public_estimate_tokens_many [@@mel.as "estimateTokensMany"]

let estimate_tokens_with_ratio =
  Chatoyant_internal.public_estimate_tokens_with_ratio [@@mel.as "estimateTokensWithRatio"]

let estimate_message_tokens =
  Chatoyant_internal.public_estimate_message_tokens [@@mel.as "estimateMessageTokens"]

let estimate_chat_tokens =
  Chatoyant_internal.public_estimate_chat_tokens [@@mel.as "estimateChatTokens"]

let estimate_system_prompt_tokens =
  Chatoyant_internal.public_estimate_system_prompt_tokens [@@mel.as "estimateSystemPromptTokens"]

let get_message_overhead = Chatoyant_internal.public_get_message_overhead [@@mel.as "getMessageOverhead"]

let calculate_available_tokens =
  Chatoyant_internal.public_calculate_available_tokens [@@mel.as "calculateAvailableTokens"]

let messages_fit_budget = Chatoyant_internal.public_messages_fit_budget [@@mel.as "messagesFitBudget"]
let calculate_cost = Chatoyant_internal.public_calculate_cost [@@mel.as "calculateCost"]
let calculate_cost_custom = Chatoyant_internal.public_calculate_cost_custom [@@mel.as "calculateCostCustom"]
let calculate_batch_cost = Chatoyant_internal.public_calculate_batch_cost [@@mel.as "calculateBatchCost"]
let calculate_image_cost = Chatoyant_internal.public_calculate_image_cost [@@mel.as "calculateImageCost"]
let calculate_video_cost = Chatoyant_internal.public_calculate_video_cost [@@mel.as "calculateVideoCost"]
let estimate_cost = Chatoyant_internal.public_estimate_cost [@@mel.as "estimateCost"]
let get_cost_per_token = Chatoyant_internal.public_get_cost_per_token [@@mel.as "getCostPerToken"]
let get_pricing = Chatoyant_internal.public_get_pricing [@@mel.as "getPricing"]
let has_pricing = Chatoyant_internal.public_has_pricing [@@mel.as "hasPricing"]
let get_context_window = Chatoyant_internal.public_get_context_window [@@mel.as "getContextWindow"]
let has_context_window = Chatoyant_internal.public_has_context_window [@@mel.as "hasContextWindow"]
let split_text = Chatoyant_internal.public_split_text [@@mel.as "splitText"]
let truncate_content = Chatoyant_internal.public_truncate_content [@@mel.as "truncateContent"]
let fit_messages = Chatoyant_internal.public_fit_messages [@@mel.as "fitMessages"]
let paginate_messages = Chatoyant_internal.public_paginate_messages [@@mel.as "paginateMessages"]
let estimate_chunk_count = Chatoyant_internal.public_estimate_chunk_count [@@mel.as "estimateChunkCount"]
