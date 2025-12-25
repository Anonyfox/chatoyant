import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Array } from '../descriptors/array.js';
import { Boolean } from '../descriptors/boolean.js';
import { Enum } from '../descriptors/enum.js';
import { Integer } from '../descriptors/integer.js';
import { Literal } from '../descriptors/literal.js';
import { Null } from '../descriptors/nullable.js';
import { Number } from '../descriptors/number.js';
import { Object } from '../descriptors/object.js';
import { String } from '../descriptors/string.js';
import { create } from './create.js';
import { validate } from './validate.js';

// Test schemas
class SimpleSchema {
  name = String();
  age = Integer();
}

class WithConstraints {
  name = String({ minLength: 1, maxLength: 50 });
  age = Integer({ minimum: 0, maximum: 150 });
  score = Number({ minimum: 0, maximum: 100 });
}

class WithOptional {
  name = String();
  email = String({ optional: true });
}

class WithDefaults {
  name = String();
  active = Boolean({ default: true });
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
  tags = Array(String(), { minItems: 1, maxItems: 5 });
}

class WithEnum {
  role = Enum(['admin', 'user', 'guest'] as const);
}

class WithLiteral {
  version = Literal('1.0');
}

class WithNull {
  deleted = Null();
}

class WithPattern {
  email = String({ pattern: '^[^@]+@[^@]+\\.[^@]+$' });
}

describe('validate', () => {
  describe('basic validation', () => {
    it('should return true for valid data', () => {
      const instance = create(SimpleSchema);
      const result = validate(instance, { name: 'Alice', age: 30 });

      assert.equal(result, true);
    });

    it('should return false for missing required field', () => {
      const instance = create(SimpleSchema);
      const result = validate(instance, { name: 'Alice' });

      assert.equal(result, false);
    });

    it('should return false for wrong type', () => {
      const instance = create(SimpleSchema);
      const result = validate(instance, { name: 'Alice', age: 'thirty' });

      assert.equal(result, false);
    });

    it('should return false for null input', () => {
      const instance = create(SimpleSchema);
      const result = validate(instance, null);

      assert.equal(result, false);
    });

    it('should return false for undefined input', () => {
      const instance = create(SimpleSchema);
      const result = validate(instance, undefined);

      assert.equal(result, false);
    });

    it('should return false for primitive input', () => {
      const instance = create(SimpleSchema);

      assert.equal(validate(instance, 'string'), false);
      assert.equal(validate(instance, 123), false);
      assert.equal(validate(instance, true), false);
    });

    it('should return false for array input', () => {
      const instance = create(SimpleSchema);
      const result = validate(instance, []);

      assert.equal(result, false);
    });
  });

  describe('string constraints', () => {
    it('should validate minLength', () => {
      const instance = create(WithConstraints);

      assert.equal(validate(instance, { name: 'A', age: 25, score: 50 }), true);
      assert.equal(validate(instance, { name: '', age: 25, score: 50 }), false);
    });

    it('should validate maxLength', () => {
      const instance = create(WithConstraints);
      const longName = 'a'.repeat(51);

      assert.equal(validate(instance, { name: 'Valid', age: 25, score: 50 }), true);
      assert.equal(validate(instance, { name: longName, age: 25, score: 50 }), false);
    });

    it('should validate pattern', () => {
      const instance = create(WithPattern);

      assert.equal(validate(instance, { email: 'test@example.com' }), true);
      assert.equal(validate(instance, { email: 'invalid-email' }), false);
    });
  });

  describe('number constraints', () => {
    it('should validate minimum', () => {
      const instance = create(WithConstraints);

      assert.equal(validate(instance, { name: 'A', age: 0, score: 50 }), true);
      assert.equal(validate(instance, { name: 'A', age: -1, score: 50 }), false);
    });

    it('should validate maximum', () => {
      const instance = create(WithConstraints);

      assert.equal(validate(instance, { name: 'A', age: 150, score: 50 }), true);
      assert.equal(validate(instance, { name: 'A', age: 151, score: 50 }), false);
    });

    it('should validate number type', () => {
      const instance = create(WithConstraints);

      assert.equal(validate(instance, { name: 'A', age: 25, score: 75.5 }), true);
      assert.equal(validate(instance, { name: 'A', age: 25, score: 'fifty' }), false);
    });
  });

  describe('integer validation', () => {
    it('should reject non-integer numbers', () => {
      const instance = create(SimpleSchema);

      assert.equal(validate(instance, { name: 'A', age: 25 }), true);
      assert.equal(validate(instance, { name: 'A', age: 25.5 }), false);
    });
  });

  describe('optional fields', () => {
    it('should accept missing optional field', () => {
      const instance = create(WithOptional);

      assert.equal(validate(instance, { name: 'Alice' }), true);
    });

    it('should accept null for optional field', () => {
      const instance = create(WithOptional);

      assert.equal(validate(instance, { name: 'Alice', email: null }), true);
    });

    it('should accept undefined for optional field', () => {
      const instance = create(WithOptional);

      assert.equal(validate(instance, { name: 'Alice', email: undefined }), true);
    });

    it('should validate optional field when present', () => {
      const instance = create(WithOptional);

      assert.equal(validate(instance, { name: 'Alice', email: 'test@test.com' }), true);
      assert.equal(validate(instance, { name: 'Alice', email: 123 }), false);
    });
  });

  describe('default values', () => {
    it('should accept missing field with default', () => {
      const instance = create(WithDefaults);

      assert.equal(validate(instance, { name: 'Alice' }), true);
    });

    it('should accept explicit value for field with default', () => {
      const instance = create(WithDefaults);

      assert.equal(validate(instance, { name: 'Alice', active: false }), true);
    });
  });

  describe('nested objects', () => {
    it('should validate nested object', () => {
      const instance = create(WithNested);

      assert.equal(
        validate(instance, {
          name: 'Alice',
          address: { street: '123 Main', city: 'Boston' },
        }),
        true,
      );
    });

    it('should reject invalid nested object', () => {
      const instance = create(WithNested);

      assert.equal(
        validate(instance, {
          name: 'Alice',
          address: { street: 123, city: 'Boston' },
        }),
        false,
      );
    });

    it('should reject missing nested field', () => {
      const instance = create(WithNested);

      assert.equal(
        validate(instance, {
          name: 'Alice',
          address: { street: '123 Main' },
        }),
        false,
      );
    });

    it('should reject non-object for nested field', () => {
      const instance = create(WithNested);

      assert.equal(
        validate(instance, {
          name: 'Alice',
          address: 'not an object',
        }),
        false,
      );
    });
  });

  describe('arrays', () => {
    it('should validate array', () => {
      const instance = create(WithArray);

      assert.equal(validate(instance, { tags: ['a', 'b'] }), true);
    });

    it('should validate minItems', () => {
      const instance = create(WithArray);

      assert.equal(validate(instance, { tags: ['a'] }), true);
      assert.equal(validate(instance, { tags: [] }), false);
    });

    it('should validate maxItems', () => {
      const instance = create(WithArray);

      assert.equal(validate(instance, { tags: ['a', 'b', 'c', 'd', 'e'] }), true);
      assert.equal(validate(instance, { tags: ['1', '2', '3', '4', '5', '6'] }), false);
    });

    it('should validate array item types', () => {
      const instance = create(WithArray);

      assert.equal(validate(instance, { tags: ['valid'] }), true);
      assert.equal(validate(instance, { tags: [123] }), false);
    });

    it('should reject non-array', () => {
      const instance = create(WithArray);

      assert.equal(validate(instance, { tags: 'not-array' }), false);
    });
  });

  describe('enum', () => {
    it('should validate enum value', () => {
      const instance = create(WithEnum);

      assert.equal(validate(instance, { role: 'admin' }), true);
      assert.equal(validate(instance, { role: 'user' }), true);
      assert.equal(validate(instance, { role: 'guest' }), true);
    });

    it('should reject invalid enum value', () => {
      const instance = create(WithEnum);

      assert.equal(validate(instance, { role: 'superadmin' }), false);
      assert.equal(validate(instance, { role: 123 }), false);
    });
  });

  describe('literal', () => {
    it('should validate literal value', () => {
      const instance = create(WithLiteral);

      assert.equal(validate(instance, { version: '1.0' }), true);
    });

    it('should reject non-literal value', () => {
      const instance = create(WithLiteral);

      assert.equal(validate(instance, { version: '2.0' }), false);
      assert.equal(validate(instance, { version: 1.0 }), false);
    });
  });

  describe('null', () => {
    it('should validate null value', () => {
      const instance = create(WithNull);

      assert.equal(validate(instance, { deleted: null }), true);
    });

    it('should reject non-null value', () => {
      const instance = create(WithNull);

      assert.equal(validate(instance, { deleted: 'not null' }), false);
      assert.equal(validate(instance, { deleted: 0 }), false);
      assert.equal(validate(instance, { deleted: false }), false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty object for empty schema', () => {
      class Empty {}
      const instance = create(Empty);

      assert.equal(validate(instance, {}), true);
    });

    it('should ignore extra properties in data', () => {
      const instance = create(SimpleSchema);

      assert.equal(validate(instance, { name: 'Alice', age: 30, extra: 'ignored' }), true);
    });

    it('should handle deeply nested valid data', () => {
      class Deep {
        level1 = Object(WithNested);
      }
      const instance = create(Deep);

      assert.equal(
        validate(instance, {
          level1: {
            name: 'Alice',
            address: { street: '123', city: 'Boston' },
          },
        }),
        true,
      );
    });
  });
});
