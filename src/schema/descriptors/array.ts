/**
 * Array field descriptor factory.
 *
 * @module schema/descriptors/array
 */

import { createFieldDescriptor } from '../field.js';
import type { ArrayFieldOptions, FieldDescriptor } from '../types.js';

/**
 * Create an array field descriptor.
 *
 * @param items - Field descriptor for array items
 * @param options - Array field configuration
 * @returns Field descriptor for array values
 *
 * @example
 * ```typescript
 * class Post extends Schema {
 *   tags = Array(String(), { minItems: 1, maxItems: 10 });
 *   scores = Array(Number(), { uniqueItems: true });
 *   authors = Array(Object(Author), { minItems: 1 });
 * }
 * ```
 */
export function Array<T>(
  items: FieldDescriptor<T>,
  options: ArrayFieldOptions = {},
): FieldDescriptor<T[]> {
  return createFieldDescriptor(
    'array',
    [] as T[],
    {
      description: options.description,
      optional: options.optional,
      minItems: options.minItems,
      maxItems: options.maxItems,
      uniqueItems: options.uniqueItems,
    },
    {
      items,
    },
  );
}
