module Json = Chatoyant.Runtime.Json
module Tool = Chatoyant.Core.Tool

(** Invoice payment status. *)
type billing_status = Pending | Paid [@@deriving chatoyant]

type invoice = {
  vendor : string;  (** Legal vendor name. *)
  total : float; [@minimum 0.]  (** Total amount in USD. *)
  due_date : string option;  (** ISO-8601 due date when present. *)
  tags : string list; [@min_items 1]  (** Search tags. *)
  status : billing_status;  (** Payment status. *)
}
[@@deriving chatoyant]
(** Invoice data extracted from an email. *)

module%tool Calculate = struct
  type operation = Add | Divide

  type request = {
    operation : operation;  (** Operation to apply. *)
    values : float list; [@min_items 1]  (** Numbers to combine in order. *)
    precision : int option;  (** Optional display precision. *)
  }

  type answer = { expression : string; result : float }

  (** Combine numbers with a typed arithmetic operation. *)
  let run : request -> (answer, string) result =
   fun { operation; values; precision = _ } ->
    match values with
    | [] -> Error "at least one value is required"
    | first :: rest ->
        let step acc value =
          match operation with
          | Add -> Ok (acc +. value)
          | Divide ->
              if value = 0.0 then Error "division by zero" else Ok (acc /. value)
        in
        let rec loop acc = function
          | [] -> Ok acc
          | value :: rest -> (
              match step acc value with
              | Ok next -> loop next rest
              | Error _ as err -> err)
        in
        Result.map
          (fun result ->
            {
              expression =
                (match operation with Add -> "add" | Divide -> "divide");
              result;
            })
          (loop first rest)
end

module%tool Multiply_by_env = struct
  type env = { factor : float; decorate : string -> string }
  type request = { value : float  (** Input value. *) }
  type answer = { product : float }

  (** Multiply a value by the configured environment factor. *)
  let run : env -> request -> answer =
   fun env { value } ->
    ignore (env.decorate "called");
    { product = env.factor *. value }
end

module%tool Describe_city = struct
  type location = {
    city : string;  (** City name. *)
    country : string option;  (** Optional country code. *)
  }

  type request = { location : location  (** Location to describe. *) }
  type answer = { label : string }

  (** Format a nested city request. *)
  let run : request -> answer =
   fun { location = { city; country } } ->
    {
      label =
        (match country with
        | None -> city
        | Some country -> city ^ ", " ^ country);
    }
end

let context : Tool.context = { model = "test-model"; provider = Local }

let object_field name = function
  | Json.Object fields -> List.assoc_opt name fields
  | _ -> None

let fail message = failwith message

let assert_equal_float ~message expected actual =
  if Float.abs (expected -. actual) > 0.000001 then
    fail
      (Printf.sprintf "%s: expected %.12g, got %.12g" message expected actual)

let test_direct_run () =
  match
    Calculate.run { operation = Divide; values = [ 83.; 3. ]; precision = None }
  with
  | Error message -> fail ("unexpected direct run error: " ^ message)
  | Ok answer ->
      assert_equal_float ~message:"direct result" (83. /. 3.) answer.result

let test_generated_type_helpers () =
  let json =
    Calculate.request_to_json
      { operation = Divide; values = [ 10.; 2. ]; precision = Some 3 }
  in
  match Calculate.request_of_json json with
  | Ok request ->
      if request.Calculate.operation <> Divide then
        fail "helper decoded wrong operation";
      if request.Calculate.precision <> Some 3 then
        fail "helper decoded wrong option";
      let _schema_json =
        Chatoyant.Schema.Schema.to_json_schema Calculate.request_schema
      in
      ()
  | Error message -> fail ("generated request_of_json failed: " ^ message)

let test_generated_tool_execution () =
  let call : Tool.call =
    {
      id = "call_1";
      name = "calculate";
      arguments =
        Json.Object
          [
            ("operation", Json.String "divide");
            ("values", Json.Array [ Json.Float 83.; Json.Float 3. ]);
          ];
    }
  in
  match Tool.execute_call context call Calculate.tool with
  | { ok = false; error = Some message; _ } ->
      fail ("unexpected tool error: " ^ message)
  | { ok = false; _ } -> fail "unexpected tool error"
  | { value = Some (Json.Object fields); _ } -> (
      match List.assoc_opt "result" fields with
      | Some (Json.Float value) ->
          assert_equal_float ~message:"tool result" (83. /. 3.) value
      | _ -> fail "tool result JSON missing result")
  | _ -> fail "tool result JSON was not an object"

let test_generated_schema_metadata () =
  let schema = Tool.json_schema Calculate.tool in
  let properties =
    match object_field "properties" schema with
    | Some (Json.Object fields) -> fields
    | _ -> fail "schema missing object properties"
  in
  let values_schema =
    match List.assoc_opt "values" properties with
    | Some schema -> schema
    | None -> fail "schema missing values property"
  in
  (match object_field "description" values_schema with
  | Some (Json.String description)
    when String.equal description "Numbers to combine in order." ->
      ()
  | _ -> fail "values schema missing field doc description");
  match object_field "minItems" values_schema with
  | Some (Json.Float 1.) -> ()
  | _ -> fail "values schema missing minItems"

let test_generated_validation () =
  let call : Tool.call =
    {
      id = "call_2";
      name = "calculate";
      arguments =
        Json.Object
          [ ("operation", Json.String "add"); ("values", Json.Array []) ];
    }
  in
  match Tool.execute_call context call Calculate.tool with
  | { ok = false; error = Some message; _ } when String.length message > 0 -> ()
  | _ -> fail "expected validation failure for empty values"

let test_env_tool () =
  let tool = Multiply_by_env.make { factor = 2.5; decorate = Fun.id } in
  let call : Tool.call =
    {
      id = "call_3";
      name = "multiply_by_env";
      arguments = Json.Object [ ("value", Json.Float 4.) ];
    }
  in
  match Tool.execute_call context call tool with
  | { ok = false; error = Some message; _ } ->
      fail ("unexpected env tool error: " ^ message)
  | { value = Some (Json.Object fields); _ } -> (
      match List.assoc_opt "product" fields with
      | Some (Json.Float value) ->
          assert_equal_float ~message:"env tool product" 10. value
      | _ -> fail "env tool result missing product")
  | _ -> fail "env tool result JSON was not an object"

let test_nested_schema_and_optionality () =
  let schema = Tool.json_schema Describe_city.tool in
  let request_properties =
    match object_field "properties" schema with
    | Some (Json.Object fields) -> fields
    | _ -> fail "nested schema missing request properties"
  in
  let location_schema =
    match List.assoc_opt "location" request_properties with
    | Some schema -> schema
    | None -> fail "nested schema missing location property"
  in
  let location_properties =
    match object_field "properties" location_schema with
    | Some (Json.Object fields) -> fields
    | _ -> fail "nested schema missing location properties"
  in
  (match List.assoc_opt "city" location_properties with
  | Some city_schema -> (
      match object_field "description" city_schema with
      | Some (Json.String "City name.") -> ()
      | _ -> fail "nested city description missing")
  | None -> fail "nested schema missing city");
  let call : Tool.call =
    {
      id = "call_4";
      name = "describe_city";
      arguments =
        Json.Object
          [ ("location", Json.Object [ ("city", Json.String "Berlin") ]) ];
    }
  in
  match Tool.execute_call context call Describe_city.tool with
  | { ok = false; error = Some message; _ } ->
      fail ("unexpected nested option decode error: " ^ message)
  | { value = Some (Json.Object fields); _ } -> (
      match List.assoc_opt "label" fields with
      | Some (Json.String "Berlin") -> ()
      | _ -> fail "nested output label mismatch")
  | _ -> fail "nested result JSON was not an object"

let test_deriving_chatoyant_data () =
  let invoice =
    {
      vendor = "Acme";
      total = 42.5;
      due_date = None;
      tags = [ "ops" ];
      status = Pending;
    }
  in
  let json = invoice_to_json invoice in
  (match invoice_of_json json with
  | Ok decoded ->
      if decoded.vendor <> "Acme" then fail "decoded invoice vendor mismatch";
      if decoded.status <> Pending then fail "decoded invoice status mismatch"
  | Error message -> fail ("invoice_of_json failed: " ^ message));
  let schema_json = Chatoyant.Schema.Schema.to_json_schema invoice_schema in
  let properties =
    match object_field "properties" schema_json with
    | Some (Json.Object fields) -> fields
    | _ -> fail "invoice schema missing properties"
  in
  (match object_field "description" schema_json with
  | Some (Json.String "Invoice data extracted from an email.") -> ()
  | _ -> fail "invoice schema missing type doc description");
  (match List.assoc_opt "vendor" properties with
  | Some vendor_schema -> (
      match object_field "description" vendor_schema with
      | Some (Json.String "Legal vendor name.") -> ()
      | _ -> fail "vendor schema missing doc description")
  | None -> fail "invoice schema missing vendor");
  (match List.assoc_opt "status" properties with
  | Some status_schema -> (
      match object_field "enum" status_schema with
      | Some (Json.Array [ Json.String "pending"; Json.String "paid" ]) -> ()
      | _ -> fail "status schema missing enum values")
  | None -> fail "invoice schema missing status");
  let _codec = invoice_codec () in
  ()

let () =
  test_direct_run ();
  test_generated_type_helpers ();
  test_generated_tool_execution ();
  test_generated_schema_metadata ();
  test_generated_validation ();
  test_env_tool ();
  test_nested_schema_and_optionality ();
  test_deriving_chatoyant_data ()
