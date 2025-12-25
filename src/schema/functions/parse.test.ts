import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Array } from '../descriptors/array.js';
import { Boolean } from '../descriptors/boolean.js';
import { Enum } from '../descriptors/enum.js';
import { Integer } from '../descriptors/integer.js';
import { Number } from '../descriptors/number.js';
import { Object } from '../descriptors/object.js';
import { String } from '../descriptors/string.js';
import { SchemaError } from '../errors.js';
import { create } from './create.js';
import { parse } from './parse.js';

// Test schemas
class SimpleSchema {
  name = String();
  age = Integer();
}

class WithDefaults {
  name = String({ default: 'Anonymous' });
  active = Boolean({ default: true });
}

class WithOptional {
  name = String();
  email = String({ optional: true });
}

class NestedAddress {
  street = String();
  city = String();
}

class WithNested {
  name = String();
  address = Object(NestedAddress);
}

class WithArray {
  tags = Array(String());
  scores = Array(Integer());
}

class WithEnum {
  role = Enum(['admin', 'user', 'guest'] as const);
}

class WithNumber {
  price = Number();
}

class WithConstraints {
  name = String({ minLength: 1 });
}

describe('parse', () => {
  describe('basic parsing', () => {
    it('should populate instance with valid data', () => {
      const instance = create(SimpleSchema);

      parse(instance, { name: 'Alice', age: 30 });

      assert.equal(instance.name, 'Alice');
      assert.equal(instance.age, 30);
    });

    it('should overwrite default values', () => {
      const instance = create(WithDefaults);

      parse(instance, { name: 'Bob', active: false });

      assert.equal(instance.name, 'Bob');
      assert.equal(instance.active, false);
    });

    it('should keep defaults when field omitted and has default', () => {
      const instance = create(WithDefaults);

      // When parsing, fields with defaults that are omitted keep their default value
      // The parse validates but doesn't overwrite unspecified defaults
      parse(instance, { name: 'Charlie' });

      assert.equal(instance.name, 'Charlie');
      // Note: active was not in the parse data, so it stays at default from creation
      assert.equal(instance.active, true);
    });
  });

  describe('error handling', () => {
    it('should throw SchemaError for missing required field', () => {
      const instance = create(SimpleSchema);

      assert.throws(() => parse(instance, { name: 'Alice' }), SchemaError);
    });

    it('should throw SchemaError for wrong type', () => {
      const instance = create(SimpleSchema);

      assert.throws(() => parse(instance, { name: 'Alice', age: 'thirty' }), SchemaError);
    });

    it('should throw SchemaError for null input', () => {
      const instance = create(SimpleSchema);

      assert.throws(() => parse(instance, null), SchemaError);
    });

    it('should throw SchemaError for primitive input', () => {
      const instance = create(SimpleSchema);

      assert.throws(() => parse(instance, 'string'), SchemaError);
    });

    it('should throw SchemaError for constraint violation', () => {
      const instance = create(WithConstraints);

      assert.throws(() => parse(instance, { name: '' }), SchemaError);
    });

    it('should include path in error', () => {
      const instance = create(SimpleSchema);

      try {
        parse(instance, { name: 'Alice' });
        assert.fail('Should have thrown');
      } catch (e) {
        assert.ok(e instanceof SchemaError);
        assert.equal(e.path, 'age');
      }
    });
  });

  describe('optional fields', () => {
    it('should handle missing optional field', () => {
      const instance = create(WithOptional);

      parse(instance, { name: 'Alice' });

      assert.equal(instance.name, 'Alice');
      assert.equal(instance.email, ''); // Default value preserved
    });

    it('should handle null optional field', () => {
      const instance = create(WithOptional);

      parse(instance, { name: 'Alice', email: null });

      assert.equal(instance.name, 'Alice');
    });

    it('should populate optional field when provided', () => {
      const instance = create(WithOptional);

      parse(instance, { name: 'Alice', email: 'alice@test.com' });

      assert.equal(instance.email, 'alice@test.com');
    });
  });

  describe('nested objects', () => {
    it('should populate nested objects', () => {
      const instance = create(WithNested);

      parse(instance, {
        name: 'Alice',
        address: { street: '123 Main St', city: 'Boston' },
      });

      assert.equal(instance.name, 'Alice');
      assert.equal(instance.address.street, '123 Main St');
      assert.equal(instance.address.city, 'Boston');
    });

    it('should throw for invalid nested object', () => {
      const instance = create(WithNested);

      assert.throws(
        () =>
          parse(instance, {
            name: 'Alice',
            address: { street: 123, city: 'Boston' },
          }),
        SchemaError,
      );
    });

    it('should throw for missing nested field', () => {
      const instance = create(WithNested);

      assert.throws(
        () =>
          parse(instance, {
            name: 'Alice',
            address: { street: '123 Main St' },
          }),
        SchemaError,
      );
    });
  });

  describe('arrays', () => {
    it('should populate arrays', () => {
      const instance = create(WithArray);

      parse(instance, { tags: ['a', 'b', 'c'], scores: [1, 2, 3] });

      assert.deepEqual(instance.tags, ['a', 'b', 'c']);
      assert.deepEqual(instance.scores, [1, 2, 3]);
    });

    it('should handle empty arrays', () => {
      const instance = create(WithArray);

      parse(instance, { tags: [], scores: [] });

      assert.deepEqual(instance.tags, []);
      assert.deepEqual(instance.scores, []);
    });

    it('should throw for invalid array item', () => {
      const instance = create(WithArray);

      assert.throws(() => parse(instance, { tags: [123], scores: [] }), SchemaError);
    });
  });

  describe('enums', () => {
    it('should populate enum field', () => {
      const instance = create(WithEnum);

      parse(instance, { role: 'admin' });
      assert.equal(instance.role, 'admin');

      parse(instance, { role: 'user' });
      assert.equal(instance.role, 'user');
    });

    it('should throw for invalid enum value', () => {
      const instance = create(WithEnum);

      assert.throws(() => parse(instance, { role: 'superadmin' }), SchemaError);
    });
  });

  describe('numbers', () => {
    it('should populate number field', () => {
      const instance = create(WithNumber);

      parse(instance, { price: 19.99 });

      assert.equal(instance.price, 19.99);
    });

    it('should handle zero', () => {
      const instance = create(WithNumber);

      parse(instance, { price: 0 });

      assert.equal(instance.price, 0);
    });

    it('should handle negative numbers', () => {
      const instance = create(WithNumber);

      parse(instance, { price: -10.5 });

      assert.equal(instance.price, -10.5);
    });
  });

  describe('multiple parses', () => {
    it('should allow re-parsing with different data', () => {
      const instance = create(SimpleSchema);

      parse(instance, { name: 'Alice', age: 25 });
      assert.equal(instance.name, 'Alice');

      parse(instance, { name: 'Bob', age: 30 });
      assert.equal(instance.name, 'Bob');
      assert.equal(instance.age, 30);
    });
  });

  describe('edge cases', () => {
    it('should handle unicode values', () => {
      const instance = create(SimpleSchema);

      parse(instance, { name: '日本語 🎉', age: 25 });

      assert.equal(instance.name, '日本語 🎉');
    });

    it('should handle very large arrays', () => {
      const instance = create(WithArray);
      const largeTags = globalThis.Array.from({ length: 1000 }, (_, i) => `tag${i}`);

      parse(instance, { tags: largeTags, scores: [] });

      assert.equal(instance.tags.length, 1000);
    });

    it('should handle deeply nested objects', () => {
      class Deep {
        outer = Object(WithNested);
      }
      const instance = create(Deep);

      parse(instance, {
        outer: {
          name: 'Outer',
          address: { street: 'Deep St', city: 'Deep City' },
        },
      });

      assert.equal(instance.outer.address.city, 'Deep City');
    });
  });
});
