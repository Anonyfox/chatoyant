import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { String } from './string.js';

describe('String descriptor', () => {
  describe('basic creation', () => {
    it('should create basic string field', () => {
      const field = String();

      assert.equal(field.__field, true);
      assert.equal(field.type, 'string');
      assert.equal(field.value, '');
      assert.equal(field.defaultValue, '');
    });

    it('should use provided default', () => {
      const field = String({ default: 'hello' });

      assert.equal(field.value, 'hello');
      assert.equal(field.defaultValue, 'hello');
    });
  });

  describe('options', () => {
    it('should store description', () => {
      const field = String({ description: 'A name field' });

      assert.equal(field.options.description, 'A name field');
    });

    it('should store optional flag', () => {
      const field = String({ optional: true });

      assert.equal(field.options.optional, true);
    });

    it('should store minLength', () => {
      const field = String({ minLength: 1 });

      assert.equal(field.options.minLength, 1);
    });

    it('should store maxLength', () => {
      const field = String({ maxLength: 100 });

      assert.equal(field.options.maxLength, 100);
    });

    it('should store pattern', () => {
      const field = String({ pattern: '^[a-z]+$' });

      assert.equal(field.options.pattern, '^[a-z]+$');
    });

    it('should store format', () => {
      const field = String({ format: 'email' });

      assert.equal(field.options.format, 'email');
    });

    it('should store all options together', () => {
      const field = String({
        description: 'Email address',
        optional: true,
        default: 'user@example.com',
        minLength: 5,
        maxLength: 254,
        format: 'email',
      });

      assert.equal(field.options.description, 'Email address');
      assert.equal(field.options.optional, true);
      assert.equal(field.options.default, 'user@example.com');
      assert.equal(field.options.minLength, 5);
      assert.equal(field.options.maxLength, 254);
      assert.equal(field.options.format, 'email');
    });
  });

  describe('format options', () => {
    it('should accept date-time format', () => {
      const field = String({ format: 'date-time' });
      assert.equal(field.options.format, 'date-time');
    });

    it('should accept date format', () => {
      const field = String({ format: 'date' });
      assert.equal(field.options.format, 'date');
    });

    it('should accept time format', () => {
      const field = String({ format: 'time' });
      assert.equal(field.options.format, 'time');
    });

    it('should accept uri format', () => {
      const field = String({ format: 'uri' });
      assert.equal(field.options.format, 'uri');
    });

    it('should accept uuid format', () => {
      const field = String({ format: 'uuid' });
      assert.equal(field.options.format, 'uuid');
    });

    it('should accept ipv4 format', () => {
      const field = String({ format: 'ipv4' });
      assert.equal(field.options.format, 'ipv4');
    });

    it('should accept ipv6 format', () => {
      const field = String({ format: 'ipv6' });
      assert.equal(field.options.format, 'ipv6');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string default', () => {
      const field = String({ default: '' });

      assert.equal(field.value, '');
      assert.equal(field.options.default, '');
    });

    it('should handle unicode characters', () => {
      const field = String({ default: '日本語' });

      assert.equal(field.value, '日本語');
    });

    it('should handle emoji', () => {
      const field = String({ default: '🎉🚀✨' });

      assert.equal(field.value, '🎉🚀✨');
    });

    it('should handle mixed unicode and emoji', () => {
      const field = String({ default: 'Hello 世界 🌍' });

      assert.equal(field.value, 'Hello 世界 🌍');
    });

    it('should handle newlines', () => {
      const field = String({ default: 'line1\nline2\nline3' });

      assert.equal(field.value, 'line1\nline2\nline3');
    });

    it('should handle tabs', () => {
      const field = String({ default: 'col1\tcol2\tcol3' });

      assert.equal(field.value, 'col1\tcol2\tcol3');
    });

    it('should handle special characters', () => {
      const field = String({ default: '<script>alert("xss")</script>' });

      assert.equal(field.value, '<script>alert("xss")</script>');
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      const field = String({ default: longString });

      assert.equal(field.value, longString);
      assert.equal(field.value.length, 10000);
    });

    it('should handle null character', () => {
      const field = String({ default: 'before\0after' });

      assert.equal(field.value, 'before\0after');
    });

    it('should handle minLength of 0', () => {
      const field = String({ minLength: 0 });

      assert.equal(field.options.minLength, 0);
    });

    it('should handle maxLength of 0', () => {
      const field = String({ maxLength: 0 });

      assert.equal(field.options.maxLength, 0);
    });

    it('should handle complex regex pattern', () => {
      const field = String({ pattern: '^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d).{8,}$' });

      assert.equal(field.options.pattern, '^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d).{8,}$');
    });

    it('should handle pattern with unicode', () => {
      const field = String({ pattern: '^[\\u4e00-\\u9fa5]+$' });

      assert.equal(field.options.pattern, '^[\\u4e00-\\u9fa5]+$');
    });
  });

  describe('value mutability', () => {
    it('should allow value to be changed', () => {
      const field = String({ default: 'initial' });

      field.value = 'changed';

      assert.equal(field.value, 'changed');
      assert.equal(field.defaultValue, 'initial');
    });

    it('should allow setting empty string', () => {
      const field = String({ default: 'not empty' });

      field.value = '';

      assert.equal(field.value, '');
    });
  });
});
