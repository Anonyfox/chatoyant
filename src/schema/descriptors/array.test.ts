import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { isFieldDescriptor } from '../field.js';
import { Array } from './array.js';
import { Boolean } from './boolean.js';
import { Integer } from './integer.js';
import { Number } from './number.js';
import { String } from './string.js';

describe('Array descriptor', () => {
  describe('basic creation', () => {
    it('should create array of strings', () => {
      const field = Array(String());

      assert.equal(field.__field, true);
      assert.equal(field.type, 'array');
      assert.deepEqual(field.value, []);
      assert.ok(field.items);
      assert.equal(field.items?.type, 'string');
    });

    it('should create array of numbers', () => {
      const field = Array(Number());

      assert.equal(field.type, 'array');
      assert.equal(field.items?.type, 'number');
    });

    it('should create array of integers', () => {
      const field = Array(Integer());

      assert.equal(field.type, 'array');
      assert.equal(field.items?.type, 'integer');
    });

    it('should create array of booleans', () => {
      const field = Array(Boolean());

      assert.equal(field.type, 'array');
      assert.equal(field.items?.type, 'boolean');
    });
  });

  describe('options', () => {
    it('should store description', () => {
      const field = Array(String(), { description: 'List of tags' });

      assert.equal(field.options.description, 'List of tags');
    });

    it('should store optional flag', () => {
      const field = Array(String(), { optional: true });

      assert.equal(field.options.optional, true);
    });

    it('should store minItems', () => {
      const field = Array(String(), { minItems: 1 });

      assert.equal(field.options.minItems, 1);
    });

    it('should store maxItems', () => {
      const field = Array(String(), { maxItems: 10 });

      assert.equal(field.options.maxItems, 10);
    });

    it('should store uniqueItems', () => {
      const field = Array(String(), { uniqueItems: true });

      assert.equal(field.options.uniqueItems, true);
    });

    it('should store all options together', () => {
      const field = Array(String(), {
        description: 'Unique tags',
        optional: false,
        minItems: 1,
        maxItems: 5,
        uniqueItems: true,
      });

      assert.equal(field.options.description, 'Unique tags');
      assert.equal(field.options.optional, false);
      assert.equal(field.options.minItems, 1);
      assert.equal(field.options.maxItems, 5);
      assert.equal(field.options.uniqueItems, true);
    });
  });

  describe('items field descriptor', () => {
    it('should have items as field descriptor', () => {
      const field = Array(String());

      assert.ok(isFieldDescriptor(field.items));
    });

    it('should preserve items options', () => {
      const field = Array(String({ minLength: 1, maxLength: 50 }));

      assert.equal(field.items?.options.minLength, 1);
      assert.equal(field.items?.options.maxLength, 50);
    });
  });

  describe('nested arrays', () => {
    it('should support nested arrays (2D)', () => {
      const field = Array(Array(String()));

      assert.equal(field.type, 'array');
      assert.equal(field.items?.type, 'array');
      assert.equal(field.items?.items?.type, 'string');
    });

    it('should support deeply nested arrays (3D)', () => {
      const field = Array(Array(Array(Number())));

      assert.equal(field.type, 'array');
      assert.equal(field.items?.type, 'array');
      assert.equal(field.items?.items?.type, 'array');
      assert.equal(field.items?.items?.items?.type, 'number');
    });
  });

  describe('edge cases', () => {
    it('should default to empty array', () => {
      const field = Array(String());

      assert.deepEqual(field.value, []);
      assert.deepEqual(field.defaultValue, []);
    });

    it('should handle minItems of 0', () => {
      const field = Array(String(), { minItems: 0 });

      assert.equal(field.options.minItems, 0);
    });

    it('should handle maxItems of 0', () => {
      const field = Array(String(), { maxItems: 0 });

      assert.equal(field.options.maxItems, 0);
    });

    it('should handle same minItems and maxItems', () => {
      const field = Array(String(), { minItems: 5, maxItems: 5 });

      assert.equal(field.options.minItems, 5);
      assert.equal(field.options.maxItems, 5);
    });

    it('should handle large maxItems', () => {
      const field = Array(String(), { maxItems: 1000000 });

      assert.equal(field.options.maxItems, 1000000);
    });

    it('should handle uniqueItems false explicitly', () => {
      const field = Array(String(), { uniqueItems: false });

      assert.equal(field.options.uniqueItems, false);
    });
  });

  describe('value mutability', () => {
    it('should allow value to be changed', () => {
      const field = Array(String());

      field.value = ['a', 'b', 'c'];

      assert.deepEqual(field.value, ['a', 'b', 'c']);
      assert.deepEqual(field.defaultValue, []);
    });

    it('should allow setting to empty array', () => {
      const field = Array(String());

      field.value = ['a'];
      field.value = [];

      assert.deepEqual(field.value, []);
    });

    it('should allow modifying array in place', () => {
      const field = Array(String());

      field.value = ['a'];
      (field.value as string[]).push('b');

      assert.deepEqual(field.value, ['a', 'b']);
    });
  });

  describe('with different item types', () => {
    it('should work with strings with constraints', () => {
      const field = Array(String({ format: 'email' }));

      assert.equal(field.items?.options.format, 'email');
    });

    it('should work with numbers with constraints', () => {
      const field = Array(Number({ minimum: 0, maximum: 100 }));

      assert.equal(field.items?.options.minimum, 0);
      assert.equal(field.items?.options.maximum, 100);
    });

    it('should work with integers with constraints', () => {
      const field = Array(Integer({ minimum: 1 }));

      assert.equal(field.items?.type, 'integer');
      assert.equal(field.items?.options.minimum, 1);
    });

    it('should work with optional item type', () => {
      const field = Array(String({ optional: true }));

      // Note: optional on items is unusual but should be preserved
      assert.equal(field.items?.options.optional, true);
    });
  });
});
