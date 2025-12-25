/**
 * JSON Schema generation function.
 *
 * @module schema/functions/toJSON
 */

import { isFieldDescriptor } from '../field.js';
import { getRawInstance, isProxied, type Proxied } from '../proxy.js';
import type {
  FieldDescriptor,
  JSONSchemaDocument,
  JSONSchemaProperty,
  SchemaInstance,
} from '../types.js';

/**
 * Convert a field descriptor to a JSON Schema property.
 */
function fieldToJSONSchema(field: FieldDescriptor): JSONSchemaProperty {
  const property: JSONSchemaProperty = {};
  const opts = field.options;

  // Add description if present
  if (opts.description) {
    property.description = opts.description as string;
  }

  // Add default if present (and not optional without default)
  if (opts.default !== undefined) {
    property.default = opts.default;
  }

  switch (field.type) {
    case 'string':
      property.type = 'string';
      if (opts.minLength !== undefined) property.minLength = opts.minLength as number;
      if (opts.maxLength !== undefined) property.maxLength = opts.maxLength as number;
      if (opts.pattern !== undefined) property.pattern = opts.pattern as string;
      if (opts.format !== undefined) property.format = opts.format as string;
      break;

    case 'number':
      property.type = 'number';
      if (opts.minimum !== undefined) property.minimum = opts.minimum as number;
      if (opts.maximum !== undefined) property.maximum = opts.maximum as number;
      if (opts.exclusiveMinimum !== undefined)
        property.exclusiveMinimum = opts.exclusiveMinimum as number;
      if (opts.exclusiveMaximum !== undefined)
        property.exclusiveMaximum = opts.exclusiveMaximum as number;
      if (opts.multipleOf !== undefined) property.multipleOf = opts.multipleOf as number;
      break;

    case 'integer':
      property.type = 'integer';
      if (opts.minimum !== undefined) property.minimum = opts.minimum as number;
      if (opts.maximum !== undefined) property.maximum = opts.maximum as number;
      if (opts.exclusiveMinimum !== undefined)
        property.exclusiveMinimum = opts.exclusiveMinimum as number;
      if (opts.exclusiveMaximum !== undefined)
        property.exclusiveMaximum = opts.exclusiveMaximum as number;
      if (opts.multipleOf !== undefined) property.multipleOf = opts.multipleOf as number;
      break;

    case 'boolean':
      property.type = 'boolean';
      break;

    case 'null':
      property.type = 'null';
      break;

    case 'array':
      property.type = 'array';
      if (field.items) {
        property.items = fieldToJSONSchema(field.items);
      }
      if (opts.minItems !== undefined) property.minItems = opts.minItems as number;
      if (opts.maxItems !== undefined) property.maxItems = opts.maxItems as number;
      if (opts.uniqueItems !== undefined) property.uniqueItems = opts.uniqueItems as boolean;
      break;

    case 'object':
      if (field.schema) {
        const nested = new field.schema();
        const nestedSchema = instanceToJSONSchema(nested);
        property.type = 'object';
        property.properties = nestedSchema.properties;
        property.required = nestedSchema.required;
      }
      break;

    case 'enum':
      if (field.enumValues) {
        property.enum = [...field.enumValues];
      }
      break;

    case 'literal':
      property.const = field.literalValue;
      break;
  }

  return property;
}

/**
 * Convert a schema instance to JSON Schema format.
 */
function instanceToJSONSchema(instance: SchemaInstance): JSONSchemaDocument {
  const properties: Record<string, JSONSchemaProperty> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(instance)) {
    if (isFieldDescriptor(value)) {
      properties[key] = fieldToJSONSchema(value);

      // Add to required if not optional
      if (!value.options.optional) {
        required.push(key);
      }
    }
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

/**
 * Generate a JSON Schema document from a schema instance.
 *
 * @param instance - The schema instance (proxied or raw)
 * @returns JSON Schema object conforming to draft 2020-12
 *
 * @example
 * ```typescript
 * class User extends Schema {
 *   name = Schema.String({ description: "Name", minLength: 1 });
 *   age = Schema.Integer({ minimum: 0 });
 * }
 *
 * const user = Schema.create(User);
 * const schema = Schema.toJSON(user);
 * // {
 * //   "$schema": "https://json-schema.org/draft/2020-12/schema",
 * //   "type": "object",
 * //   "properties": {
 * //     "name": { "type": "string", "description": "Name", "minLength": 1 },
 * //     "age": { "type": "integer", "minimum": 0 }
 * //   },
 * //   "required": ["name", "age"]
 * // }
 * ```
 */
export function toJSON<T extends SchemaInstance>(instance: T | Proxied<T>): JSONSchemaDocument {
  const raw = isProxied(instance) ? getRawInstance(instance) : instance;
  const schema = instanceToJSONSchema(raw);

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    ...schema,
  };
}
