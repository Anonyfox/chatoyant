/**
 * Enum field descriptor factory.
 *
 * @module schema/descriptors/enum
 */

import { createFieldDescriptor } from '../field.js';
import type { EnumFieldOptions, FieldDescriptor } from '../types.js';

/**
 * Create an enum field descriptor.
 * The value must be one of the specified allowed values.
 *
 * @param values - Array of allowed values (use `as const` for literal types)
 * @param options - Enum field configuration
 * @returns Field descriptor for enum values
 *
 * @example
 * ```typescript
 * class User extends Schema {
 *   role = Enum(["admin", "user", "guest"] as const);
 *   priority = Enum([1, 2, 3] as const, { default: 2 });
 *   status = Enum(["active", "inactive"] as const, { description: "Account status" });
 * }
 *
 * const user = User.create();
 * user.role; // Type: "admin" | "user" | "guest"
 * ```
 */
export function Enum<const T extends readonly unknown[]>(
  values: T,
  options: EnumFieldOptions = {},
): FieldDescriptor<T[number]> {
  // Use provided default or first value
  const defaultValue = (options.default ?? values[0]) as T[number];

  return createFieldDescriptor(
    'enum',
    defaultValue,
    {
      description: options.description,
      optional: options.optional,
      default: options.default,
    },
    {
      enumValues: values,
    },
  );
}
