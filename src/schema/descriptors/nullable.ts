/**
 * Null field descriptor factory.
 *
 * @module schema/descriptors/nullable
 */

import { createFieldDescriptor } from '../field.js';
import type { BaseFieldOptions, FieldDescriptor } from '../types.js';

/**
 * Create a null field descriptor.
 * Represents a field that can only be null.
 *
 * @param options - Field configuration
 * @returns Field descriptor for null values
 *
 * @example
 * ```typescript
 * class DeleteRequest extends Schema {
 *   deletedAt = Null({ description: "Deletion marker" });
 * }
 * ```
 */
export function Null(options: BaseFieldOptions = {}): FieldDescriptor<null> {
  return createFieldDescriptor('null', null, {
    description: options.description,
    optional: options.optional,
  });
}
