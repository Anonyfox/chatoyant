/**
 * Literal (const) field descriptor factory.
 *
 * @module schema/descriptors/literal
 */

import { createFieldDescriptor } from '../field.js';
import type { FieldDescriptor, LiteralFieldOptions } from '../types.js';

/**
 * Create a literal field descriptor.
 * The value must be exactly the specified constant.
 *
 * @param value - The exact value this field must have
 * @param options - Literal field configuration
 * @returns Field descriptor for literal values
 *
 * @example
 * ```typescript
 * class APIResponse extends Schema {
 *   version = Literal("1.0");
 *   success = Literal(true);
 * }
 *
 * const response = APIResponse.create();
 * response.version; // Type: "1.0" (literal)
 * response.success; // Type: true (literal)
 * ```
 */
export function Literal<const T>(value: T, options: LiteralFieldOptions = {}): FieldDescriptor<T> {
  return createFieldDescriptor(
    'literal',
    value,
    {
      description: options.description,
      optional: options.optional,
    },
    {
      literalValue: value,
    },
  );
}
