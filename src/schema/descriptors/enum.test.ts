import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Enum } from './enum.js';

describe('Enum descriptor', () => {
  describe('basic creation', () => {
    it('should create enum with string values', () => {
      const field = Enum(['admin', 'user', 'guest'] as const);

      assert.equal(field.__field, true);
      assert.equal(field.type, 'enum');
      assert.equal(field.value, 'admin'); // First value as default
      assert.deepEqual(field.enumValues, ['admin', 'user', 'guest']);
    });

    it('should create enum with number values', () => {
      const field = Enum([1, 2, 3] as const);

      assert.equal(field.value, 1);
      assert.deepEqual(field.enumValues, [1, 2, 3]);
    });

    it('should create enum with boolean values', () => {
      const field = Enum([true, false] as const);

      assert.equal(field.value, true);
      assert.deepEqual(field.enumValues, [true, false]);
    });

    it('should create enum with mixed types', () => {
      const field = Enum([1, 'two', true] as const);

      assert.equal(field.value, 1);
      assert.deepEqual(field.enumValues, [1, 'two', true]);
    });
  });

  describe('options', () => {
    it('should use provided default', () => {
      const field = Enum(['a', 'b', 'c'] as const, { default: 'b' });

      assert.equal(field.value, 'b');
      assert.equal(field.options.default, 'b');
    });

    it('should store description', () => {
      const field = Enum(['active', 'inactive'] as const, {
        description: 'Account status',
      });

      assert.equal(field.options.description, 'Account status');
    });

    it('should store optional flag', () => {
      const field = Enum(['a', 'b'] as const, { optional: true });

      assert.equal(field.options.optional, true);
    });

    it('should store all options together', () => {
      const field = Enum(['low', 'medium', 'high'] as const, {
        description: 'Priority level',
        optional: false,
        default: 'medium',
      });

      assert.equal(field.options.description, 'Priority level');
      assert.equal(field.options.optional, false);
      assert.equal(field.options.default, 'medium');
      assert.equal(field.value, 'medium');
    });
  });

  describe('enumValues preservation', () => {
    it('should preserve exact enum values', () => {
      const values = ['x', 'y', 'z'] as const;
      const field = Enum(values);

      assert.deepEqual(field.enumValues, ['x', 'y', 'z']);
    });

    it('should preserve numeric enum values', () => {
      const field = Enum([100, 200, 300] as const);

      assert.deepEqual(field.enumValues, [100, 200, 300]);
    });

    it('should preserve null in enum values', () => {
      const field = Enum([null, 'value'] as const);

      assert.deepEqual(field.enumValues, [null, 'value']);
      assert.equal(field.value, null);
    });
  });

  describe('edge cases', () => {
    it('should handle single value enum', () => {
      const field = Enum(['only'] as const);

      assert.equal(field.value, 'only');
      assert.deepEqual(field.enumValues, ['only']);
    });

    it('should handle empty string in enum', () => {
      const field = Enum(['', 'non-empty'] as const);

      assert.equal(field.value, '');
      assert.deepEqual(field.enumValues, ['', 'non-empty']);
    });

    it('should handle zero in numeric enum', () => {
      const field = Enum([0, 1, 2] as const);

      assert.equal(field.value, 0);
    });

    it('should handle negative numbers in enum', () => {
      const field = Enum([-1, 0, 1] as const);

      assert.equal(field.value, -1);
      assert.deepEqual(field.enumValues, [-1, 0, 1]);
    });

    it('should handle floating point numbers in enum', () => {
      const field = Enum([0.5, 1.5, 2.5] as const);

      assert.equal(field.value, 0.5);
    });

    it('should handle unicode strings in enum', () => {
      const field = Enum(['日本語', 'English', 'Español'] as const);

      assert.equal(field.value, '日本語');
    });

    it('should handle emoji in enum', () => {
      const field = Enum(['👍', '👎', '🤷'] as const);

      assert.equal(field.value, '👍');
    });

    it('should handle special characters in enum', () => {
      const field = Enum(['@#$', '!@#', '%^&'] as const);

      assert.equal(field.value, '@#$');
    });
  });

  describe('default value selection', () => {
    it('should use first value when no default specified', () => {
      const field = Enum(['first', 'second', 'third'] as const);

      assert.equal(field.value, 'first');
    });

    it('should use specified default over first value', () => {
      const field = Enum(['first', 'second', 'third'] as const, { default: 'third' });

      assert.equal(field.value, 'third');
    });

    it('should handle default for numeric enum', () => {
      const field = Enum([1, 2, 3] as const, { default: 2 });

      assert.equal(field.value, 2);
    });
  });

  describe('value mutability', () => {
    it('should allow value to be changed', () => {
      const field = Enum(['a', 'b', 'c'] as const);

      field.value = 'b';

      assert.equal(field.value, 'b');
      assert.equal(field.defaultValue, 'a');
    });

    it('should allow setting to any enum value', () => {
      const field = Enum(['x', 'y', 'z'] as const);

      field.value = 'y';
      assert.equal(field.value, 'y');

      field.value = 'z';
      assert.equal(field.value, 'z');

      field.value = 'x';
      assert.equal(field.value, 'x');
    });
  });

  describe('use cases', () => {
    it('should work for status fields', () => {
      const field = Enum(['pending', 'approved', 'rejected'] as const, {
        description: 'Request status',
        default: 'pending',
      });

      assert.equal(field.value, 'pending');
    });

    it('should work for role fields', () => {
      const field = Enum(['admin', 'moderator', 'user'] as const, {
        description: 'User role',
      });

      assert.equal(field.type, 'enum');
    });

    it('should work for priority levels', () => {
      const field = Enum([1, 2, 3, 4, 5] as const, {
        description: 'Priority (1=highest)',
        default: 3,
      });

      assert.equal(field.value, 3);
    });
  });
});
