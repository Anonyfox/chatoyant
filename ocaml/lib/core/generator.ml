module Make
    (Provider : Chatoyant_provider.Provider.CHAT)
    (Clock : Chatoyant_runtime.Effect.CLOCK) =
struct
  let provider_options (options : Options.t) chat =
    let reasoning_effort = Option.map Options.reasoning_effort options.reasoning in
    let thinking_budget =
      match options.thinking_budget with
      | Some _ as value -> value
      | None -> Option.bind options.reasoning Options.anthropic_thinking_budget
    in
    {
      Chatoyant_provider.Provider.model =
        Option.value options.Options.model ~default:(Chat.model chat);
      temperature =
        (match options.temperature with
        | Some value -> Some value
        | None -> Option.map Options.temperature_of_creativity options.creativity);
      max_tokens = options.max_tokens;
      top_p = options.top_p;
      stop = options.stop;
      frequency_penalty = options.frequency_penalty;
      presence_penalty = options.presence_penalty;
      web_search = options.web_search;
      thinking_budget;
      reasoning_effort;
      timeout_ms = options.timeout_ms;
      tools = List.map Tool.to_provider_definition (Chat.tools chat);
      tool_choice = None;
      extra = options.extra;
    }

  let generate ?(options = Options.default) chat =
    let started = Clock.now_ms () in
    let provider_messages = List.map Message.to_provider_message (Chat.messages chat) in
    let provider_options = provider_options options chat in
    match Provider.generate provider_messages provider_options with
    | Error error -> Error error
    | Ok generation ->
        let finished = Clock.now_ms () in
        let latency_ms = max 0 (finished - started) in
        let usage = Chatoyant_tokens.Cost.normalize_total generation.usage in
        let cost_result =
          Chatoyant_tokens.Cost.calculate
            ~pricing:(Chatoyant_tokens.Pricing.get provider_options.model)
            usage
        in
        Ok
          {
            Result.content = generation.content;
            reasoning_content = generation.reasoning_content;
            usage;
            usage_source = generation.usage_source;
            timing = { latency_ms; time_to_first_token_ms = None };
            token_speed = Result.token_speed ~latency_ms usage;
            cost = { estimated_usd = cost_result.total; actual_usd = cost_result.actual_usd };
            provider = Provider.id;
            model = provider_options.model;
            tool_calls = generation.tool_calls;
            finish_reason = generation.finish_reason;
            cached = usage.cached_tokens > 0;
            iterations = 1;
          }
end
