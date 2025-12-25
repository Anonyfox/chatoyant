/**
 * Tool class for agentic tool-calling.
 *
 * Provides a type-safe way to define tools with Schema-based
 * parameter validation and optional result validation.
 *
 * @module core/tool
 */

import { Schema } from '../schema/index.js';
import type { JSONSchemaDocument, SchemaInstance } from '../schema/types.js';

/**
 * Tool execution context.
 */
export interface ToolContext {
  /** Current model being used */
  model: string;
  /** Current provider */
  provider: string;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Tool execution input.
 */
export interface ToolInput<TArgs = unknown> {
  /** Parsed and validated arguments */
  args: TArgs;
  /** Execution context */
  ctx: ToolContext;
}

/**
 * Tool definition options.
 */
export interface ToolDefinition<TArgs = unknown, TResult = unknown> {
  /** Unique tool name (function name for the LLM) */
  name: string;

  /** Description of what the tool does */
  description: string;

  /** Parameter schema (Schema class instance or constructor) */
  parameters: SchemaInstance | (new () => SchemaInstance);

  /**
   * Execute function.
   * Receives validated args and context, returns result.
   */
  execute: (input: ToolInput<TArgs>) => Promise<TResult>;

  /**
   * Optional result schema for validation.
   */
  resultSchema?: SchemaInstance | (new () => SchemaInstance);

  /**
   * Timeout for this tool in milliseconds.
   * @default 10000
   */
  timeout?: number;
}

/**
 * Serialized tool call from the LLM.
 */
export interface ToolCall {
  /** Tool call ID (for response matching) */
  id: string;
  /** Tool name */
  name: string;
  /** Raw arguments (JSON-parsed) */
  args: unknown;
}

/**
 * Tool execution result.
 */
export interface ToolResult {
  /** Tool call ID */
  id: string;
  /** Result data or error */
  result: unknown;
  /** Whether execution succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Tool class for defining callable tools.
 *
 * @example
 * ```typescript
 * class WeatherParams extends Schema {
 *   city = Schema.String({ description: "City name" });
 *   unit = Schema.Enum(["celsius", "fahrenheit"] as const, { optional: true });
 * }
 *
 * const weatherTool = new Tool({
 *   name: "get_weather",
 *   description: "Get current weather for a city",
 *   parameters: WeatherParams,
 *   execute: async ({ args }) => {
 *     const weather = await fetchWeather(args.city);
 *     return { temperature: weather.temp, conditions: weather.sky };
 *   },
 * });
 *
 * chat.addTool(weatherTool);
 * ```
 */
export class Tool<TArgs = unknown, TResult = unknown> {
  /** Tool name */
  readonly name: string;

  /** Tool description */
  readonly description: string;

  /** Parameter schema instance */
  readonly parameters: SchemaInstance;

  /** Result schema instance (optional) */
  readonly resultSchema?: SchemaInstance;

  /** Execution timeout */
  readonly timeout: number;

  /** Execute function */
  private readonly executeFn: (input: ToolInput<TArgs>) => Promise<TResult>;

  constructor(definition: ToolDefinition<TArgs, TResult>) {
    if (!definition.name || typeof definition.name !== 'string') {
      throw new TypeError('Tool name is required and must be a string');
    }
    if (!definition.description || typeof definition.description !== 'string') {
      throw new TypeError('Tool description is required and must be a string');
    }
    if (!definition.parameters) {
      throw new TypeError('Tool parameters schema is required');
    }
    if (typeof definition.execute !== 'function') {
      throw new TypeError('Tool execute function is required');
    }

    this.name = definition.name;
    this.description = definition.description;
    this.timeout = definition.timeout ?? 10_000;
    this.executeFn = definition.execute;

    // Instantiate schema if constructor passed
    this.parameters =
      typeof definition.parameters === 'function'
        ? Schema.create(definition.parameters)
        : definition.parameters;

    if (definition.resultSchema) {
      this.resultSchema =
        typeof definition.resultSchema === 'function'
          ? Schema.create(definition.resultSchema)
          : definition.resultSchema;
    }
  }

  /**
   * Get JSON Schema for parameters.
   */
  getParametersSchema(): JSONSchemaDocument {
    return Schema.toJSON(this.parameters);
  }

  /**
   * Validate arguments against parameter schema.
   */
  validateArgs(args: unknown): boolean {
    return Schema.validate(this.parameters, args);
  }

  /**
   * Parse and validate arguments.
   * Throws SchemaError if invalid.
   */
  parseArgs(args: unknown): TArgs {
    const instance = Schema.clone(this.parameters);
    Schema.parse(instance, args);
    return Schema.toObject(instance) as TArgs;
  }

  /**
   * Validate result against result schema (if defined).
   */
  validateResult(result: unknown): boolean {
    if (!this.resultSchema) return true;
    return Schema.validate(this.resultSchema, result);
  }

  /**
   * Execute the tool with validated arguments.
   */
  async execute(input: ToolInput<TArgs>): Promise<TResult> {
    return this.executeFn(input);
  }

  /**
   * Execute with timeout.
   */
  async executeWithTimeout(input: ToolInput<TArgs>): Promise<TResult> {
    return withTimeout(this.executeFn(input), this.timeout);
  }

  /**
   * Execute a tool call (validates args, executes, validates result).
   * Returns ToolResult with success/error info.
   */
  async executeCall(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    try {
      // Validate arguments
      if (!this.validateArgs(call.args)) {
        return {
          id: call.id,
          result: null,
          success: false,
          error: `Invalid arguments for tool ${this.name}`,
        };
      }

      // Parse args
      const args = this.parseArgs(call.args);

      // Execute with timeout
      const result = await this.executeWithTimeout({ args, ctx });

      // Validate result
      if (!this.validateResult(result)) {
        return {
          id: call.id,
          result: null,
          success: false,
          error: `Invalid result from tool ${this.name}`,
        };
      }

      return {
        id: call.id,
        result,
        success: true,
      };
    } catch (error) {
      return {
        id: call.id,
        result: null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Helper to create a tool with type inference.
 */
export function createTool<TArgs, TResult>(
  definition: ToolDefinition<TArgs, TResult>,
): Tool<TArgs, TResult> {
  return new Tool(definition);
}

/**
 * Execute a promise with timeout.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Tool execution timed out')), ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
