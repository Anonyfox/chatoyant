import { genData, genText, Schema } from "chatoyant";

const text = await genText("Explain what an LLM SDK does in one sentence.", {
  model: "gpt-6.1-sol",
  maxTokens: 128,
});
console.log(text);

class Person extends Schema {
  name = Schema.String();
  age = Schema.Integer({ minimum: 0 });
}

const person = await genData("Extract: Alice is 30 years old.", Person, {
  model: "gpt-6.1-sol",
  maxTokens: 128,
});
console.log(person);
