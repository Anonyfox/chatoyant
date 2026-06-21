# JavaScript Guide

The npm package is generated from the OCaml/Melange implementation and bundled
with esbuild. It exposes a single root import path, ESM plus CJS entrypoints,
and a checked `dist/index.d.ts` file.

## Install Shape

```bash
npm install chatoyant
```

Use the root import for everything:

```ts
import {
  Chat,
  JsonSchema,
  OpenAI,
  Schema,
  Tokens,
  createTool,
  genData,
  genText,
} from "chatoyant";
```

Former subpaths such as `chatoyant/core`, `chatoyant/schema`,
`chatoyant/tokens`, and `chatoyant/providers/openai` intentionally migrate to
root exports and root namespace objects.

## One-Shot Calls

```ts
import { genData, genStream, genText, Schema } from "chatoyant";

const text = await genText("What is 2+2?", {
  model: "gpt-4o",
  system: "Return short answers.",
});

class Person extends Schema {
  name = Schema.String({ description: "Person name" });
  age = Schema.Integer({ minimum: 0 });
}

const person = await genData("Extract: Alice is 30 years old", Person);

for await (const chunk of genStream("Write a haiku about typed APIs.")) {
  process.stdout.write(chunk);
}
```

Provider is detected from the model name unless explicitly set. Standard
provider API key environment variables are used by default.

## Chat Sessions And Tools

```ts
import { Chat, Schema, createTool } from "chatoyant";

const lookup = createTool({
  name: "lookup",
  description: "Lookup data",
  parameters: {
    q: Schema.String({ minLength: 1, description: "Search query" }),
  },
  async execute({ args, ctx }) {
    return { found: args.q, model: ctx.model, provider: ctx.provider };
  },
});

const chat = new Chat({ model: "gpt-4o" });
chat.system("Use tools when useful.");
chat.user("Find needle.");
chat.addTool(lookup);

const result = await chat.generateWithResult({ maxIterations: 4 });
console.log(result.content);
console.log(chat.lastResult?.usage.totalTokens);
console.log(chat.toJSON());
```

`Chat` supports fluent message mutation, tool registration, `generate`,
`generateWithResult`, `stream`, `streamAccumulate`, `generateData`, JSON
roundtrip, clone, and fork.

## Provider Namespaces

Provider helpers are available both as direct exports and through namespaces:

```ts
import { OpenAI, Providers, createOpenAIClient } from "chatoyant";

const direct = createOpenAIClient({ model: "gpt-4o" });
const namespaced = OpenAI.create({ model: "gpt-4o" });
const aggregate = Providers.OpenRouter.create({ model: "openai/gpt-4o" });

const models = await OpenAI.listModelIds();
```

The raw provider clients remain available for explicit provider work while the
unified `Chat` and shortcut functions stay provider-neutral.

## Schema And Tokens

```ts
import { JsonSchema, Schema, Tokens, estimateTokens } from "chatoyant";

const schema = new JsonSchema({ type: "string", minLength: 1 });
console.log(schema.validate("ok"));

const args = {
  q: Schema.String({ minLength: 1 }),
  limit: Schema.Integer({ optional: true, minimum: 1 }),
};

console.log(Schema.toJSON(args));
console.log(estimateTokens("hello world"));
console.log(Tokens.calculateCost({ model: "gpt-4o", inputTokens: 1000, outputTokens: 500 }));
```

## CommonJS

```js
const { Chat, OpenAI, genText } = require("chatoyant");

const text = await genText("Hello", { model: "gpt-4o" });
```

## Published Artifact

`npm run pack:dry-run` should produce a small package containing:

- `package.json`
- `README.md`
- `LICENSE`
- `docs/*.md`
- `dist/index.js`
- `dist/index.cjs`
- `dist/index.d.ts`

The package has no runtime npm dependencies. Build dependencies live only in
the source tree.
