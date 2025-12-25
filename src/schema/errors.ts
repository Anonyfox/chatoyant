/**
 * Custom error types for schema validation.
 *
 * @module schema/errors
 */

/**
 * Error thrown when schema validation fails.
 */
export class SchemaError extends Error {
  /** The path to the field that failed validation */
  readonly path: string;
  /** The expected type or constraint */
  readonly expected: string;
  /** The actual value received */
  readonly received: unknown;

  constructor(message: string, path: string, expected: string, received?: unknown) {
    super(message);
    this.name = 'SchemaError';
    this.path = path;
    this.expected = expected;
    this.received = received;
  }

  /**
   * Create error for missing required field.
   */
  static missingField(path: string): SchemaError {
    return new SchemaError(`Missing required field: ${path}`, path, 'value', undefined);
  }

  /**
   * Create error for type mismatch.
   */
  static typeMismatch(path: string, expected: string, received: unknown): SchemaError {
    const receivedType = received === null ? 'null' : typeof received;
    return new SchemaError(
      `Type mismatch at ${path}: expected ${expected}, got ${receivedType}`,
      path,
      expected,
      received,
    );
  }

  /**
   * Create error for constraint violation.
   */
  static constraintViolation(path: string, constraint: string, received: unknown): SchemaError {
    return new SchemaError(
      `Constraint violation at ${path}: ${constraint}`,
      path,
      constraint,
      received,
    );
  }

  /**
   * Create error for invalid enum value.
   */
  static invalidEnum(path: string, allowed: readonly unknown[], received: unknown): SchemaError {
    return new SchemaError(
      `Invalid enum value at ${path}: got ${JSON.stringify(received)}, expected one of ${JSON.stringify(allowed)}`,
      path,
      `one of ${JSON.stringify(allowed)}`,
      received,
    );
  }
}
