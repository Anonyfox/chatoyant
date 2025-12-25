/**
 * Integer field descriptor factory.
 *
 * @module schema/descriptors/integer
 */

import { createFieldDescriptor } from '../field.js';
import type { FieldDescriptor, IntegerFieldOptions } from '../types.js';

/**
 * Create an integer field descriptor.
 * Integers are whole numbers (no decimal places).
 *
 * @param options - Integer field configuration
 * @returns Field descriptor for integer values
 *
 * @example
 * ```typescript
 * class User extends Schema {
 *   age = Integer({ minimum: 0, maximum: 150 });
 *   level = Integer({ minimum: 1, default: 1 });
 * }
 * ```
 */
export function Integer(options: IntegerFieldOptions = {}): FieldDescriptor<number> {
  const defaultValue = options.default ?? 0;

  return createFieldDescriptor('integer', defaultValue, {
    description: options.description,
    optional: options.optional,
    default: options.default,
    minimum: options.minimum,
    maximum: options.maximum,
    exclusiveMinimum: options.exclusiveMinimum,
    exclusiveMaximum: options.exclusiveMaximum,
    multipleOf: options.multipleOf,
  });
}
