/**
 * Schema instance cloning function.
 *
 * @module schema/functions/clone
 */

import { isFieldDescriptor } from '../field.js';
import { createProxy, getRawInstance, isProxied, type Proxied } from '../proxy.js';
import type { FieldDescriptor, SchemaInstance } from '../types.js';

/**
 * Deep clone a field value.
 */
function cloneFieldValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(cloneFieldValue);
  }

  if (typeof value === 'object') {
    // Check if it's a schema instance
    const hasFields = Object.values(value).some(isFieldDescriptor);
    if (hasFields) {
      return cloneInstance(value as SchemaInstance);
    }

    // Plain object - shallow copy
    return { ...value };
  }

  // Primitives are immutable
  return value;
}

/**
 * Deep clone a field descriptor.
 */
function cloneField(field: FieldDescriptor): FieldDescriptor {
  return {
    __field: true,
    type: field.type,
    value: cloneFieldValue(field.value),
    defaultValue: field.defaultValue,
    options: { ...field.options },
    items: field.items,
    schema: field.schema,
    enumValues: field.enumValues,
    literalValue: field.literalValue,
  };
}

/**
 * Clone a schema instance.
 */
function cloneInstance<T extends SchemaInstance>(instance: T): T {
  const Constructor = instance.constructor as new () => T;
  const cloned = new Constructor();

  for (const [key, field] of Object.entries(instance)) {
    if (isFieldDescriptor(field)) {
      (cloned as Record<string, unknown>)[key] = cloneField(field);
    }
  }

  return cloned;
}

/**
 * Create a deep clone of a schema instance.
 *
 * @param instance - The schema instance (proxied or raw)
 * @returns A new proxied instance with cloned values
 *
 * @example
 * ```typescript
 * class User extends Schema {
 *   name = Schema.String();
 *   tags = Schema.Array(Schema.String());
 * }
 *
 * const user = Schema.create(User);
 * user.name = "Alice";
 * user.tags = ["admin"];
 *
 * const copy = Schema.clone(user);
 * copy.name = "Bob";
 * copy.tags.push("user");
 *
 * console.log(user.name); // "Alice" (unchanged)
 * console.log(user.tags); // ["admin"] (unchanged)
 * ```
 */
export function clone<T extends SchemaInstance>(instance: T | Proxied<T>): Proxied<T> {
  const raw = isProxied(instance) ? getRawInstance(instance) : instance;
  const cloned = cloneInstance(raw);
  return createProxy(cloned);
}
