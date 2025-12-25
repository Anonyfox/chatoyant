/**
 * Schema parsing (validate + populate) function.
 *
 * @module schema/functions/parse
 */

import { isFieldDescriptor } from '../field.js';
import { getRawInstance, isProxied, type Proxied } from '../proxy.js';
import type { FieldDescriptor, SchemaInstance } from '../types.js';
import { validateOrThrow } from './validate.js';

/**
 * Populate a field descriptor with a value.
 */
function populateField(field: FieldDescriptor, value: unknown): void {
  // Handle missing values (undefined) - keep default
  if (value === undefined) {
    // Keep default value for optional fields or fields with defaults
    return;
  }

  // Handle null values
  if (value === null) {
    if (field.options.optional || field.type === 'null') {
      // Keep default value for optional fields, or set null for null type
      if (field.type === 'null') {
        field.value = null;
      }
      return;
    }
  }

  switch (field.type) {
    case 'array':
      if (Array.isArray(value) && field.items) {
        // For arrays of objects, we need to recursively populate
        if (field.items.type === 'object' && field.items.schema) {
          field.value = value.map((item) => {
            const nestedInstance = new field.items!.schema!();
            populateInstance(nestedInstance, item as Record<string, unknown>);
            return nestedInstance;
          });
        } else {
          field.value = [...value];
        }
      } else {
        field.value = value;
      }
      break;

    case 'object':
      if (field.schema && typeof value === 'object' && value !== null) {
        const nestedInstance = new field.schema();
        populateInstance(nestedInstance, value as Record<string, unknown>);
        field.value = nestedInstance;
      }
      break;

    default:
      field.value = value;
  }
}

/**
 * Populate a schema instance with data.
 */
function populateInstance(instance: SchemaInstance, data: Record<string, unknown>): void {
  for (const [key, field] of Object.entries(instance)) {
    if (isFieldDescriptor(field)) {
      const value = data[key];
      populateField(field, value);
    }
  }
}

/**
 * Validate and populate a schema instance with data.
 * Throws SchemaError if validation fails.
 *
 * @param instance - The schema instance (proxied or raw)
 * @param data - The data to parse
 * @throws SchemaError if validation fails
 *
 * @example
 * ```typescript
 * class User extends Schema {
 *   name = Schema.String({ minLength: 1 });
 *   age = Schema.Integer({ minimum: 0 });
 * }
 *
 * const user = Schema.create(User);
 *
 * Schema.parse(user, { name: "Alice", age: 30 });
 * console.log(user.name); // "Alice"
 * console.log(user.age);  // 30
 *
 * // Throws SchemaError for invalid data:
 * Schema.parse(user, { name: "", age: -1 });
 * ```
 */
export function parse<T extends SchemaInstance>(instance: T | Proxied<T>, data: unknown): void {
  const raw = isProxied(instance) ? getRawInstance(instance) : instance;

  // Validate first (throws on error)
  validateOrThrow(instance, data);

  // Populate the instance
  populateInstance(raw, data as Record<string, unknown>);
}
