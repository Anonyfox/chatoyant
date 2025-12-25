/**
 * Proxy creation for clean property access on schema instances.
 *
 * @module schema/proxy
 */

import { isFieldDescriptor } from './field.js';
import type { FieldDescriptor, SchemaInstance } from './types.js';

/**
 * Symbol to access the raw (unproxied) schema instance.
 */
export const RAW_INSTANCE = Symbol.for('chatoyant.schema.raw');

/**
 * Symbol to mark an object as a proxied schema instance.
 */
export const IS_PROXIED = Symbol.for('chatoyant.schema.proxied');

/**
 * Type representing a proxied schema instance where field descriptors
 * are unwrapped to their value types for clean access.
 */
export type Proxied<T extends SchemaInstance> = {
  [K in keyof T]: T[K] extends FieldDescriptor<infer V>
    ? V extends SchemaInstance
      ? Proxied<V>
      : V
    : T[K];
} & {
  [RAW_INSTANCE]: T;
  [IS_PROXIED]: true;
};

/**
 * Check if a value is a proxied schema instance.
 */
export function isProxied(value: unknown): value is Proxied<SchemaInstance> {
  return (
    typeof value === 'object' &&
    value !== null &&
    IS_PROXIED in value &&
    (value as Proxied<SchemaInstance>)[IS_PROXIED] === true
  );
}

/**
 * Get the raw (unproxied) instance from a proxied schema.
 */
export function getRawInstance<T extends SchemaInstance>(proxied: Proxied<T>): T {
  return proxied[RAW_INSTANCE];
}

/**
 * Create a proxy around a schema instance for clean property access.
 *
 * The proxy intercepts property access to:
 * - Return field descriptor values directly (no `.value` needed)
 * - Allow direct assignment to field values
 * - Recursively proxy nested schema instances
 *
 * @param instance - The schema instance to wrap
 * @returns Proxied instance with clean access
 */
export function createProxy<T extends SchemaInstance>(instance: T): Proxied<T> {
  const handler: ProxyHandler<T> = {
    get(target, prop, receiver) {
      // Handle symbol access
      if (prop === RAW_INSTANCE) {
        return target;
      }
      if (prop === IS_PROXIED) {
        return true;
      }

      // Handle string property access
      if (typeof prop === 'string') {
        const field = target[prop];

        // If it's a field descriptor, return the value
        if (isFieldDescriptor(field)) {
          const value = field.value;

          // If the value is a schema instance (nested object), proxy it too
          if (
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value) &&
            !isProxied(value)
          ) {
            // Check if it looks like a schema instance (has field descriptors)
            const hasFields = Object.values(value).some(isFieldDescriptor);
            if (hasFields) {
              return createProxy(value as SchemaInstance);
            }
          }

          return value;
        }
      }

      return Reflect.get(target, prop, receiver);
    },

    set(target, prop, value, receiver) {
      if (typeof prop === 'string') {
        const field = target[prop];

        // If it's a field descriptor, set the value
        if (isFieldDescriptor(field)) {
          field.value = value;
          return true;
        }
      }

      return Reflect.set(target, prop, value, receiver);
    },

    // Support for Object.keys, for...in, etc.
    ownKeys(target) {
      return Reflect.ownKeys(target).filter(
        (key) => typeof key === 'string' && isFieldDescriptor(target[key]),
      );
    },

    getOwnPropertyDescriptor(target, prop) {
      if (typeof prop === 'string' && isFieldDescriptor(target[prop])) {
        return {
          configurable: true,
          enumerable: true,
          writable: true,
          value: (target[prop] as FieldDescriptor).value,
        };
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },

    // Support for 'in' operator
    has(target, prop) {
      if (prop === IS_PROXIED || prop === RAW_INSTANCE) {
        return true;
      }
      return Reflect.has(target, prop);
    },
  };

  return new Proxy(instance, handler) as Proxied<T>;
}
