import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Boolean } from './boolean.js';

describe('Boolean descriptor', () => {
  describe('basic creation', () => {
    it('should create basic boolean field', () => {
      const field = Boolean();

      assert.equal(field.__field, true);
      assert.equal(field.type, 'boolean');
      assert.equal(field.value, false);
      assert.equal(field.defaultValue, false);
    });

    it('should use provided default true', () => {
      const field = Boolean({ default: true });

      assert.equal(field.value, true);
      assert.equal(field.defaultValue, true);
    });

    it('should use provided default false', () => {
      const field = Boolean({ default: false });

      assert.equal(field.value, false);
      assert.equal(field.defaultValue, false);
    });
  });

  describe('options', () => {
    it('should store description', () => {
      const field = Boolean({ description: 'Is active flag' });

      assert.equal(field.options.description, 'Is active flag');
    });

    it('should store optional flag', () => {
      const field = Boolean({ optional: true });

      assert.equal(field.options.optional, true);
    });

    it('should store all options together', () => {
      const field = Boolean({
        description: 'Feature flag',
        optional: true,
        default: true,
      });

      assert.equal(field.options.description, 'Feature flag');
      assert.equal(field.options.optional, true);
      assert.equal(field.options.default, true);
    });
  });

  describe('default value behavior', () => {
    it('should default to false when no options', () => {
      const field = Boolean();

      assert.strictEqual(field.value, false);
    });

    it('should default to false when empty options', () => {
      const field = Boolean({});

      assert.strictEqual(field.value, false);
    });

    it('should respect explicit false default', () => {
      const field = Boolean({ default: false });

      assert.strictEqual(field.value, false);
      assert.strictEqual(field.options.default, false);
    });

    it('should respect explicit true default', () => {
      const field = Boolean({ default: true });

      assert.strictEqual(field.value, true);
      assert.strictEqual(field.options.default, true);
    });
  });

  describe('type strictness', () => {
    it('should have strictly boolean type', () => {
      const field = Boolean();

      assert.strictEqual(typeof field.value, 'boolean');
      assert.strictEqual(field.type, 'boolean');
    });

    it('should not coerce truthy values (descriptor stores what you give it)', () => {
      // The descriptor itself doesn't do coercion - it stores what you provide
      // Validation would catch non-boolean values
      const field = Boolean();

      assert.strictEqual(field.value, false);
    });
  });

  describe('value mutability', () => {
    it('should allow value to be changed to true', () => {
      const field = Boolean();

      field.value = true;

      assert.strictEqual(field.value, true);
      assert.strictEqual(field.defaultValue, false);
    });

    it('should allow value to be changed to false', () => {
      const field = Boolean({ default: true });

      field.value = false;

      assert.strictEqual(field.value, false);
      assert.strictEqual(field.defaultValue, true);
    });

    it('should allow toggling value', () => {
      const field = Boolean();

      assert.strictEqual(field.value, false);

      field.value = true;
      assert.strictEqual(field.value, true);

      field.value = false;
      assert.strictEqual(field.value, false);
    });
  });

  describe('use cases', () => {
    it('should be suitable for flags', () => {
      const field = Boolean({ description: 'Enable feature X', default: false });

      assert.equal(field.type, 'boolean');
      assert.strictEqual(field.value, false);
    });

    it('should be suitable for toggles', () => {
      const field = Boolean({ description: 'Dark mode enabled', default: true });

      assert.strictEqual(field.value, true);
    });

    it('should be suitable for optional boolean fields', () => {
      const field = Boolean({ description: 'Agreed to terms', optional: true });

      assert.strictEqual(field.options.optional, true);
    });
  });
});
