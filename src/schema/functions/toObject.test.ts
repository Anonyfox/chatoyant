import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Array } from '../descriptors/array.js';
import { Boolean } from '../descriptors/boolean.js';
import { Integer } from '../descriptors/integer.js';
import { Number } from '../descriptors/number.js';
import { Object } from '../descriptors/object.js';
import { String } from '../descriptors/string.js';
import { create } from './create.js';
import { parse } from './parse.js';
import { toObject } from './toObject.js';

// Test schemas
class SimpleSchema {
  name = String();
  age = Integer();
}

class WithDefaults {
  name = String({ default: 'Anonymous' });
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
  tags = Array(String());
  scores = Array(Integer());
}

class WithNumber {
  price = Number();
}

class ComplexSchema {
  name = String();
  age = Integer();
  active = Boolean();
  tags = Array(String());
  address = Object(NestedAddress);
}

describe('toObject', () => {
  describe('basic extraction', () => {
    it('should return a plain object', () => {
      const instance = create(SimpleSchema);
      const obj = toObject(instance);

      assert.equal(typeof obj, 'object');
      assert.ok(obj !== null);
    });

    it('should extract default values', () => {
      const instance = create(SimpleSchema);
      const obj = toObject(instance);

      assert.equal(obj.name, '');
      assert.equal(obj.age, 0);
    });

    it('should extract set values', () => {
      const instance = create(SimpleSchema);
      instance.name = 'Alice';
      instance.age = 30;

      const obj = toObject(instance);

      assert.equal(obj.name, 'Alice');
      assert.equal(obj.age, 30);
    });

    it('should extract custom defaults', () => {
      const instance = create(WithDefaults);
      const obj = toObject(instance);

      assert.equal(obj.name, 'Anonymous');
      assert.equal(obj.active, true);
    });
  });

  describe('nested objects', () => {
    it('should extract nested objects', () => {
      const instance = create(WithNested);
      parse(instance, {
        name: 'Alice',
        address: { street: '123 Main', city: 'Boston' },
      });

      const obj = toObject(instance);

      assert.equal(obj.name, 'Alice');
      assert.ok(obj.address);
      assert.equal((obj.address as any).street, '123 Main');
      assert.equal((obj.address as any).city, 'Boston');
    });

    it('should extract default nested objects', () => {
      const instance = create(WithNested);
      const obj = toObject(instance);

      assert.ok(obj.address);
      assert.equal((obj.address as any).street, '');
      assert.equal((obj.address as any).city, '');
    });
  });

  describe('arrays', () => {
    it('should extract arrays', () => {
      const instance = create(WithArray);
      instance.tags = ['a', 'b', 'c'];
      instance.scores = [1, 2, 3];

      const obj = toObject(instance);

      assert.deepEqual(obj.tags, ['a', 'b', 'c']);
      assert.deepEqual(obj.scores, [1, 2, 3]);
    });

    it('should extract empty arrays', () => {
      const instance = create(WithArray);
      const obj = toObject(instance);

      assert.deepEqual(obj.tags, []);
      assert.deepEqual(obj.scores, []);
    });
  });

  describe('numbers', () => {
    it('should extract number values', () => {
      const instance = create(WithNumber);
      instance.price = 19.99;

      const obj = toObject(instance);

      assert.equal(obj.price, 19.99);
    });

    it('should extract zero', () => {
      const instance = create(WithNumber);
      const obj = toObject(instance);

      assert.equal(obj.price, 0);
    });
  });

  describe('complex schemas', () => {
    it('should extract complex nested data', () => {
      const instance = create(ComplexSchema);
      parse(instance, {
        name: 'Alice',
        age: 30,
        active: true,
        tags: ['vip', 'premium'],
        address: { street: '456 Oak', city: 'Chicago' },
      });

      const obj = toObject(instance);

      assert.equal(obj.name, 'Alice');
      assert.equal(obj.age, 30);
      assert.equal(obj.active, true);
      assert.deepEqual(obj.tags, ['vip', 'premium']);
      assert.equal((obj.address as any).street, '456 Oak');
      assert.equal((obj.address as any).city, 'Chicago');
    });
  });

  describe('immutability', () => {
    it('should return new object', () => {
      const instance = create(SimpleSchema);
      const obj1 = toObject(instance);
      const obj2 = toObject(instance);

      assert.notStrictEqual(obj1, obj2);
    });

    it('should not affect original when modifying result', () => {
      const instance = create(SimpleSchema);
      instance.name = 'Original';

      const obj = toObject(instance);
      (obj as any).name = 'Modified';

      assert.equal(instance.name, 'Original');
    });

    it('should return new array instances', () => {
      const instance = create(WithArray);
      instance.tags = ['a', 'b'];

      const obj = toObject(instance);
      (obj.tags as string[]).push('c');

      assert.deepEqual(instance.tags, ['a', 'b']);
    });
  });

  describe('edge cases', () => {
    it('should handle empty schema', () => {
      class Empty {}
      const instance = create(Empty);
      const obj = toObject(instance);

      assert.deepEqual(obj, {});
    });

    it('should handle unicode values', () => {
      const instance = create(SimpleSchema);
      instance.name = '日本語 🎉';

      const obj = toObject(instance);

      assert.equal(obj.name, '日本語 🎉');
    });

    it('should handle special string values', () => {
      const instance = create(SimpleSchema);
      instance.name = 'line1\nline2\ttab';

      const obj = toObject(instance);

      assert.equal(obj.name, 'line1\nline2\ttab');
    });
  });

  describe('JSON serialization', () => {
    it('should produce JSON-serializable object', () => {
      const instance = create(SimpleSchema);
      instance.name = 'Test';
      instance.age = 25;

      const obj = toObject(instance);
      const json = JSON.stringify(obj);
      const parsed = JSON.parse(json);

      assert.deepEqual(parsed, { name: 'Test', age: 25 });
    });

    it('should produce same result as JSON roundtrip', () => {
      const instance = create(ComplexSchema);
      parse(instance, {
        name: 'Test',
        age: 25,
        active: true,
        tags: ['a', 'b'],
        address: { street: 'Main', city: 'NYC' },
      });

      const obj = toObject(instance);
      const json = JSON.stringify(obj);
      const parsed = JSON.parse(json);

      assert.deepEqual(obj, parsed);
    });
  });
});
