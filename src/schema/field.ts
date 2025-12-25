/**
 * Field descriptor utilities.
 *
 * @module schema/field
 */

import type {
  BaseFieldOptions,
  FieldDescriptor,
  JSONSchemaType,
  SchemaConstructor,
} from './types.js';

/**
 * Check if a value is a FieldDescriptor.
 */
export function isFieldDescriptor(value: unknown): value is FieldDescriptor {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__field' in value &&
    (value as FieldDescriptor).__field === true
  );
}

/**
 * Create a base field descriptor.
 * Used internally by type-specific factories.
 */
export function createFieldDescriptor<T>(
  type: JSONSchemaType | 'enum' | 'literal',
  defaultValue: T,
  options: BaseFieldOptions & Record<string, unknown>,
  extra?: {
    items?: FieldDescriptor;
    schema?: SchemaConstructor;
    enumValues?: readonly unknown[];
    literalValue?: unknown;
  },
): FieldDescriptor<T> {
  return {
    __field: true,
    type,
    value: defaultValue,
    defaultValue,
    options,
    ...extra,
  };
}
