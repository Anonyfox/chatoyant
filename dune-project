(lang dune 3.23)
(using melange 1.0)

(name chatoyant)
(version 0.12.0)
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
  (ocaml (>= 5.3))
  (dune (>= 3.23))
  (melange (>= 6.0.0))
  (ca-certs (>= 1.0.0))
  base64
  (cohttp-eio (>= 6.0.0))
  digestif
  domain-name
  (eio (>= 1.0))
  (eio_main :with-test)
  (http (>= 6.0.0))
  (mirage-crypto-rng (>= 1.0.0))
  (ppxlib :build)
  (tls (>= 1.0.0))
  (tls-eio (>= 1.0.0))
  uri
  (x509 (>= 1.0.0))))
