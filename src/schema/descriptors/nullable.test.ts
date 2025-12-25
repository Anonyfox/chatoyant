import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Null } from './nullable.js';

describe('Null descriptor', () => {
  describe('basic creation', () => {
    it('should create null field with default value null', () => {
      const field = Null();

      assert.equal(field.__field, true);
      assert.equal(field.type, 'null');
      assert.equal(field.value, null);
      assert.equal(field.defaultValue, null);
    });

    it('should store description', () => {
      const field = Null({ description: 'A null field' });

      assert.equal(field.options.description, 'A null field');
    });

    it('should store optional flag', () => {
      const field = Null({ optional: true });

      assert.equal(field.options.optional, true);
    });

    it('should default optional to undefined', () => {
      const field = Null();

      assert.equal(field.options.optional, undefined);
    });
  });

  describe('value handling', () => {
    it('should always have null as value', () => {
      const field = Null();

      assert.strictEqual(field.value, null);
    });

    it('should always have null as defaultValue', () => {
      const field = Null();

      assert.strictEqual(field.defaultValue, null);
    });

    it('should allow value mutation (even though unusual for null type)', () => {
      const field = Null();

      // While unusual, the field descriptor allows mutation
      field.value = null;
      assert.strictEqual(field.value, null);
    });
  });

  describe('options combinations', () => {
    it('should handle description only', () => {
      const field = Null({ description: 'Null marker' });

      assert.equal(field.options.description, 'Null marker');
      assert.equal(field.options.optional, undefined);
    });

    it('should handle optional only', () => {
      const field = Null({ optional: true });

      assert.equal(field.options.optional, true);
      assert.equal(field.options.description, undefined);
    });

    it('should handle both description and optional', () => {
      const field = Null({ description: 'Optional null', optional: true });

      assert.equal(field.options.description, 'Optional null');
      assert.equal(field.options.optional, true);
    });

    it('should handle empty options object', () => {
      const field = Null({});

      assert.equal(field.options.description, undefined);
      assert.equal(field.options.optional, undefined);
    });
  });

  describe('use cases', () => {
    it('should be suitable for deletion markers', () => {
      const field = Null({ description: 'Deletion timestamp placeholder' });

      assert.equal(field.type, 'null');
      assert.ok(field.options.description?.includes('Deletion'));
    });

    it('should be suitable for explicit null fields', () => {
      const field = Null({ description: 'Explicitly null value' });

      assert.strictEqual(field.value, null);
    });
  });
});
