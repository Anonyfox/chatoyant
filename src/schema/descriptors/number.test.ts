import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Number } from './number.js';

describe('Number descriptor', () => {
  describe('basic creation', () => {
    it('should create basic number field', () => {
      const field = Number();

      assert.equal(field.__field, true);
      assert.equal(field.type, 'number');
      assert.equal(field.value, 0);
      assert.equal(field.defaultValue, 0);
    });

    it('should use provided default', () => {
      const field = Number({ default: 42.5 });

      assert.equal(field.value, 42.5);
      assert.equal(field.defaultValue, 42.5);
    });
  });

  describe('options', () => {
    it('should store description', () => {
      const field = Number({ description: 'A number field' });

      assert.equal(field.options.description, 'A number field');
    });

    it('should store optional flag', () => {
      const field = Number({ optional: true });

      assert.equal(field.options.optional, true);
    });

    it('should store minimum', () => {
      const field = Number({ minimum: 0 });

      assert.equal(field.options.minimum, 0);
    });

    it('should store maximum', () => {
      const field = Number({ maximum: 100 });

      assert.equal(field.options.maximum, 100);
    });

    it('should store exclusiveMinimum', () => {
      const field = Number({ exclusiveMinimum: 0 });

      assert.equal(field.options.exclusiveMinimum, 0);
    });

    it('should store exclusiveMaximum', () => {
      const field = Number({ exclusiveMaximum: 100 });

      assert.equal(field.options.exclusiveMaximum, 100);
    });

    it('should store multipleOf', () => {
      const field = Number({ multipleOf: 0.5 });

      assert.equal(field.options.multipleOf, 0.5);
    });

    it('should store all options together', () => {
      const field = Number({
        description: 'Price in dollars',
        optional: true,
        default: 9.99,
        minimum: 0,
        maximum: 1000,
        multipleOf: 0.01,
      });

      assert.equal(field.options.description, 'Price in dollars');
      assert.equal(field.options.optional, true);
      assert.equal(field.options.default, 9.99);
      assert.equal(field.options.minimum, 0);
      assert.equal(field.options.maximum, 1000);
      assert.equal(field.options.multipleOf, 0.01);
    });
  });

  describe('edge cases', () => {
    it('should handle zero as default', () => {
      const field = Number({ default: 0 });

      assert.equal(field.value, 0);
      assert.equal(field.options.default, 0);
    });

    it('should handle negative numbers', () => {
      const field = Number({ default: -42 });

      assert.equal(field.value, -42);
    });

    it('should handle negative zero', () => {
      const field = Number({ default: -0 });

      assert.equal(field.value, -0);
      assert.ok(Object.is(field.value, -0));
    });

    it('should handle very small decimals', () => {
      const field = Number({ default: 0.0000001 });

      assert.equal(field.value, 0.0000001);
    });

    it('should handle very large numbers', () => {
      const field = Number({ default: 1e308 });

      assert.equal(field.value, 1e308);
    });

    it('should handle Infinity', () => {
      const field = Number({ default: Infinity });

      assert.equal(field.value, Infinity);
    });

    it('should handle negative Infinity', () => {
      const field = Number({ default: -Infinity });

      assert.equal(field.value, -Infinity);
    });

    it('should handle NaN (though typically not recommended)', () => {
      const field = Number({ default: NaN });

      assert.ok(globalThis.Number.isNaN(field.value));
    });

    it('should handle MAX_VALUE', () => {
      const field = Number({ default: globalThis.Number.MAX_VALUE });

      assert.equal(field.value, globalThis.Number.MAX_VALUE);
    });

    it('should handle MIN_VALUE', () => {
      const field = Number({ default: globalThis.Number.MIN_VALUE });

      assert.equal(field.value, globalThis.Number.MIN_VALUE);
    });

    it('should handle MAX_SAFE_INTEGER', () => {
      const field = Number({ default: globalThis.Number.MAX_SAFE_INTEGER });

      assert.equal(field.value, globalThis.Number.MAX_SAFE_INTEGER);
    });

    it('should handle MIN_SAFE_INTEGER', () => {
      const field = Number({ default: globalThis.Number.MIN_SAFE_INTEGER });

      assert.equal(field.value, globalThis.Number.MIN_SAFE_INTEGER);
    });

    it('should handle EPSILON', () => {
      const field = Number({ default: globalThis.Number.EPSILON });

      assert.equal(field.value, globalThis.Number.EPSILON);
    });

    it('should handle negative minimum', () => {
      const field = Number({ minimum: -100 });

      assert.equal(field.options.minimum, -100);
    });

    it('should handle multipleOf less than 1', () => {
      const field = Number({ multipleOf: 0.001 });

      assert.equal(field.options.multipleOf, 0.001);
    });

    it('should handle multipleOf of 1', () => {
      const field = Number({ multipleOf: 1 });

      assert.equal(field.options.multipleOf, 1);
    });

    it('should handle same minimum and maximum', () => {
      const field = Number({ minimum: 50, maximum: 50 });

      assert.equal(field.options.minimum, 50);
      assert.equal(field.options.maximum, 50);
    });
  });

  describe('value mutability', () => {
    it('should allow value to be changed', () => {
      const field = Number({ default: 100 });

      field.value = 200;

      assert.equal(field.value, 200);
      assert.equal(field.defaultValue, 100);
    });

    it('should allow setting to zero', () => {
      const field = Number({ default: 100 });

      field.value = 0;

      assert.equal(field.value, 0);
    });

    it('should allow setting to negative', () => {
      const field = Number({ default: 100 });

      field.value = -50;

      assert.equal(field.value, -50);
    });
  });
});
