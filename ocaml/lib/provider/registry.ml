type meta = {
  id : Provider.id;
  name : string;
  signatures : string list;
  env_key : string;
  legacy_env_key : string option;
  base_url : string option;
}

let all =
  [
    {
      id = Provider.Openai;
      name = "OpenAI";
      signatures = [ "gpt"; "o1"; "o3"; "o4"; "chatgpt" ];
      env_key = "OPENAI_API_KEY";
      legacy_env_key = Some "API_KEY_OPENAI";
      base_url = Some "https://api.openai.com/v1";
    };
    {
      id = Provider.Anthropic;
      name = "Anthropic";
      signatures = [ "claude" ];
      env_key = "ANTHROPIC_API_KEY";
      legacy_env_key = Some "API_KEY_ANTHROPIC";
      base_url = Some "https://api.anthropic.com/v1";
    };
    {
      id = Provider.Xai;
      name = "xAI";
      signatures = [ "grok" ];
      env_key = "XAI_API_KEY";
      legacy_env_key = Some "API_KEY_XAI";
      base_url = Some "https://api.x.ai/v1";
    };
    {
      id = Provider.Local;
      name = "Local";
      signatures = [];
      env_key = "LOCAL_API_KEY";
      legacy_env_key = None;
      base_url = None;
    };
    {
      id = Provider.Openrouter;
      name = "OpenRouter";
      signatures = [];
      env_key = "OPENROUTER_API_KEY";
      legacy_env_key = Some "API_KEY_OPENROUTER";
      base_url = Some "https://openrouter.ai/api/v1";
    };
  ]

let find id =
  match List.find_opt (fun meta -> meta.id = id) all with
  | Some meta -> meta
  | None -> invalid_arg "unknown provider id"

let lowercase_ascii value = String.lowercase_ascii value

let contains haystack needle =
  let haystack = lowercase_ascii haystack in
  let needle = lowercase_ascii needle in
  let needle_len = String.length needle in
  let haystack_len = String.length haystack in
  let rec loop index =
    if needle_len = 0 then true
    else if index + needle_len > haystack_len then false
    else if String.sub haystack index needle_len = needle then true
    else loop (index + 1)
  in
  loop 0

let detect_by_model model =
  if contains model "/" then Some Provider.Openrouter
  else
    all
    |> List.find_opt (fun meta ->
           meta.signatures |> List.exists (fun signature -> contains model signature))
    |> Option.map (fun meta -> meta.id)

let resolve_by_model ~local_active model =
  match detect_by_model model with
  | Some _ as provider -> provider
  | None -> if local_active then Some Provider.Local else None

let env_keys id =
  let meta = find id in
  (meta.env_key, meta.legacy_env_key)

let base_url id = (find id).base_url
