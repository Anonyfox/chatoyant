/**
 * Schema instance creation function.
 *
 * @module schema/functions/create
 */

import { createProxy, type Proxied } from '../proxy.js';
import type { SchemaConstructor, SchemaInstance } from '../types.js';

/**
 * Create a new proxied schema instance.
 *
 * @param SchemaClass - The Schema class to instantiate
 * @returns A proxied instance with clean property access
 *
 * @example
 * ```typescript
 * class User extends Schema {
 *   name = Schema.String();
 *   age = Schema.Integer();
 * }
 *
 * const user = Schema.create(User);
 * user.name = "Alice";  // Direct access, no .value
 * console.log(user.name);  // "Alice"
 * ```
 */
export function create<T extends SchemaInstance>(SchemaClass: SchemaConstructor<T>): Proxied<T> {
  const instance = new SchemaClass();
  return createProxy(instance);
}
