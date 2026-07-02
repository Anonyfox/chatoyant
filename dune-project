(lang dune 3.23)
(using melange 1.0)

(name chatoyant)
(version 0.11.1)
(generate_opam_files true)
(authors "Anonyfox <max@anonyfox.com>")
(maintainers "Anonyfox <max@anonyfox.com>")
(source (github Anonyfox/chatoyant))

(package
 (name chatoyant)
 (synopsis "OCaml-first LLM SDK with Melange-generated JavaScript")
 (description
  "Chatoyant is an OCaml-first SDK for LLM providers. It exposes an Eio native API, typed JSON Schema and tool definitions, raw provider clients for OpenAI/Anthropic/xAI/OpenRouter/local inference, and a Melange-generated JavaScript package.")
 (license MIT)
 (tags
  (llm ai openai anthropic xai openrouter json-schema eio melange typesafe))
 (homepage "https://github.com/Anonyfox/chatoyant")
 (bug_reports "https://github.com/Anonyfox/chatoyant/issues")
 (documentation "https://anonyfox.github.io/chatoyant")
 (depends
  (ocaml (>= 5.1))
  (dune (>= 3.23))
  (melange (>= 6.0.0))
  ca-certs
  base64
  cohttp-eio
  digestif
  domain-name
  (eio (>= 1.0))
  (eio_main :with-test)
  http
  mirage-crypto-rng
  (ppxlib :build)
  tls
  tls-eio
  uri
  x509))
