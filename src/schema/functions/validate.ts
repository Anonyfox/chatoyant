/**
 * Schema validation function.
 *
 * @module schema/functions/validate
 */

import { SchemaError } from '../errors.js';
import { isFieldDescriptor } from '../field.js';
import { getRawInstance, isProxied, type Proxied } from '../proxy.js';
import type { FieldDescriptor, SchemaInstance } from '../types.js';

/**
 * Validate a value against a field descriptor.
 */
function validateField(field: FieldDescriptor, value: unknown, path: string): void {
  const opts = field.options;

  // Handle missing values (undefined)
  if (value === undefined) {
    // Optional fields or fields with defaults can be omitted
    if (opts.optional || opts.default !== undefined) {
      return;
    }
    throw SchemaError.missingField(path);
  }

  // Handle null values
  if (value === null) {
    // Null type accepts null as a valid value
    if (field.type === 'null') {
      return; // Valid null
    }
    // Optional fields accept null
    if (opts.optional) {
      return;
    }
    throw SchemaError.typeMismatch(path, field.type, null);
  }

  switch (field.type) {
    case 'string':
      if (typeof value !== 'string') {
        throw SchemaError.typeMismatch(path, 'string', value);
      }
      if (opts.minLength !== undefined && value.length < (opts.minLength as number)) {
        throw SchemaError.constraintViolation(path, `minLength ${opts.minLength}`, value);
      }
      if (opts.maxLength !== undefined && value.length > (opts.maxLength as number)) {
        throw SchemaError.constraintViolation(path, `maxLength ${opts.maxLength}`, value);
      }
      if (opts.pattern !== undefined) {
        const regex = new RegExp(opts.pattern as string);
        if (!regex.test(value)) {
          throw SchemaError.constraintViolation(path, `pattern ${opts.pattern}`, value);
        }
      }
      break;

    case 'number':
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw SchemaError.typeMismatch(path, 'number', value);
      }
      validateNumberConstraints(value, opts, path);
      break;

    case 'integer':
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        throw SchemaError.typeMismatch(path, 'integer', value);
      }
      validateNumberConstraints(value, opts, path);
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        throw SchemaError.typeMismatch(path, 'boolean', value);
      }
      break;

    case 'null':
      // null values are handled above, anything else is invalid
      throw SchemaError.typeMismatch(path, 'null', value);

    case 'array':
      if (!Array.isArray(value)) {
        throw SchemaError.typeMismatch(path, 'array', value);
      }
      if (opts.minItems !== undefined && value.length < (opts.minItems as number)) {
        throw SchemaError.constraintViolation(path, `minItems ${opts.minItems}`, value.length);
      }
      if (opts.maxItems !== undefined && value.length > (opts.maxItems as number)) {
        throw SchemaError.constraintViolation(path, `maxItems ${opts.maxItems}`, value.length);
      }
      if (opts.uniqueItems && new Set(value).size !== value.length) {
        throw SchemaError.constraintViolation(path, 'uniqueItems', value);
      }
      // Validate each item
      if (field.items) {
        value.forEach((item, index) => {
          validateField(field.items!, item, `${path}[${index}]`);
        });
      }
      break;

    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw SchemaError.typeMismatch(path, 'object', value);
      }
      if (field.schema) {
        const nestedInstance = new field.schema();
        validateInstance(nestedInstance, value as Record<string, unknown>, path);
      }
      break;

    case 'enum':
      if (field.enumValues && !field.enumValues.includes(value)) {
        throw SchemaError.invalidEnum(path, field.enumValues, value);
      }
      break;

    case 'literal':
      if (value !== field.literalValue) {
        throw SchemaError.constraintViolation(
          path,
          `const ${JSON.stringify(field.literalValue)}`,
          value,
        );
      }
      break;
  }
}

/**
 * Validate number constraints (shared between number and integer).
 */
function validateNumberConstraints(
  value: number,
  opts: Record<string, unknown>,
  path: string,
): void {
  if (opts.minimum !== undefined && value < (opts.minimum as number)) {
    throw SchemaError.constraintViolation(path, `minimum ${opts.minimum}`, value);
  }
  if (opts.maximum !== undefined && value > (opts.maximum as number)) {
    throw SchemaError.constraintViolation(path, `maximum ${opts.maximum}`, value);
  }
  if (opts.exclusiveMinimum !== undefined && value <= (opts.exclusiveMinimum as number)) {
    throw SchemaError.constraintViolation(path, `exclusiveMinimum ${opts.exclusiveMinimum}`, value);
  }
  if (opts.exclusiveMaximum !== undefined && value >= (opts.exclusiveMaximum as number)) {
    throw SchemaError.constraintViolation(path, `exclusiveMaximum ${opts.exclusiveMaximum}`, value);
  }
  if (opts.multipleOf !== undefined && value % (opts.multipleOf as number) !== 0) {
    throw SchemaError.constraintViolation(path, `multipleOf ${opts.multipleOf}`, value);
  }
}

/**
 * Validate data against a schema instance.
 */
function validateInstance(
  instance: SchemaInstance,
  data: Record<string, unknown>,
  basePath = '',
): void {
  for (const [key, field] of Object.entries(instance)) {
    if (isFieldDescriptor(field)) {
      const path = basePath ? `${basePath}.${key}` : key;
      const value = data[key];
      validateField(field, value, path);
    }
  }
}

/**
 * Validate data against a schema without modifying the instance.
 *
 * @param instance - The schema instance (proxied or raw)
 * @param data - The data to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * ```typescript
 * class User extends Schema {
 *   name = Schema.String({ minLength: 1 });
 *   age = Schema.Integer({ minimum: 0 });
 * }
 *
 * const user = Schema.create(User);
 *
 * Schema.validate(user, { name: "Alice", age: 30 }); // true
 * Schema.validate(user, { name: "", age: -1 }); // false
 * ```
 */
export function validate<T extends SchemaInstance>(
  instance: T | Proxied<T>,
  data: unknown,
): boolean {
  try {
    const raw = isProxied(instance) ? getRawInstance(instance) : instance;

    if (typeof data !== 'object' || data === null) {
      return false;
    }

    validateInstance(raw, data as Record<string, unknown>);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate data and throw detailed error if invalid.
 * Used internally by parse().
 *
 * @internal
 */
export function validateOrThrow<T extends SchemaInstance>(
  instance: T | Proxied<T>,
  data: unknown,
): void {
  const raw = isProxied(instance) ? getRawInstance(instance) : instance;

  if (typeof data !== 'object' || data === null) {
    throw SchemaError.typeMismatch('', 'object', data);
  }

  validateInstance(raw, data as Record<string, unknown>);
}
