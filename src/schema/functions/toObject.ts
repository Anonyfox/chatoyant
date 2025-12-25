/**
 * Plain object extraction function.
 *
 * @module schema/functions/toObject
 */

import { isFieldDescriptor } from '../field.js';
import { getRawInstance, isProxied, type Proxied } from '../proxy.js';
import type { FieldDescriptor, SchemaInstance } from '../types.js';

/**
 * Extract value from a field descriptor recursively.
 */
function extractFieldValue(field: FieldDescriptor): unknown {
  const value = field.value;

  switch (field.type) {
    case 'array':
      if (Array.isArray(value)) {
        return value.map((item) => {
          // Check if item is a schema instance
          if (typeof item === 'object' && item !== null) {
            const hasFields = Object.values(item).some(isFieldDescriptor);
            if (hasFields) {
              return extractInstance(item as SchemaInstance);
            }
          }
          return item;
        });
      }
      return value;

    case 'object':
      if (typeof value === 'object' && value !== null) {
        const hasFields = Object.values(value).some(isFieldDescriptor);
        if (hasFields) {
          return extractInstance(value as SchemaInstance);
        }
      }
      return value;

    default:
      return value;
  }
}

/**
 * Extract plain object from a schema instance.
 */
function extractInstance(instance: SchemaInstance): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, field] of Object.entries(instance)) {
    if (isFieldDescriptor(field)) {
      result[key] = extractFieldValue(field);
    }
  }

  return result;
}

/**
 * Type helper to infer the plain object type from a schema.
 * Extracts value types from field descriptors.
 */
export type InferSchema<T extends SchemaInstance> = {
  [K in keyof T as T[K] extends FieldDescriptor ? K : never]: T[K] extends FieldDescriptor<infer V>
    ? V extends SchemaInstance
      ? InferSchema<V>
      : V
    : never;
};

/**
 * Extract a plain JavaScript object from a schema instance.
 *
 * @param instance - The schema instance (proxied or raw)
 * @returns Plain object with field values
 *
 * @example
 * ```typescript
 * class User extends Schema {
 *   name = Schema.String();
 *   age = Schema.Integer();
 * }
 *
 * const user = Schema.create(User);
 * user.name = "Alice";
 * user.age = 30;
 *
 * const plain = Schema.toObject(user);
 * // { name: "Alice", age: 30 }
 * ```
 */
export function toObject<T extends SchemaInstance>(instance: T | Proxied<T>): InferSchema<T> {
  const raw = isProxied(instance) ? getRawInstance(instance) : instance;
  return extractInstance(raw) as InferSchema<T>;
}
