import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Schema, SchemaError } from './index.js';

// Test schemas
class Address extends Schema {
  street = Schema.String({ description: 'Street address' });
  city = Schema.String({ description: 'City name' });
  zip = Schema.String({ pattern: '^\\d{5}$' });
}

class User extends Schema {
  name = Schema.String({ description: 'Full name', minLength: 1 });
  email = Schema.String({ format: 'email', optional: true });
  age = Schema.Integer({ minimum: 0, maximum: 150 });
  active = Schema.Boolean({ default: true });
  role = Schema.Enum(['admin', 'user', 'guest'] as const);
  tags = Schema.Array(Schema.String(), { minItems: 1, maxItems: 5 });
  address = Schema.Object(Address);
}

class SimpleUser extends Schema {
  name = Schema.String();
  age = Schema.Integer();
}

describe('Schema', () => {
  describe('create', () => {
    it('should create a proxied instance', () => {
      const user = Schema.create(SimpleUser);

      assert.ok(user);
      assert.equal(user.name, '');
      assert.equal(user.age, 0);
    });

    it('should allow direct property access', () => {
      const user = Schema.create(SimpleUser);

      user.name = 'Alice';
      user.age = 30;

      assert.equal(user.name, 'Alice');
      assert.equal(user.age, 30);
    });
  });

  describe('toJSON', () => {
    it('should generate JSON Schema', () => {
      const user = Schema.create(SimpleUser);
      const schema = Schema.toJSON(user);

      assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
      assert.equal(schema.type, 'object');
      assert.ok(schema.properties);
      assert.deepEqual(schema.properties!.name, { type: 'string' });
      assert.deepEqual(schema.properties!.age, { type: 'integer' });
      assert.deepEqual(schema.required, ['name', 'age']);
    });

    it('should include string constraints', () => {
      class StringSchema extends Schema {
        text = Schema.String({
          description: 'Some text',
          minLength: 1,
          maxLength: 100,
          pattern: '^[a-z]+$',
        });
      }

      const instance = Schema.create(StringSchema);
      const schema = Schema.toJSON(instance);

      assert.equal(schema.properties!.text!.description, 'Some text');
      assert.equal(schema.properties!.text!.minLength, 1);
      assert.equal(schema.properties!.text!.maxLength, 100);
      assert.equal(schema.properties!.text!.pattern, '^[a-z]+$');
    });

    it('should include number constraints', () => {
      class NumberSchema extends Schema {
        value = Schema.Number({ minimum: 0, maximum: 100, multipleOf: 0.5 });
      }

      const instance = Schema.create(NumberSchema);
      const schema = Schema.toJSON(instance);

      assert.equal(schema.properties!.value!.minimum, 0);
      assert.equal(schema.properties!.value!.maximum, 100);
      assert.equal(schema.properties!.value!.multipleOf, 0.5);
    });

    it('should handle enum', () => {
      class EnumSchema extends Schema {
        status = Schema.Enum(['active', 'inactive'] as const);
      }

      const instance = Schema.create(EnumSchema);
      const schema = Schema.toJSON(instance);

      assert.deepEqual(schema.properties!.status!.enum, ['active', 'inactive']);
    });

    it('should handle arrays', () => {
      class ArraySchema extends Schema {
        items = Schema.Array(Schema.String(), { minItems: 1, maxItems: 10 });
      }

      const instance = Schema.create(ArraySchema);
      const schema = Schema.toJSON(instance);

      assert.equal(schema.properties!.items!.type, 'array');
      assert.deepEqual(schema.properties!.items!.items, { type: 'string' });
      assert.equal(schema.properties!.items!.minItems, 1);
      assert.equal(schema.properties!.items!.maxItems, 10);
    });

    it('should handle nested objects', () => {
      const user = Schema.create(User);
      const schema = Schema.toJSON(user);

      assert.equal(schema.properties!.address!.type, 'object');
      assert.ok(schema.properties!.address!.properties);
      assert.equal(schema.properties!.address!.properties!.city!.type, 'string');
    });

    it('should handle optional fields', () => {
      const user = Schema.create(User);
      const schema = Schema.toJSON(user);

      assert.ok(!schema.required!.includes('email'));
      assert.ok(schema.required!.includes('name'));
    });
  });

  describe('stringify', () => {
    it('should return JSON string', () => {
      const user = Schema.create(SimpleUser);
      const str = Schema.stringify(user);

      assert.equal(typeof str, 'string');
      const parsed = JSON.parse(str);
      assert.equal(parsed.$schema, 'https://json-schema.org/draft/2020-12/schema');
    });

    it('should support non-pretty output', () => {
      const user = Schema.create(SimpleUser);
      const str = Schema.stringify(user, false);

      assert.ok(!str.includes('\n'));
    });
  });

  describe('validate', () => {
    it('should return true for valid data', () => {
      const user = Schema.create(SimpleUser);
      const valid = Schema.validate(user, { name: 'Alice', age: 30 });

      assert.equal(valid, true);
    });

    it('should return false for missing field', () => {
      const user = Schema.create(SimpleUser);
      const valid = Schema.validate(user, { name: 'Alice' });

      assert.equal(valid, false);
    });

    it('should return false for wrong type', () => {
      const user = Schema.create(SimpleUser);
      const valid = Schema.validate(user, { name: 'Alice', age: 'thirty' });

      assert.equal(valid, false);
    });

    it('should return false for constraint violation', () => {
      class Constrained extends Schema {
        name = Schema.String({ minLength: 1 });
      }

      const instance = Schema.create(Constrained);
      const valid = Schema.validate(instance, { name: '' });

      assert.equal(valid, false);
    });

    it('should validate enum values', () => {
      class WithEnum extends Schema {
        role = Schema.Enum(['a', 'b'] as const);
      }

      const instance = Schema.create(WithEnum);

      assert.equal(Schema.validate(instance, { role: 'a' }), true);
      assert.equal(Schema.validate(instance, { role: 'c' }), false);
    });

    it('should validate arrays', () => {
      class WithArray extends Schema {
        tags = Schema.Array(Schema.String(), { minItems: 1 });
      }

      const instance = Schema.create(WithArray);

      assert.equal(Schema.validate(instance, { tags: ['a'] }), true);
      assert.equal(Schema.validate(instance, { tags: [] }), false);
    });

    it('should validate optional fields', () => {
      class WithOptional extends Schema {
        name = Schema.String();
        email = Schema.String({ optional: true });
      }

      const instance = Schema.create(WithOptional);

      assert.equal(Schema.validate(instance, { name: 'Alice' }), true);
      assert.equal(Schema.validate(instance, { name: 'Alice', email: null }), true);
    });
  });

  describe('parse', () => {
    it('should populate instance with valid data', () => {
      const user = Schema.create(SimpleUser);

      Schema.parse(user, { name: 'Alice', age: 30 });

      assert.equal(user.name, 'Alice');
      assert.equal(user.age, 30);
    });

    it('should throw SchemaError for invalid data', () => {
      const user = Schema.create(SimpleUser);

      assert.throws(() => Schema.parse(user, { name: 'Alice' }), SchemaError);
    });

    it('should populate nested objects', () => {
      const user = Schema.create(User);

      Schema.parse(user, {
        name: 'Alice',
        age: 30,
        role: 'admin',
        tags: ['vip'],
        address: { street: '123 Main', city: 'Boston', zip: '02101' },
      });

      assert.equal(user.name, 'Alice');
      assert.equal(user.address.city, 'Boston');
    });

    it('should populate arrays', () => {
      class WithArray extends Schema {
        tags = Schema.Array(Schema.String());
      }

      const instance = Schema.create(WithArray);
      Schema.parse(instance, { tags: ['a', 'b', 'c'] });

      assert.deepEqual(instance.tags, ['a', 'b', 'c']);
    });
  });

  describe('toObject', () => {
    it('should extract plain object', () => {
      const user = Schema.create(SimpleUser);
      user.name = 'Alice';
      user.age = 30;

      const obj = Schema.toObject(user);

      assert.deepEqual(obj, { name: 'Alice', age: 30 });
    });

    it('should extract nested objects', () => {
      const user = Schema.create(User);
      Schema.parse(user, {
        name: 'Alice',
        age: 30,
        role: 'admin',
        tags: ['vip'],
        address: { street: '123 Main', city: 'Boston', zip: '02101' },
      });

      const obj = Schema.toObject(user);

      assert.equal(obj.name, 'Alice');
      assert.equal((obj.address as any).city, 'Boston');
    });
  });

  describe('clone', () => {
    it('should create independent copy', () => {
      const user = Schema.create(SimpleUser);
      user.name = 'Alice';
      user.age = 30;

      const copy = Schema.clone(user);
      copy.name = 'Bob';
      copy.age = 25;

      assert.equal(user.name, 'Alice');
      assert.equal(user.age, 30);
      assert.equal(copy.name, 'Bob');
      assert.equal(copy.age, 25);
    });

    it('should deep clone arrays', () => {
      class WithArray extends Schema {
        tags = Schema.Array(Schema.String());
      }

      const instance = Schema.create(WithArray);
      instance.tags = ['a', 'b'];

      const copy = Schema.clone(instance);
      (copy.tags as string[]).push('c');

      assert.deepEqual(instance.tags, ['a', 'b']);
      assert.deepEqual(copy.tags, ['a', 'b', 'c']);
    });
  });

  describe('Literal', () => {
    it('should work with literal values', () => {
      class API extends Schema {
        version = Schema.Literal('1.0');
        enabled = Schema.Literal(true);
      }

      const api = Schema.create(API);

      assert.equal(api.version, '1.0');
      assert.equal(api.enabled, true);
    });

    it('should validate literal values', () => {
      class API extends Schema {
        version = Schema.Literal('1.0');
      }

      const api = Schema.create(API);

      assert.equal(Schema.validate(api, { version: '1.0' }), true);
      assert.equal(Schema.validate(api, { version: '2.0' }), false);
    });

    it('should generate const in JSON Schema', () => {
      class API extends Schema {
        version = Schema.Literal('1.0');
      }

      const api = Schema.create(API);
      const schema = Schema.toJSON(api);

      assert.equal(schema.properties!.version!.const, '1.0');
    });
  });

  describe('Null', () => {
    it('should work with null values', () => {
      class Nullable extends Schema {
        deleted = Schema.Null();
      }

      const instance = Schema.create(Nullable);

      assert.equal(instance.deleted, null);
    });

    it('should validate null', () => {
      class Nullable extends Schema {
        deleted = Schema.Null();
      }

      const instance = Schema.create(Nullable);

      assert.equal(Schema.validate(instance, { deleted: null }), true);
      assert.equal(Schema.validate(instance, { deleted: 'value' }), false);
    });
  });
});
