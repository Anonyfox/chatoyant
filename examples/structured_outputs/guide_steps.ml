type invoice = { vendor : string; total_cents : int }

let invoice_codec =
  let open Chatoyant.Schema.Codec in
  object2
    (field "vendor" (string ()) ~get:(fun invoice -> invoice.vendor))
    (field "total_cents" (int ()) ~get:(fun invoice -> invoice.total_cents))
    (fun vendor total_cents -> { vendor; total_cents })

let extract_invoice env =
  let client = Chatoyant.xai ~model:"grok-4.7" env in
  let result =
    Chatoyant.gen_data ~name:"invoice" ~strict:true ~codec:invoice_codec
      ~max_tokens:256 client "Extract invoice: Acme charged 1250 cents."
  in
  match result with
  | Ok invoice ->
      Printf.printf "%s: %d cents\n" invoice.vendor invoice.total_cents
  | Error error -> prerr_endline (Chatoyant.Error.provider error)

let validate_invoice_json text =
  match Chatoyant.Runtime.Json.parse text with
  | Error message -> Error message
  | Ok json -> (
      let schema = Chatoyant.Schema.Codec.to_json_schema invoice_codec in
      match Chatoyant.Schema.Json_schema.validate_json schema json with
      | Error error -> Error error.message
      | Ok report -> Ok report)
