/**
 * String field descriptor factory.
 *
 * @module schema/descriptors/string
 */

import { createFieldDescriptor } from '../field.js';
import type { FieldDescriptor, StringFieldOptions } from '../types.js';

/**
 * Create a string field descriptor.
 *
 * @param options - String field configuration
 * @returns Field descriptor for string values
 *
 * @example
 * ```typescript
 * class User extends Schema {
 *   name = String({ description: "User's name", minLength: 1 });
 *   email = String({ format: "email", optional: true });
 * }
 * ```
 */
export function String(options: StringFieldOptions = {}): FieldDescriptor<string> {
  const defaultValue = options.default ?? '';

  return createFieldDescriptor('string', defaultValue, {
    description: options.description,
    optional: options.optional,
    default: options.default,
    minLength: options.minLength,
    maxLength: options.maxLength,
    pattern: options.pattern,
    format: options.format,
  });
}
