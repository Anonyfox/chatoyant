import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { createFieldDescriptor } from './field.js';
import { createProxy, getRawInstance, IS_PROXIED, isProxied, RAW_INSTANCE } from './proxy.js';
import type { SchemaInstance } from './types.js';

describe('Proxy', () => {
  function createTestInstance(): SchemaInstance {
    return {
      name: createFieldDescriptor('string', 'Alice', { description: 'Name' }),
      age: createFieldDescriptor('integer', 30, {}),
    };
  }

  describe('createProxy', () => {
    it('should create a proxy', () => {
      const instance = createTestInstance();
      const proxied = createProxy(instance);

      assert.ok(proxied);
      assert.notStrictEqual(proxied, instance);
    });

    it('should allow direct property access to field values', () => {
      const instance = createTestInstance();
      const proxied = createProxy(instance);

      assert.equal(proxied.name, 'Alice');
      assert.equal(proxied.age, 30);
    });

    it('should allow direct property assignment', () => {
      const instance = createTestInstance();
      const proxied = createProxy(instance);

      proxied.name = 'Bob';
      proxied.age = 25;

      assert.equal(proxied.name, 'Bob');
      assert.equal(proxied.age, 25);
    });

    it('should expose raw instance via symbol', () => {
      const instance = createTestInstance();
      const proxied = createProxy(instance);

      assert.strictEqual(proxied[RAW_INSTANCE], instance);
    });

    it('should mark as proxied via symbol', () => {
      const instance = createTestInstance();
      const proxied = createProxy(instance);

      assert.equal(proxied[IS_PROXIED], true);
    });
  });

  describe('isProxied', () => {
    it('should return true for proxied instance', () => {
      const instance = createTestInstance();
      const proxied = createProxy(instance);

      assert.equal(isProxied(proxied), true);
    });

    it('should return false for raw instance', () => {
      const instance = createTestInstance();

      assert.equal(isProxied(instance), false);
    });

    it('should return false for null', () => {
      assert.equal(isProxied(null), false);
    });

    it('should return false for undefined', () => {
      assert.equal(isProxied(undefined), false);
    });

    it('should return false for plain object', () => {
      assert.equal(isProxied({ name: 'test' }), false);
    });

    it('should return false for primitive', () => {
      assert.equal(isProxied('string'), false);
      assert.equal(isProxied(123), false);
      assert.equal(isProxied(true), false);
    });

    it('should return false for array', () => {
      assert.equal(isProxied([1, 2, 3]), false);
    });

    it('should return false for function', () => {
      assert.equal(
        isProxied(() => {}),
        false,
      );
    });
  });

  describe('getRawInstance', () => {
    it('should return the raw instance', () => {
      const instance = createTestInstance();
      const proxied = createProxy(instance);
      const raw = getRawInstance(proxied);

      assert.strictEqual(raw, instance);
    });

    it('should return instance with field descriptors', () => {
      const instance = createTestInstance();
      const proxied = createProxy(instance);
      const raw = getRawInstance(proxied);

      assert.ok(raw.name);
      assert.equal((raw.name as any).__field, true);
    });
  });

  describe('enumeration', () => {
    it('should enumerate field keys with Object.keys', () => {
      const instance = createTestInstance();
      const proxied = createProxy(instance);
      const keys = Object.keys(proxied);

      assert.deepEqual(keys.sort(), ['age', 'name']);
    });

    it('should support for...in', () => {
      const instance = createTestInstance();
      const proxied = createProxy(instance);
      const keys: string[] = [];

      for (const key in proxied) {
        keys.push(key);
      }

      assert.deepEqual(keys.sort(), ['age', 'name']);
    });

    it('should support Object.entries', () => {
      const instance = createTestInstance();
      const proxied = createProxy(instance);
      const entries = Object.entries(proxied);

      assert.equal(entries.length, 2);
      const obj = Object.fromEntries(entries);
      assert.equal(obj.name, 'Alice');
      assert.equal(obj.age, 30);
    });

    it('should support Object.values', () => {
      const instance = createTestInstance();
      const proxied = createProxy(instance);
      const values = Object.values(proxied);

      assert.ok(values.includes('Alice'));
      assert.ok(values.includes(30));
    });
  });

  describe('symbol access', () => {
    it('should handle RAW_INSTANCE symbol', () => {
      const instance = createTestInstance();
      const proxied = createProxy(instance);

      assert.strictEqual(proxied[RAW_INSTANCE], instance);
    });

    it('should handle IS_PROXIED symbol', () => {
      const instance = createTestInstance();
      const proxied = createProxy(instance);

      assert.strictEqual(proxied[IS_PROXIED], true);
    });

    it('should support in operator for symbols', () => {
      const instance = createTestInstance();
      const proxied = createProxy(instance);

      assert.equal(RAW_INSTANCE in proxied, true);
      assert.equal(IS_PROXIED in proxied, true);
    });
  });

  describe('property descriptor access', () => {
    it('should return proper property descriptor for field', () => {
      const instance = createTestInstance();
      const proxied = createProxy(instance);
      const descriptor = Object.getOwnPropertyDescriptor(proxied, 'name');

      assert.ok(descriptor);
      assert.equal(descriptor.enumerable, true);
      assert.equal(descriptor.configurable, true);
      assert.equal(descriptor.writable, true);
      assert.equal(descriptor.value, 'Alice');
    });

    it('should handle non-existent property descriptor', () => {
      const instance = createTestInstance();
      const proxied = createProxy(instance);
      const descriptor = Object.getOwnPropertyDescriptor(proxied, 'nonexistent');

      assert.equal(descriptor, undefined);
    });
  });

  describe('value mutations', () => {
    it('should update field descriptor value on assignment', () => {
      const instance = createTestInstance();
      const proxied = createProxy(instance);

      proxied.name = 'Changed';

      // Check that raw instance was updated
      const raw = getRawInstance(proxied);
      assert.equal((raw.name as any).value, 'Changed');
    });

    it('should reflect changes immediately', () => {
      const instance = createTestInstance();
      const proxied = createProxy(instance);

      proxied.name = 'First';
      assert.equal(proxied.name, 'First');

      proxied.name = 'Second';
      assert.equal(proxied.name, 'Second');
    });
  });

  describe('type handling', () => {
    it('should handle string values', () => {
      const instance = createTestInstance();
      const proxied = createProxy(instance);

      proxied.name = 'Test String';
      assert.equal(typeof proxied.name, 'string');
    });

    it('should handle number values', () => {
      const instance = createTestInstance();
      const proxied = createProxy(instance);

      proxied.age = 42;
      assert.equal(typeof proxied.age, 'number');
    });

    it('should handle boolean fields', () => {
      const instance: SchemaInstance = {
        active: createFieldDescriptor('boolean', true, {}),
      };
      const proxied = createProxy(instance);

      assert.equal(proxied.active, true);
      proxied.active = false;
      assert.equal(proxied.active, false);
    });

    it('should handle null values', () => {
      const instance: SchemaInstance = {
        deleted: createFieldDescriptor('null', null, {}),
      };
      const proxied = createProxy(instance);

      assert.strictEqual(proxied.deleted, null);
    });

    it('should handle array values', () => {
      const instance: SchemaInstance = {
        tags: createFieldDescriptor('array', ['a', 'b'], {}),
      };
      const proxied = createProxy(instance);

      assert.deepEqual(proxied.tags, ['a', 'b']);
    });
  });

  describe('edge cases', () => {
    it('should handle empty instance', () => {
      const instance: SchemaInstance = {};
      const proxied = createProxy(instance);

      assert.deepEqual(Object.keys(proxied), []);
    });

    it('should handle instance with many fields', () => {
      const instance: SchemaInstance = {};
      for (let i = 0; i < 100; i++) {
        instance[`field${i}`] = createFieldDescriptor('string', `value${i}`, {});
      }

      const proxied = createProxy(instance);

      assert.equal(Object.keys(proxied).length, 100);
      assert.equal(proxied.field50, 'value50');
    });

    it('should handle special property names', () => {
      const instance: SchemaInstance = {
        constructor: createFieldDescriptor('string', 'test', {}),
        toString: createFieldDescriptor('string', 'str', {}),
        valueOf: createFieldDescriptor('string', 'val', {}),
      };
      const proxied = createProxy(instance);

      assert.equal(proxied.constructor, 'test');
      assert.equal(proxied.toString, 'str');
      assert.equal(proxied.valueOf, 'val');
    });

    it('should handle special property names', () => {
      const instance: SchemaInstance = {
        specialName: createFieldDescriptor('string', 'Special', {}),
        anotherName: createFieldDescriptor('string', 'Another', {}),
      };
      const proxied = createProxy(instance);

      assert.equal(proxied.specialName, 'Special');
      assert.equal(proxied.anotherName, 'Another');
    });
  });
});
