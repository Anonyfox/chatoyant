/**
 * Number field descriptor factory.
 *
 * @module schema/descriptors/number
 */

import { createFieldDescriptor } from '../field.js';
import type { FieldDescriptor, NumberFieldOptions } from '../types.js';

/**
 * Create a number field descriptor.
 *
 * @param options - Number field configuration
 * @returns Field descriptor for number values
 *
 * @example
 * ```typescript
 * class Product extends Schema {
 *   price = Number({ minimum: 0, description: "Price in cents" });
 *   rating = Number({ minimum: 0, maximum: 5, optional: true });
 * }
 * ```
 */
export function Number(options: NumberFieldOptions = {}): FieldDescriptor<number> {
  const defaultValue = options.default ?? 0;

  return createFieldDescriptor('number', defaultValue, {
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
