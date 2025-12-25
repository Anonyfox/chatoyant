/**
 * Core TypeScript types and interfaces for the Schema system.
 *
 * @module schema/types
 */

/**
 * JSON Schema draft 2020-12 type strings.
 */
export type JSONSchemaType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'null'
  | 'array'
  | 'object';

/**
 * JSON Schema string format hints.
 * @see https://json-schema.org/understanding-json-schema/reference/string#built-in-formats
 */
export type StringFormat =
  | 'date-time'
  | 'date'
  | 'time'
  | 'duration'
  | 'email'
  | 'idn-email'
  | 'hostname'
  | 'idn-hostname'
  | 'ipv4'
  | 'ipv6'
  | 'uri'
  | 'uri-reference'
  | 'iri'
  | 'iri-reference'
  | 'uuid'
  | 'json-pointer'
  | 'relative-json-pointer'
  | 'regex';

/**
 * Base options shared by all field types.
 */
export interface BaseFieldOptions {
  /** Human-readable description for documentation */
  description?: string;
  /** Whether the field can be omitted */
  optional?: boolean;
}

/**
 * Options for Schema.String() fields.
 */
export interface StringFieldOptions extends BaseFieldOptions {
  /** Default value */
  default?: string;
  /** Minimum string length */
  minLength?: number;
  /** Maximum string length */
  maxLength?: number;
  /** Regex pattern the string must match */
  pattern?: string;
  /** Semantic format hint */
  format?: StringFormat;
}

/**
 * Options for Schema.Number() fields.
 */
export interface NumberFieldOptions extends BaseFieldOptions {
  /** Default value */
  default?: number;
  /** Minimum value (inclusive) */
  minimum?: number;
  /** Maximum value (inclusive) */
  maximum?: number;
  /** Minimum value (exclusive) */
  exclusiveMinimum?: number;
  /** Maximum value (exclusive) */
  exclusiveMaximum?: number;
  /** Value must be divisible by this */
  multipleOf?: number;
}

/**
 * Options for Schema.Integer() fields (same as number).
 */
export interface IntegerFieldOptions extends NumberFieldOptions {}

/**
 * Options for Schema.Boolean() fields.
 */
export interface BooleanFieldOptions extends BaseFieldOptions {
  /** Default value */
  default?: boolean;
}

/**
 * Options for Schema.Array() fields.
 */
export interface ArrayFieldOptions extends BaseFieldOptions {
  /** Minimum array length */
  minItems?: number;
  /** Maximum array length */
  maxItems?: number;
  /** Whether all items must be unique */
  uniqueItems?: boolean;
}

/**
 * Options for Schema.Object() fields (nested schemas).
 */
export interface ObjectFieldOptions extends BaseFieldOptions {}

/**
 * Options for Schema.Enum() fields.
 */
export interface EnumFieldOptions extends BaseFieldOptions {
  /** Default value (must be one of the enum values) */
  default?: unknown;
}

/**
 * Options for Schema.Literal() fields.
 */
export interface LiteralFieldOptions extends BaseFieldOptions {}

/**
 * Internal field descriptor stored on schema instances.
 * Contains the runtime value and metadata for JSON Schema generation.
 */
export interface FieldDescriptor<T = unknown> {
  /** Marker to identify field descriptors */
  readonly __field: true;
  /** JSON Schema type */
  readonly type: JSONSchemaType | 'enum' | 'literal';
  /** Current value */
  value: T;
  /** Default value for reset/initialization */
  readonly defaultValue: T;
  /** Field configuration options */
  readonly options: BaseFieldOptions & Record<string, unknown>;
  /** For array fields: the item descriptor */
  readonly items?: FieldDescriptor;
  /** For object fields: the nested schema constructor */
  readonly schema?: SchemaConstructor;
  /** For enum fields: the allowed values */
  readonly enumValues?: readonly unknown[];
  /** For literal fields: the exact value */
  readonly literalValue?: unknown;
}

/**
 * Constructor type for Schema classes.
 */
export interface SchemaConstructor<T extends SchemaInstance = SchemaInstance> {
  new (): T;
}

/**
 * Base interface for schema instances (before proxying).
 */
export interface SchemaInstance {
  [key: string]: FieldDescriptor | unknown;
}

/**
 * JSON Schema property definition.
 */
export interface JSONSchemaProperty {
  type?: JSONSchemaType;
  description?: string;
  default?: unknown;
  enum?: readonly unknown[];
  const?: unknown;
  // String
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  // Number
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  // Array
  items?: JSONSchemaProperty;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  // Object
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
}

/**
 * Complete JSON Schema document.
 */
export interface JSONSchemaDocument extends JSONSchemaProperty {
  $schema?: string;
}

/**
 * Type helper to extract the value type from a FieldDescriptor.
 */
export type InferFieldType<F> = F extends FieldDescriptor<infer T> ? T : never;

/**
 * Type helper to check if a field is optional.
 */
export type IsOptional<F> =
  F extends FieldDescriptor<infer _T>
    ? F['options'] extends { optional: true }
      ? true
      : false
    : false;
