/**
 * JSON Schema string serialization function.
 *
 * @module schema/functions/stringify
 */

import type { Proxied } from '../proxy.js';
import type { SchemaInstance } from '../types.js';
import { toJSON } from './toJSON.js';

/**
 * Generate a JSON Schema string from a schema instance.
 *
 * @param instance - The schema instance (proxied or raw)
 * @param pretty - Whether to pretty-print the output (default: true)
 * @returns JSON Schema as a string
 *
 * @example
 * ```typescript
 * class User extends Schema {
 *   name = Schema.String();
 * }
 *
 * const user = Schema.create(User);
 * console.log(Schema.stringify(user));
 * // Pretty-printed JSON Schema string
 * ```
 */
export function stringify<T extends SchemaInstance>(
  instance: T | Proxied<T>,
  pretty = true,
): string {
  const schema = toJSON(instance);
  return pretty ? JSON.stringify(schema, null, 2) : JSON.stringify(schema);
}
