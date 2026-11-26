type status = Active | Deprecated | Retired

type info = {
  status : status;
  deprecated_on : string option;
  retires_on : string option;
  replacement : string option;
  note : string option;
}

let retired =
  {
    status = Retired;
    deprecated_on = None;
    retires_on = None;
    replacement = None;
    note = None;
  }

let entry = function
  | "grok-build-0.1" -> Some { retired with retires_on = Some "2026-11-19" }
  | "claude-opus-4-5" ->
      Some
        {
          status = Deprecated;
          deprecated_on = Some "2026-11-23";
          retires_on = Some "2027-01-22";
          replacement = Some "claude-opus-5-5";
          note = None;
        }
  | "claude-opus-4-1" | "claude-sonnet-4-20250514" | "claude-sonnet-4-0"
  | "claude-opus-4-20250514" | "claude-opus-4-0" | "claude-3-5-sonnet-20241022"
  | "claude-3-5-sonnet-20240620" | "claude-3-5-haiku-20241022"
  | "claude-3-opus-20240229" | "claude-3-haiku-20240307"
  | "grok-4-1-fast-reasoning" | "grok-4-1-fast-non-reasoning"
  | "grok-4-fast-reasoning" | "grok-4-fast-non-reasoning" | "grok-4-0709"
  | "grok-4" | "grok-code-fast-1" | "grok-3" | "grok-3-mini"
  | "grok-2-vision-1212" | "grok-2-image-1212" ->
      Some retired
  | _ -> None

let lifecycle model =
  let id = String.lowercase_ascii model in
  match entry id with
  | Some _ as info -> info
  | None ->
      let n = String.length id in
      if
        n > 9
        && id.[n - 9] = '-'
        && String.for_all
             (function '0' .. '9' -> true | _ -> false)
             (String.sub id (n - 8) 8)
      then entry (String.sub id 0 (n - 9))
      else None

let warning model =
  let suffix prefix = Option.fold ~none:"" ~some:(( ^ ) prefix) in
  match lifecycle model with
  | None | Some { status = Active; _ } -> None
  | Some info ->
      let detail =
        match info.status with
        | Deprecated ->
            "deprecated"
            ^ suffix " on " info.deprecated_on
            ^ suffix ", with API retirement on " info.retires_on
        | Retired -> "retired" ^ suffix " on " info.retires_on
        | Active -> assert false
      in
      Some
        ("Chatoyant: " ^ model ^ " is " ^ detail ^ " on the first-party API."
        ^ suffix " Recommended replacement: " info.replacement)

let handler = Atomic.make prerr_endline
let set_warning_handler = Atomic.set handler
let warned = Atomic.make []

let rec claim id =
  let seen = Atomic.get warned in
  if List.mem id seen then false
  else Atomic.compare_and_set warned seen (id :: seen) || claim id

let warn_once model =
  match warning model with
  | Some message when claim (String.lowercase_ascii model) -> (
      try (Atomic.get handler) message with _ -> ())
  | _ -> ()
