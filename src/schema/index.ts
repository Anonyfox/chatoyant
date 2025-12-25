/**
 * Schema - A type-safe JSON Schema implementation for validation and serialization.
 *
 * Provides a class-based API for defining data structures that map 1:1 to JSON Schema.
 * Supports all JSON Schema types, validation constraints, and bidirectional conversion.
 *
 * @example
 * ```typescript
 * import { Schema } from 'chatoyant/schema';
 *
 * class Address extends Schema {
 *   street = Schema.String({ description: "Street address" });
 *   city = Schema.String({ description: "City name" });
 *   zip = Schema.String({ pattern: "^\\d{5}$" });
 * }
 *
 * class User extends Schema {
 *   name = Schema.String({ description: "Full name", minLength: 1 });
 *   email = Schema.String({ format: "email", optional: true });
 *   age = Schema.Integer({ minimum: 0, maximum: 150 });
 *   role = Schema.Enum(["admin", "user", "guest"] as const);
 *   tags = Schema.Array(Schema.String(), { minItems: 1 });
 *   address = Schema.Object(Address);
 * }
 *
 * // Create instance with clean proxy access
 * const user = Schema.create(User);
 *
 * // Direct property access (no .value needed)
 * user.name = "Alice";
 * user.age = 30;
 * user.role = "admin";
 *
 * // Get JSON Schema
 * const jsonSchema = Schema.toJSON(user);
 *
 * // Parse and validate data
 * Schema.parse(user, { name: "Bob", age: 25, role: "user", tags: ["new"], address: { ... } });
 *
 * // Extract plain object
 * const plain = Schema.toObject(user);
 * ```
 *
 * @module schema
 */

// Re-export errors
export { SchemaError } from './errors.js';
// Re-export utilities
export { isFieldDescriptor } from './field.js';
export type { InferSchema } from './functions/toObject.js';
export { isProxied, type Proxied } from './proxy.js';
// Re-export types
export type {
  ArrayFieldOptions,
  BaseFieldOptions,
  BooleanFieldOptions,
  EnumFieldOptions,
  FieldDescriptor,
  IntegerFieldOptions,
  JSONSchemaDocument,
  JSONSchemaProperty,
  JSONSchemaType,
  LiteralFieldOptions,
  NumberFieldOptions,
  ObjectFieldOptions,
  SchemaConstructor,
  SchemaInstance,
  StringFieldOptions,
  StringFormat,
} from './types.js';

// Import everything we need to wire together
import * as descriptors from './descriptors/index.js';
import * as functions from './functions/index.js';
import type { Proxied } from './proxy.js';
import type { JSONSchemaDocument, SchemaConstructor, SchemaInstance } from './types.js';

/**
 * Abstract base class for defining type-safe schemas.
 *
 * Extend this class and define fields using the static type methods.
 * Use static functions to create, parse, validate, and serialize instances.
 *
 * @example
 * ```typescript
 * class Product extends Schema {
 *   name = Schema.String({ minLength: 1 });
 *   price = Schema.Number({ minimum: 0 });
 *   inStock = Schema.Boolean({ default: true });
 * }
 * ```
 */
export abstract class Schema {
  // ============================================================================
  // Type Constructors (Capitalized)
  // ============================================================================

  /**
   * Create a string field.
   * @see StringFieldOptions for available options
   */
  static String = descriptors.String;

  /**
   * Create a number field (floating point).
   * @see NumberFieldOptions for available options
   */
  static Number = descriptors.Number;

  /**
   * Create an integer field (whole numbers only).
   * @see IntegerFieldOptions for available options
   */
  static Integer = descriptors.Integer;

  /**
   * Create a boolean field.
   * @see BooleanFieldOptions for available options
   */
  static Boolean = descriptors.Boolean;

  /**
   * Create a null field.
   */
  static Null = descriptors.Null;

  /**
   * Create an array field with typed items.
   * @see ArrayFieldOptions for available options
   */
  static Array = descriptors.Array;

  /**
   * Create a nested object field from another Schema class.
   * @see ObjectFieldOptions for available options
   */
  static Object = descriptors.Object;

  /**
   * Create an enum field with specific allowed values.
   * Use `as const` for literal type inference.
   * @see EnumFieldOptions for available options
   */
  static Enum = descriptors.Enum;

  /**
   * Create a literal (const) field with an exact value.
   * @see LiteralFieldOptions for available options
   */
  static Literal = descriptors.Literal;

  // ============================================================================
  // Static Functions (camelCase)
  // ============================================================================

  /**
   * Create a new proxied schema instance.
   *
   * @param SchemaClass - The Schema class to instantiate
   * @returns A proxied instance with clean property access
   */
  static create<T extends SchemaInstance>(SchemaClass: SchemaConstructor<T>): Proxied<T> {
    return functions.create(SchemaClass);
  }

  /**
   * Validate and populate a schema instance with data.
   * Throws SchemaError if validation fails.
   *
   * @param instance - The schema instance (proxied or raw)
   * @param data - The data to parse
   */
  static parse<T extends SchemaInstance>(instance: T | Proxied<T>, data: unknown): void {
    functions.parse(instance, data);
  }

  /**
   * Validate data against a schema without modifying the instance.
   *
   * @param instance - The schema instance (proxied or raw)
   * @param data - The data to validate
   * @returns true if valid, false otherwise
   */
  static validate<T extends SchemaInstance>(instance: T | Proxied<T>, data: unknown): boolean {
    return functions.validate(instance, data);
  }

  /**
   * Generate a JSON Schema document from a schema instance.
   *
   * @param instance - The schema instance (proxied or raw)
   * @returns JSON Schema object conforming to draft 2020-12
   */
  static toJSON<T extends SchemaInstance>(instance: T | Proxied<T>): JSONSchemaDocument {
    return functions.toJSON(instance);
  }

  /**
   * Generate a JSON Schema string from a schema instance.
   *
   * @param instance - The schema instance (proxied or raw)
   * @param pretty - Whether to pretty-print (default: true)
   * @returns JSON Schema as a string
   */
  static stringify<T extends SchemaInstance>(instance: T | Proxied<T>, pretty = true): string {
    return functions.stringify(instance, pretty);
  }

  /**
   * Extract a plain JavaScript object from a schema instance.
   *
   * @param instance - The schema instance (proxied or raw)
   * @returns Plain object with field values
   */
  static toObject<T extends SchemaInstance>(instance: T | Proxied<T>): functions.InferSchema<T> {
    return functions.toObject(instance);
  }

  /**
   * Create a deep clone of a schema instance.
   *
   * @param instance - The schema instance (proxied or raw)
   * @returns A new proxied instance with cloned values
   */
  static clone<T extends SchemaInstance>(instance: T | Proxied<T>): Proxied<T> {
    return functions.clone(instance);
  }
}
