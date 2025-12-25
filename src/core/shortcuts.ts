/**
 * One-shot convenience functions for quick LLM interactions.
 *
 * These are the simplest possible interface - single function calls
 * for common use cases without needing to manage Chat instances.
 *
 * @module core/shortcuts
 */

import type { SchemaInstance } from '../schema/index.js';
import { Chat } from './chat.js';
import type { GenerateOptions, StreamOptions } from './options.js';

/**
 * Options for one-shot text generation.
 */
export interface GenTextOptions extends GenerateOptions {
  /** System prompt */
  system?: string;
  /** Model to use */
  model?: string;
}

/**
 * Options for one-shot structured data generation.
 */
export interface GenDataOptions extends GenerateOptions {
  /** System prompt */
  system?: string;
  /** Model to use */
  model?: string;
}

/**
 * Options for one-shot streaming.
 */
export interface GenStreamOptions extends StreamOptions {
  /** System prompt */
  system?: string;
  /** Model to use */
  model?: string;
}

/**
 * Generate text from an LLM in a single call.
 *
 * @example
 * ```typescript
 * // Simplest possible
 * const answer = await genText("What is 2+2?");
 *
 * // With system prompt
 * const poem = await genText("Write a haiku about coding", {
 *   system: "You are a creative poet",
 * });
 *
 * // With model and options
 * const analysis = await genText("Analyze this data", {
 *   model: "gpt-4o",
 *   system: "You are a data analyst",
 *   temperature: 0.3,
 * });
 * ```
 *
 * @param prompt - User prompt
 * @param options - Optional configuration
 * @returns Generated text
 */
export async function genText(prompt: string, options?: GenTextOptions): Promise<string> {
  const chat = new Chat({ model: options?.model });

  if (options?.system) {
    chat.system(options.system);
  }

  chat.user(prompt);

  return chat.generate(options);
}

/**
 * Generate structured data from an LLM in a single call.
 *
 * @example
 * ```typescript
 * class Person extends Schema {
 *   name = Schema.String();
 *   age = Schema.Integer();
 * }
 *
 * const person = await genData(
 *   "Extract: Alice is 30 years old",
 *   Person
 * );
 *
 * console.log(person.name); // "Alice"
 * console.log(person.age);  // 30
 * ```
 *
 * @param prompt - User prompt
 * @param schema - Schema class or instance
 * @param options - Optional configuration
 * @returns Populated schema instance
 */
export async function genData<T extends SchemaInstance>(
  prompt: string,
  schema: T | (new () => T),
  options?: GenDataOptions,
): Promise<T> {
  const chat = new Chat({ model: options?.model });

  if (options?.system) {
    chat.system(options.system);
  }

  chat.user(prompt);

  return chat.generateData(schema, options);
}

/**
 * Stream text from an LLM in a single call.
 *
 * @example
 * ```typescript
 * // Basic streaming
 * for await (const chunk of genStream("Tell me a story")) {
 *   process.stdout.write(chunk);
 * }
 *
 * // With options
 * for await (const chunk of genStream("Write a poem", {
 *   system: "You are a poet",
 *   model: "claude-sonnet-4-20250514",
 * })) {
 *   process.stdout.write(chunk);
 * }
 * ```
 *
 * @param prompt - User prompt
 * @param options - Optional configuration
 * @returns Async generator of text chunks
 */
export async function* genStream(
  prompt: string,
  options?: GenStreamOptions,
): AsyncGenerator<string, void, undefined> {
  const chat = new Chat({ model: options?.model });

  if (options?.system) {
    chat.system(options.system);
  }

  chat.user(prompt);

  yield* chat.stream(options);
}

/**
 * Stream text and accumulate the full response.
 *
 * @example
 * ```typescript
 * const story = await genStreamAccumulate("Tell me a story", {
 *   onDelta: (chunk) => process.stdout.write(chunk),
 * });
 *
 * console.log("\n\nFull story:", story);
 * ```
 *
 * @param prompt - User prompt
 * @param options - Optional configuration
 * @returns Full accumulated text
 */
export async function genStreamAccumulate(
  prompt: string,
  options?: GenStreamOptions,
): Promise<string> {
  const chat = new Chat({ model: options?.model });

  if (options?.system) {
    chat.system(options.system);
  }

  chat.user(prompt);

  return chat.streamAccumulate(options);
}
