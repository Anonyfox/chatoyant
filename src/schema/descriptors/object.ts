/**
 * Object (nested schema) field descriptor factory.
 *
 * @module schema/descriptors/object
 */

import { createFieldDescriptor } from '../field.js';
import type { FieldDescriptor, ObjectFieldOptions, SchemaConstructor } from '../types.js';

/**
 * Infer the type of a schema instance for nested objects.
 */
type InferSchemaType<S extends SchemaConstructor> =
  S extends SchemaConstructor<infer T> ? T : never;

/**
 * Create an object field descriptor for nested schemas.
 *
 * @param schema - The nested Schema class constructor
 * @param options - Object field configuration
 * @returns Field descriptor for nested object values
 *
 * @example
 * ```typescript
 * class Address extends Schema {
 *   street = String();
 *   city = String();
 * }
 *
 * class User extends Schema {
 *   name = String();
 *   address = Object(Address, { description: "Home address" });
 * }
 * ```
 */
export function Object<S extends SchemaConstructor>(
  schema: S,
  options: ObjectFieldOptions = {},
): FieldDescriptor<InferSchemaType<S>> {
  // Create a default instance to use as the default value
  const defaultInstance = new schema();

  return createFieldDescriptor(
    'object',
    defaultInstance as InferSchemaType<S>,
    {
      description: options.description,
      optional: options.optional,
    },
    {
      schema,
    },
  );
}
