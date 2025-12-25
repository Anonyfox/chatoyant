/**
 * Boolean field descriptor factory.
 *
 * @module schema/descriptors/boolean
 */

import { createFieldDescriptor } from '../field.js';
import type { BooleanFieldOptions, FieldDescriptor } from '../types.js';

/**
 * Create a boolean field descriptor.
 *
 * @param options - Boolean field configuration
 * @returns Field descriptor for boolean values
 *
 * @example
 * ```typescript
 * class Task extends Schema {
 *   completed = Boolean({ default: false });
 *   urgent = Boolean({ optional: true });
 * }
 * ```
 */
export function Boolean(options: BooleanFieldOptions = {}): FieldDescriptor<boolean> {
  const defaultValue = options.default ?? false;

  return createFieldDescriptor('boolean', defaultValue, {
    description: options.description,
    optional: options.optional,
    default: options.default,
  });
}
