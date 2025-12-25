import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Integer } from './integer.js';

describe('Integer descriptor', () => {
  describe('basic creation', () => {
    it('should create basic integer field', () => {
      const field = Integer();

      assert.equal(field.__field, true);
      assert.equal(field.type, 'integer');
      assert.equal(field.value, 0);
      assert.equal(field.defaultValue, 0);
    });

    it('should use provided default', () => {
      const field = Integer({ default: 42 });

      assert.equal(field.value, 42);
      assert.equal(field.defaultValue, 42);
    });
  });

  describe('options', () => {
    it('should store description', () => {
      const field = Integer({ description: 'An integer field' });

      assert.equal(field.options.description, 'An integer field');
    });

    it('should store optional flag', () => {
      const field = Integer({ optional: true });

      assert.equal(field.options.optional, true);
    });

    it('should store minimum', () => {
      const field = Integer({ minimum: 1 });

      assert.equal(field.options.minimum, 1);
    });

    it('should store maximum', () => {
      const field = Integer({ maximum: 100 });

      assert.equal(field.options.maximum, 100);
    });

    it('should store exclusiveMinimum', () => {
      const field = Integer({ exclusiveMinimum: 0 });

      assert.equal(field.options.exclusiveMinimum, 0);
    });

    it('should store exclusiveMaximum', () => {
      const field = Integer({ exclusiveMaximum: 100 });

      assert.equal(field.options.exclusiveMaximum, 100);
    });

    it('should store multipleOf', () => {
      const field = Integer({ multipleOf: 5 });

      assert.equal(field.options.multipleOf, 5);
    });

    it('should store all options together', () => {
      const field = Integer({
        description: 'User age',
        optional: false,
        default: 18,
        minimum: 0,
        maximum: 150,
      });

      assert.equal(field.options.description, 'User age');
      assert.equal(field.options.optional, false);
      assert.equal(field.options.default, 18);
      assert.equal(field.options.minimum, 0);
      assert.equal(field.options.maximum, 150);
    });
  });

  describe('edge cases', () => {
    it('should handle zero as default', () => {
      const field = Integer({ default: 0 });

      assert.equal(field.value, 0);
    });

    it('should handle negative integers', () => {
      const field = Integer({ default: -100 });

      assert.equal(field.value, -100);
    });

    it('should handle MAX_SAFE_INTEGER', () => {
      const field = Integer({ default: Number.MAX_SAFE_INTEGER });

      assert.equal(field.value, Number.MAX_SAFE_INTEGER);
      assert.equal(field.value, 9007199254740991);
    });

    it('should handle MIN_SAFE_INTEGER', () => {
      const field = Integer({ default: Number.MIN_SAFE_INTEGER });

      assert.equal(field.value, Number.MIN_SAFE_INTEGER);
      assert.equal(field.value, -9007199254740991);
    });

    it('should handle minimum of 0', () => {
      const field = Integer({ minimum: 0 });

      assert.equal(field.options.minimum, 0);
    });

    it('should handle negative minimum', () => {
      const field = Integer({ minimum: -1000 });

      assert.equal(field.options.minimum, -1000);
    });

    it('should handle multipleOf for even numbers', () => {
      const field = Integer({ multipleOf: 2 });

      assert.equal(field.options.multipleOf, 2);
    });

    it('should handle same minimum and maximum', () => {
      const field = Integer({ minimum: 42, maximum: 42 });

      assert.equal(field.options.minimum, 42);
      assert.equal(field.options.maximum, 42);
    });

    it('should handle large range', () => {
      const field = Integer({
        minimum: -1000000,
        maximum: 1000000,
      });

      assert.equal(field.options.minimum, -1000000);
      assert.equal(field.options.maximum, 1000000);
    });
  });

  describe('type distinction from number', () => {
    it('should have type "integer" not "number"', () => {
      const field = Integer();

      assert.equal(field.type, 'integer');
      assert.notEqual(field.type, 'number');
    });
  });

  describe('value mutability', () => {
    it('should allow value to be changed', () => {
      const field = Integer({ default: 10 });

      field.value = 20;

      assert.equal(field.value, 20);
      assert.equal(field.defaultValue, 10);
    });

    it('should allow setting to zero', () => {
      const field = Integer({ default: 100 });

      field.value = 0;

      assert.equal(field.value, 0);
    });

    it('should allow setting to negative', () => {
      const field = Integer({ default: 100 });

      field.value = -50;

      assert.equal(field.value, -50);
    });
  });
});
