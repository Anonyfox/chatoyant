import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { createFieldDescriptor, isFieldDescriptor } from './field.js';

describe('isFieldDescriptor', () => {
  describe('valid field descriptors', () => {
    it('should return true for string field descriptor', () => {
      const field = createFieldDescriptor('string', '', {});
      assert.equal(isFieldDescriptor(field), true);
    });

    it('should return true for number field descriptor', () => {
      const field = createFieldDescriptor('number', 0, {});
      assert.equal(isFieldDescriptor(field), true);
    });

    it('should return true for boolean field descriptor', () => {
      const field = createFieldDescriptor('boolean', false, {});
      assert.equal(isFieldDescriptor(field), true);
    });

    it('should return true for array field descriptor', () => {
      const field = createFieldDescriptor('array', [], {});
      assert.equal(isFieldDescriptor(field), true);
    });

    it('should return true for object field descriptor', () => {
      const field = createFieldDescriptor('object', {}, {});
      assert.equal(isFieldDescriptor(field), true);
    });

    it('should return true for enum field descriptor', () => {
      const field = createFieldDescriptor('enum', 'a', {}, { enumValues: ['a', 'b'] });
      assert.equal(isFieldDescriptor(field), true);
    });

    it('should return true for literal field descriptor', () => {
      const field = createFieldDescriptor('literal', 42, {}, { literalValue: 42 });
      assert.equal(isFieldDescriptor(field), true);
    });

    it('should return true for null field descriptor', () => {
      const field = createFieldDescriptor('null', null, {});
      assert.equal(isFieldDescriptor(field), true);
    });
  });

  describe('invalid values', () => {
    it('should return false for null', () => {
      assert.equal(isFieldDescriptor(null), false);
    });

    it('should return false for undefined', () => {
      assert.equal(isFieldDescriptor(undefined), false);
    });

    it('should return false for string primitive', () => {
      assert.equal(isFieldDescriptor('hello'), false);
    });

    it('should return false for number primitive', () => {
      assert.equal(isFieldDescriptor(123), false);
      assert.equal(isFieldDescriptor(0), false);
      assert.equal(isFieldDescriptor(-1), false);
      assert.equal(isFieldDescriptor(NaN), false);
      assert.equal(isFieldDescriptor(Infinity), false);
    });

    it('should return false for boolean primitive', () => {
      assert.equal(isFieldDescriptor(true), false);
      assert.equal(isFieldDescriptor(false), false);
    });

    it('should return false for plain object', () => {
      assert.equal(isFieldDescriptor({ value: 'test' }), false);
      assert.equal(isFieldDescriptor({}), false);
    });

    it('should return false for object with __field: false', () => {
      assert.equal(isFieldDescriptor({ __field: false }), false);
    });

    it('should return false for object with __field: "true"', () => {
      assert.equal(isFieldDescriptor({ __field: 'true' }), false);
    });

    it('should return false for object with __field: 1', () => {
      assert.equal(isFieldDescriptor({ __field: 1 }), false);
    });

    it('should return false for array', () => {
      assert.equal(isFieldDescriptor([]), false);
      assert.equal(isFieldDescriptor([1, 2, 3]), false);
    });

    it('should return false for function', () => {
      assert.equal(
        isFieldDescriptor(() => {}),
        false,
      );
      assert.equal(
        isFieldDescriptor(() => {}),
        false,
      );
    });

    it('should return false for symbol', () => {
      assert.equal(isFieldDescriptor(Symbol('test')), false);
    });

    it('should return false for Date', () => {
      assert.equal(isFieldDescriptor(new Date()), false);
    });

    it('should return false for RegExp', () => {
      assert.equal(isFieldDescriptor(/test/), false);
    });

    it('should return false for Map', () => {
      assert.equal(isFieldDescriptor(new Map()), false);
    });

    it('should return false for Set', () => {
      assert.equal(isFieldDescriptor(new Set()), false);
    });
  });
});

describe('createFieldDescriptor', () => {
  describe('basic field creation', () => {
    it('should create string field descriptor', () => {
      const field = createFieldDescriptor('string', 'default', {
        description: 'A string field',
      });

      assert.equal(field.__field, true);
      assert.equal(field.type, 'string');
      assert.equal(field.value, 'default');
      assert.equal(field.defaultValue, 'default');
      assert.equal(field.options.description, 'A string field');
    });

    it('should create number field descriptor', () => {
      const field = createFieldDescriptor('number', 42, {
        description: 'A number field',
      });

      assert.equal(field.type, 'number');
      assert.equal(field.value, 42);
      assert.equal(field.defaultValue, 42);
    });

    it('should create integer field descriptor', () => {
      const field = createFieldDescriptor('integer', 10, {});

      assert.equal(field.type, 'integer');
      assert.equal(field.value, 10);
    });

    it('should create boolean field descriptor', () => {
      const field = createFieldDescriptor('boolean', true, {});

      assert.equal(field.type, 'boolean');
      assert.equal(field.value, true);
    });

    it('should create null field descriptor', () => {
      const field = createFieldDescriptor('null', null, {});

      assert.equal(field.type, 'null');
      assert.equal(field.value, null);
    });
  });

  describe('options handling', () => {
    it('should store empty options', () => {
      const field = createFieldDescriptor('string', '', {});

      assert.deepEqual(field.options, {});
    });

    it('should store description option', () => {
      const field = createFieldDescriptor('string', '', { description: 'Test' });

      assert.equal(field.options.description, 'Test');
    });

    it('should store optional flag', () => {
      const field = createFieldDescriptor('string', '', { optional: true });

      assert.equal(field.options.optional, true);
    });

    it('should store default option', () => {
      const field = createFieldDescriptor('string', 'hello', { default: 'hello' });

      assert.equal(field.options.default, 'hello');
    });

    it('should store multiple options', () => {
      const field = createFieldDescriptor('string', '', {
        description: 'A field',
        optional: true,
        minLength: 1,
        maxLength: 100,
      });

      assert.equal(field.options.description, 'A field');
      assert.equal(field.options.optional, true);
      assert.equal(field.options.minLength, 1);
      assert.equal(field.options.maxLength, 100);
    });
  });

  describe('extra properties', () => {
    it('should store enumValues for enum type', () => {
      const field = createFieldDescriptor(
        'enum',
        'a',
        {},
        {
          enumValues: ['a', 'b', 'c'] as const,
        },
      );

      assert.equal(field.type, 'enum');
      assert.deepEqual(field.enumValues, ['a', 'b', 'c']);
    });

    it('should store literalValue for literal type', () => {
      const field = createFieldDescriptor(
        'literal',
        'exact',
        {},
        {
          literalValue: 'exact',
        },
      );

      assert.equal(field.type, 'literal');
      assert.equal(field.literalValue, 'exact');
    });

    it('should store items for array type', () => {
      const itemField = createFieldDescriptor('string', '', {});
      const field = createFieldDescriptor('array', [], {}, { items: itemField });

      assert.equal(field.type, 'array');
      assert.strictEqual(field.items, itemField);
    });

    it('should store schema for object type', () => {
      class MockSchema {}
      const field = createFieldDescriptor('object', {}, {}, { schema: MockSchema as any });

      assert.equal(field.type, 'object');
      assert.strictEqual(field.schema, MockSchema);
    });
  });

  describe('value mutability', () => {
    it('should allow value to be mutated', () => {
      const field = createFieldDescriptor('string', 'initial', {});

      assert.equal(field.value, 'initial');

      field.value = 'changed';

      assert.equal(field.value, 'changed');
      assert.equal(field.defaultValue, 'initial'); // Default unchanged
    });

    it('should preserve defaultValue when value changes', () => {
      const field = createFieldDescriptor('number', 100, {});

      field.value = 200;
      field.value = 300;

      assert.equal(field.value, 300);
      assert.equal(field.defaultValue, 100);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string as default', () => {
      const field = createFieldDescriptor('string', '', {});

      assert.equal(field.value, '');
      assert.equal(field.defaultValue, '');
    });

    it('should handle zero as default', () => {
      const field = createFieldDescriptor('number', 0, {});

      assert.equal(field.value, 0);
      assert.equal(field.defaultValue, 0);
    });

    it('should handle false as default', () => {
      const field = createFieldDescriptor('boolean', false, {});

      assert.equal(field.value, false);
      assert.equal(field.defaultValue, false);
    });

    it('should handle empty array as default', () => {
      const field = createFieldDescriptor('array', [], {});

      assert.deepEqual(field.value, []);
      assert.deepEqual(field.defaultValue, []);
    });

    it('should handle empty object as default', () => {
      const field = createFieldDescriptor('object', {}, {});

      assert.deepEqual(field.value, {});
      assert.deepEqual(field.defaultValue, {});
    });

    it('should handle unicode in string values', () => {
      const field = createFieldDescriptor('string', '日本語 🎉', {});

      assert.equal(field.value, '日本語 🎉');
    });

    it('should handle special number values', () => {
      const fieldNegZero = createFieldDescriptor('number', -0, {});
      const fieldInfinity = createFieldDescriptor('number', Infinity, {});
      const fieldNegInfinity = createFieldDescriptor('number', -Infinity, {});

      assert.equal(fieldNegZero.value, -0);
      assert.equal(fieldInfinity.value, Infinity);
      assert.equal(fieldNegInfinity.value, -Infinity);
    });
  });
});
