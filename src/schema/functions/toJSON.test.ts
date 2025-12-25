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
import { toJSON } from './toJSON.js';

// Test schemas
class SimpleSchema {
  name = String();
  age = Integer();
}

class WithDescription {
  name = String({ description: 'Full name' });
}

class WithDefaults {
  name = String({ default: 'Anonymous' });
  active = Boolean({ default: true });
  count = Integer({ default: 0 });
}

class WithOptional {
  name = String();
  email = String({ optional: true });
}

class WithStringConstraints {
  name = String({ minLength: 1, maxLength: 100, pattern: '^[a-z]+$' });
  email = String({ format: 'email' });
}

class WithNumberConstraints {
  age = Integer({ minimum: 0, maximum: 150 });
  price = Number({ exclusiveMinimum: 0, exclusiveMaximum: 1000 });
  step = Number({ multipleOf: 0.5 });
}

class WithArray {
  tags = Array(String(), { minItems: 1, maxItems: 10, uniqueItems: true });
}

class NestedAddress {
  street = String();
  city = String();
}

class WithNested {
  name = String();
  address = Object(NestedAddress);
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

describe('toJSON', () => {
  describe('basic schema', () => {
    it('should generate JSON Schema with $schema', () => {
      const instance = create(SimpleSchema);
      const schema = toJSON(instance);

      assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    });

    it('should have type object', () => {
      const instance = create(SimpleSchema);
      const schema = toJSON(instance);

      assert.equal(schema.type, 'object');
    });

    it('should include properties', () => {
      const instance = create(SimpleSchema);
      const schema = toJSON(instance);

      assert.ok(schema.properties);
      assert.ok(schema.properties.name);
      assert.ok(schema.properties.age);
    });

    it('should have correct property types', () => {
      const instance = create(SimpleSchema);
      const schema = toJSON(instance);

      assert.equal(schema.properties!.name!.type, 'string');
      assert.equal(schema.properties!.age!.type, 'integer');
    });

    it('should include required fields', () => {
      const instance = create(SimpleSchema);
      const schema = toJSON(instance);

      assert.ok(schema.required);
      assert.ok(schema.required.includes('name'));
      assert.ok(schema.required.includes('age'));
    });
  });

  describe('description', () => {
    it('should include description', () => {
      const instance = create(WithDescription);
      const schema = toJSON(instance);

      assert.equal(schema.properties!.name!.description, 'Full name');
    });
  });

  describe('defaults', () => {
    it('should include default values', () => {
      const instance = create(WithDefaults);
      const schema = toJSON(instance);

      assert.equal(schema.properties!.name!.default, 'Anonymous');
      assert.equal(schema.properties!.active!.default, true);
      assert.equal(schema.properties!.count!.default, 0);
    });
  });

  describe('optional fields', () => {
    it('should not include optional fields in required', () => {
      const instance = create(WithOptional);
      const schema = toJSON(instance);

      assert.ok(schema.required!.includes('name'));
      assert.ok(!schema.required!.includes('email'));
    });
  });

  describe('string constraints', () => {
    it('should include minLength', () => {
      const instance = create(WithStringConstraints);
      const schema = toJSON(instance);

      assert.equal(schema.properties!.name!.minLength, 1);
    });

    it('should include maxLength', () => {
      const instance = create(WithStringConstraints);
      const schema = toJSON(instance);

      assert.equal(schema.properties!.name!.maxLength, 100);
    });

    it('should include pattern', () => {
      const instance = create(WithStringConstraints);
      const schema = toJSON(instance);

      assert.equal(schema.properties!.name!.pattern, '^[a-z]+$');
    });

    it('should include format', () => {
      const instance = create(WithStringConstraints);
      const schema = toJSON(instance);

      assert.equal(schema.properties!.email!.format, 'email');
    });
  });

  describe('number constraints', () => {
    it('should include minimum', () => {
      const instance = create(WithNumberConstraints);
      const schema = toJSON(instance);

      assert.equal(schema.properties!.age!.minimum, 0);
    });

    it('should include maximum', () => {
      const instance = create(WithNumberConstraints);
      const schema = toJSON(instance);

      assert.equal(schema.properties!.age!.maximum, 150);
    });

    it('should include exclusiveMinimum', () => {
      const instance = create(WithNumberConstraints);
      const schema = toJSON(instance);

      assert.equal(schema.properties!.price!.exclusiveMinimum, 0);
    });

    it('should include exclusiveMaximum', () => {
      const instance = create(WithNumberConstraints);
      const schema = toJSON(instance);

      assert.equal(schema.properties!.price!.exclusiveMaximum, 1000);
    });

    it('should include multipleOf', () => {
      const instance = create(WithNumberConstraints);
      const schema = toJSON(instance);

      assert.equal(schema.properties!.step!.multipleOf, 0.5);
    });
  });

  describe('arrays', () => {
    it('should have type array', () => {
      const instance = create(WithArray);
      const schema = toJSON(instance);

      assert.equal(schema.properties!.tags!.type, 'array');
    });

    it('should include items type', () => {
      const instance = create(WithArray);
      const schema = toJSON(instance);

      assert.deepEqual(schema.properties!.tags!.items, { type: 'string' });
    });

    it('should include minItems', () => {
      const instance = create(WithArray);
      const schema = toJSON(instance);

      assert.equal(schema.properties!.tags!.minItems, 1);
    });

    it('should include maxItems', () => {
      const instance = create(WithArray);
      const schema = toJSON(instance);

      assert.equal(schema.properties!.tags!.maxItems, 10);
    });

    it('should include uniqueItems', () => {
      const instance = create(WithArray);
      const schema = toJSON(instance);

      assert.equal(schema.properties!.tags!.uniqueItems, true);
    });
  });

  describe('nested objects', () => {
    it('should have type object for nested', () => {
      const instance = create(WithNested);
      const schema = toJSON(instance);

      assert.equal(schema.properties!.address!.type, 'object');
    });

    it('should include nested properties', () => {
      const instance = create(WithNested);
      const schema = toJSON(instance);

      assert.ok(schema.properties!.address!.properties);
      assert.equal(schema.properties!.address!.properties!.street!.type, 'string');
      assert.equal(schema.properties!.address!.properties!.city!.type, 'string');
    });

    it('should include nested required', () => {
      const instance = create(WithNested);
      const schema = toJSON(instance);

      assert.ok(schema.properties!.address!.required);
      assert.ok(schema.properties!.address!.required!.includes('street'));
      assert.ok(schema.properties!.address!.required!.includes('city'));
    });
  });

  describe('enum', () => {
    it('should include enum values', () => {
      const instance = create(WithEnum);
      const schema = toJSON(instance);

      assert.deepEqual(schema.properties!.role!.enum, ['admin', 'user', 'guest']);
    });
  });

  describe('literal', () => {
    it('should include const value', () => {
      const instance = create(WithLiteral);
      const schema = toJSON(instance);

      assert.equal(schema.properties!.version!.const, '1.0');
    });
  });

  describe('null', () => {
    it('should have type null', () => {
      const instance = create(WithNull);
      const schema = toJSON(instance);

      assert.equal(schema.properties!.deleted!.type, 'null');
    });
  });

  describe('edge cases', () => {
    it('should handle empty schema', () => {
      class Empty {}
      const instance = create(Empty);
      const schema = toJSON(instance);

      assert.equal(schema.type, 'object');
      assert.deepEqual(schema.properties, {});
      assert.equal(schema.required, undefined);
    });

    it('should handle boolean type', () => {
      class WithBool {
        active = Boolean();
      }
      const instance = create(WithBool);
      const schema = toJSON(instance);

      assert.equal(schema.properties!.active!.type, 'boolean');
    });

    it('should handle number type', () => {
      class WithNum {
        value = Number();
      }
      const instance = create(WithNum);
      const schema = toJSON(instance);

      assert.equal(schema.properties!.value!.type, 'number');
    });
  });

  describe('JSON serialization', () => {
    it('should be valid JSON', () => {
      const instance = create(SimpleSchema);
      const schema = toJSON(instance);
      const json = JSON.stringify(schema);

      assert.ok(json);
      const parsed = JSON.parse(json);
      assert.deepEqual(parsed, schema);
    });
  });
});
