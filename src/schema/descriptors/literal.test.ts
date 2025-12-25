import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Literal } from './literal.js';

describe('Literal descriptor', () => {
  describe('basic creation', () => {
    it('should create literal string', () => {
      const field = Literal('v1.0');

      assert.equal(field.__field, true);
      assert.equal(field.type, 'literal');
      assert.equal(field.value, 'v1.0');
      assert.equal(field.literalValue, 'v1.0');
    });

    it('should create literal number', () => {
      const field = Literal(42);

      assert.equal(field.value, 42);
      assert.equal(field.literalValue, 42);
    });

    it('should create literal boolean true', () => {
      const field = Literal(true);

      assert.equal(field.value, true);
      assert.equal(field.literalValue, true);
    });

    it('should create literal boolean false', () => {
      const field = Literal(false);

      assert.equal(field.value, false);
      assert.equal(field.literalValue, false);
    });

    it('should create literal null', () => {
      const field = Literal(null);

      assert.equal(field.value, null);
      assert.equal(field.literalValue, null);
    });
  });

  describe('options', () => {
    it('should store description', () => {
      const field = Literal('1.0', { description: 'API version' });

      assert.equal(field.options.description, 'API version');
    });

    it('should store optional flag', () => {
      const field = Literal('constant', { optional: true });

      assert.equal(field.options.optional, true);
    });

    it('should store all options together', () => {
      const field = Literal('fixed', {
        description: 'A constant value',
        optional: false,
      });

      assert.equal(field.options.description, 'A constant value');
      assert.equal(field.options.optional, false);
    });
  });

  describe('value and literalValue consistency', () => {
    it('should have same value and literalValue for string', () => {
      const field = Literal('test');

      assert.strictEqual(field.value, field.literalValue);
    });

    it('should have same value and literalValue for number', () => {
      const field = Literal(123);

      assert.strictEqual(field.value, field.literalValue);
    });

    it('should have same value and literalValue for boolean', () => {
      const field = Literal(true);

      assert.strictEqual(field.value, field.literalValue);
    });

    it('should have same value and defaultValue for literal', () => {
      const field = Literal('const');

      assert.strictEqual(field.value, field.defaultValue);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const field = Literal('');

      assert.equal(field.value, '');
      assert.equal(field.literalValue, '');
    });

    it('should handle zero', () => {
      const field = Literal(0);

      assert.equal(field.value, 0);
      assert.equal(field.literalValue, 0);
    });

    it('should handle negative zero', () => {
      const field = Literal(-0);

      assert.ok(Object.is(field.value, -0));
      assert.ok(Object.is(field.literalValue, -0));
    });

    it('should handle negative numbers', () => {
      const field = Literal(-42);

      assert.equal(field.value, -42);
    });

    it('should handle floating point numbers', () => {
      const field = Literal(1.23456);

      assert.equal(field.value, 1.23456);
    });

    it('should handle unicode strings', () => {
      const field = Literal('日本語');

      assert.equal(field.value, '日本語');
    });

    it('should handle emoji', () => {
      const field = Literal('🚀');

      assert.equal(field.value, '🚀');
    });

    it('should handle special characters', () => {
      const field = Literal('<script>alert("xss")</script>');

      assert.equal(field.value, '<script>alert("xss")</script>');
    });

    it('should handle newlines in string', () => {
      const field = Literal('line1\nline2');

      assert.equal(field.value, 'line1\nline2');
    });
  });

  describe('value mutability', () => {
    it('should allow value to be changed (even though unusual for literal)', () => {
      const field = Literal('original');

      field.value = 'changed';

      assert.equal(field.value, 'changed');
      assert.equal(field.defaultValue, 'original');
      assert.equal(field.literalValue, 'original'); // literalValue stays
    });

    it('should preserve literalValue when value changes', () => {
      const field = Literal(100);

      field.value = 200;

      assert.equal(field.value, 200);
      assert.equal(field.literalValue, 100);
    });
  });

  describe('use cases', () => {
    it('should work for API versions', () => {
      const field = Literal('v2.0', { description: 'API version' });

      assert.equal(field.value, 'v2.0');
      assert.equal(field.type, 'literal');
    });

    it('should work for type discriminators', () => {
      const field = Literal('user', { description: 'Entity type' });

      assert.equal(field.value, 'user');
    });

    it('should work for boolean flags that must be exact', () => {
      const field = Literal(true, { description: 'Must be true' });

      assert.strictEqual(field.value, true);
    });

    it('should work for required null values', () => {
      const field = Literal(null, { description: 'Must be null' });

      assert.strictEqual(field.value, null);
    });

    it('should work for magic numbers', () => {
      const field = Literal(42, { description: 'Answer to everything' });

      assert.equal(field.value, 42);
    });
  });
});
