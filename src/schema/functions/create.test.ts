import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Array } from '../descriptors/array.js';
import { Boolean } from '../descriptors/boolean.js';
import { Integer } from '../descriptors/integer.js';
import { Object } from '../descriptors/object.js';
import { String } from '../descriptors/string.js';
import { isProxied } from '../proxy.js';
import { create } from './create.js';

// Test schemas
class SimpleSchema {
  name = String();
  age = Integer();
}

class WithDefaults {
  name = String({ default: 'Anonymous' });
  active = Boolean({ default: true });
  count = Integer({ default: 42 });
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

class EmptySchema {}

class ComplexSchema {
  name = String({ description: 'Name', minLength: 1 });
  age = Integer({ minimum: 0, maximum: 150 });
  active = Boolean({ default: true });
  tags = Array(String());
  address = Object(NestedAddress);
}

describe('create', () => {
  describe('basic creation', () => {
    it('should create a proxied instance', () => {
      const instance = create(SimpleSchema);

      assert.ok(instance);
      assert.equal(isProxied(instance), true);
    });

    it('should have default values', () => {
      const instance = create(SimpleSchema);

      assert.equal(instance.name, '');
      assert.equal(instance.age, 0);
    });

    it('should allow property access', () => {
      const instance = create(SimpleSchema);

      assert.equal(typeof instance.name, 'string');
      assert.equal(typeof instance.age, 'number');
    });

    it('should allow property assignment', () => {
      const instance = create(SimpleSchema);

      instance.name = 'Alice';
      instance.age = 30;

      assert.equal(instance.name, 'Alice');
      assert.equal(instance.age, 30);
    });
  });

  describe('default values', () => {
    it('should respect custom defaults', () => {
      const instance = create(WithDefaults);

      assert.equal(instance.name, 'Anonymous');
      assert.equal(instance.active, true);
      assert.equal(instance.count, 42);
    });

    it('should allow overriding defaults', () => {
      const instance = create(WithDefaults);

      instance.name = 'Custom';
      instance.active = false;
      instance.count = 100;

      assert.equal(instance.name, 'Custom');
      assert.equal(instance.active, false);
      assert.equal(instance.count, 100);
    });
  });

  describe('nested schemas', () => {
    it('should create nested schema instances', () => {
      const instance = create(WithNested);

      assert.ok(instance.address);
      assert.equal(typeof instance.address, 'object');
    });

    it('should allow accessing nested properties', () => {
      const instance = create(WithNested);

      assert.equal(instance.address.street, '');
      assert.equal(instance.address.city, '');
    });

    it('should allow setting nested properties', () => {
      const instance = create(WithNested);

      instance.address.street = '123 Main St';
      instance.address.city = 'Boston';

      assert.equal(instance.address.street, '123 Main St');
      assert.equal(instance.address.city, 'Boston');
    });
  });

  describe('array fields', () => {
    it('should create empty arrays by default', () => {
      const instance = create(WithArray);

      assert.deepEqual(instance.tags, []);
      assert.deepEqual(instance.scores, []);
    });

    it('should allow setting arrays', () => {
      const instance = create(WithArray);

      instance.tags = ['a', 'b', 'c'];
      instance.scores = [1, 2, 3];

      assert.deepEqual(instance.tags, ['a', 'b', 'c']);
      assert.deepEqual(instance.scores, [1, 2, 3]);
    });
  });

  describe('empty schema', () => {
    it('should create instance from empty schema', () => {
      const instance = create(EmptySchema);

      assert.ok(instance);
      assert.equal(isProxied(instance), true);
      assert.deepEqual(globalThis.Object.keys(instance), []);
    });
  });

  describe('complex schema', () => {
    it('should create complex instance', () => {
      const instance = create(ComplexSchema);

      assert.ok(instance);
      assert.equal(instance.name, '');
      assert.equal(instance.age, 0);
      assert.equal(instance.active, true);
      assert.deepEqual(instance.tags, []);
      assert.ok(instance.address);
    });

    it('should allow full population', () => {
      const instance = create(ComplexSchema);

      instance.name = 'John';
      instance.age = 25;
      instance.active = false;
      instance.tags = ['vip', 'premium'];
      instance.address.street = '456 Oak Ave';
      instance.address.city = 'Chicago';

      assert.equal(instance.name, 'John');
      assert.equal(instance.age, 25);
      assert.equal(instance.active, false);
      assert.deepEqual(instance.tags, ['vip', 'premium']);
      assert.equal(instance.address.street, '456 Oak Ave');
      assert.equal(instance.address.city, 'Chicago');
    });
  });

  describe('multiple instances', () => {
    it('should create independent instances', () => {
      const instance1 = create(SimpleSchema);
      const instance2 = create(SimpleSchema);

      instance1.name = 'Alice';
      instance2.name = 'Bob';

      assert.equal(instance1.name, 'Alice');
      assert.equal(instance2.name, 'Bob');
    });

    it('should have independent nested instances', () => {
      const instance1 = create(WithNested);
      const instance2 = create(WithNested);

      instance1.address.city = 'New York';
      instance2.address.city = 'Los Angeles';

      assert.equal(instance1.address.city, 'New York');
      assert.equal(instance2.address.city, 'Los Angeles');
    });
  });

  describe('type inference', () => {
    it('should infer correct types for properties', () => {
      const instance = create(SimpleSchema);

      // Type checks at runtime
      instance.name = 'test';
      assert.equal(typeof instance.name, 'string');

      instance.age = 42;
      assert.equal(typeof instance.age, 'number');
    });
  });
});
