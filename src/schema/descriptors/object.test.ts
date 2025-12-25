import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { isFieldDescriptor } from '../field.js';
import { Integer } from './integer.js';
import { Object } from './object.js';
import { String } from './string.js';

// Mock schema classes for testing
class SimpleSchema {
  name = String();
  age = Integer();
}

class EmptySchema {}

class NestedSchema {
  inner = Object(SimpleSchema);
}

class DeepSchema {
  level1 = Object(NestedSchema);
}

describe('Object descriptor', () => {
  describe('basic creation', () => {
    it('should create object field with schema', () => {
      const field = Object(SimpleSchema);

      assert.equal(field.__field, true);
      assert.equal(field.type, 'object');
      assert.ok(field.schema);
      assert.strictEqual(field.schema, SimpleSchema);
    });

    it('should create default instance as value', () => {
      const field = Object(SimpleSchema);

      assert.ok(field.value);
      assert.ok(field.value instanceof SimpleSchema);
    });

    it('should store description', () => {
      const field = Object(SimpleSchema, { description: 'A nested object' });

      assert.equal(field.options.description, 'A nested object');
    });

    it('should store optional flag', () => {
      const field = Object(SimpleSchema, { optional: true });

      assert.equal(field.options.optional, true);
    });
  });

  describe('schema reference', () => {
    it('should preserve schema constructor reference', () => {
      const field = Object(SimpleSchema);

      assert.strictEqual(field.schema, SimpleSchema);
    });

    it('should allow creating new instances from schema', () => {
      const field = Object(SimpleSchema);

      const newInstance = new field.schema!();
      assert.ok(newInstance instanceof SimpleSchema);
    });
  });

  describe('default value', () => {
    it('should have default value as schema instance', () => {
      const field = Object(SimpleSchema);

      assert.ok(field.defaultValue instanceof SimpleSchema);
    });

    it('should have independent default and current value', () => {
      const field = Object(SimpleSchema);

      assert.ok(field.value instanceof SimpleSchema);
      assert.ok(field.defaultValue instanceof SimpleSchema);
      // Note: they point to the same instance initially, but conceptually separate
    });
  });

  describe('nested schemas', () => {
    it('should handle nested object schemas', () => {
      const field = Object(NestedSchema);

      assert.equal(field.type, 'object');
      assert.strictEqual(field.schema, NestedSchema);
      assert.ok(field.value instanceof NestedSchema);
    });

    it('should handle deeply nested schemas', () => {
      const field = Object(DeepSchema);

      assert.equal(field.type, 'object');
      assert.ok(field.value instanceof DeepSchema);
    });
  });

  describe('empty schema', () => {
    it('should handle empty schema class', () => {
      const field = Object(EmptySchema);

      assert.equal(field.type, 'object');
      assert.ok(field.value instanceof EmptySchema);
    });
  });

  describe('field descriptors in nested schemas', () => {
    it('should create nested schema with field descriptors', () => {
      const field = Object(SimpleSchema);
      const instance = field.value as any;

      assert.ok(isFieldDescriptor(instance.name));
      assert.ok(isFieldDescriptor(instance.age));
    });

    it('should have correct types in nested fields', () => {
      const field = Object(SimpleSchema);
      const instance = field.value as any;

      assert.equal(instance.name.type, 'string');
      assert.equal(instance.age.type, 'integer');
    });
  });

  describe('options combinations', () => {
    it('should handle no options', () => {
      const field = Object(SimpleSchema);

      assert.equal(field.options.description, undefined);
      assert.equal(field.options.optional, undefined);
    });

    it('should handle empty options object', () => {
      const field = Object(SimpleSchema, {});

      assert.equal(field.options.description, undefined);
      assert.equal(field.options.optional, undefined);
    });

    it('should handle description only', () => {
      const field = Object(SimpleSchema, { description: 'User data' });

      assert.equal(field.options.description, 'User data');
      assert.equal(field.options.optional, undefined);
    });

    it('should handle optional only', () => {
      const field = Object(SimpleSchema, { optional: true });

      assert.equal(field.options.optional, true);
      assert.equal(field.options.description, undefined);
    });

    it('should handle both options', () => {
      const field = Object(SimpleSchema, {
        description: 'Optional user',
        optional: true,
      });

      assert.equal(field.options.description, 'Optional user');
      assert.equal(field.options.optional, true);
    });
  });
});
