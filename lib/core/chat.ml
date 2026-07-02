type t = {
  model : string;
  defaults : Options.t;
  messages : Message.t list;
  tools : Tool.t list;
}

let create ?(model = "gpt-4o") ?(defaults = Options.default) () =
  { model; defaults; messages = []; tools = [] }

let model chat = chat.model
let messages chat = List.rev chat.messages
let tools chat = List.rev chat.tools
let add_message message chat = { chat with messages = message :: chat.messages }
let add_tool tool chat = { chat with tools = tool :: chat.tools }
let system content chat = add_message (Message.system content) chat
let user content chat = add_message (Message.user content) chat
let assistant content chat = add_message (Message.assistant content) chat
let clear_messages chat = { chat with messages = [] }
let clear_tools chat = { chat with tools = [] }
