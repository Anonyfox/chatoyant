import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Array } from '../descriptors/array.js';
import { Boolean } from '../descriptors/boolean.js';
import { Integer } from '../descriptors/integer.js';
import { Number } from '../descriptors/number.js';
import { Object } from '../descriptors/object.js';
import { String } from '../descriptors/string.js';
import { isProxied } from '../proxy.js';
import { clone } from './clone.js';
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

describe('clone', () => {
  describe('basic cloning', () => {
    it('should create a clone', () => {
      const instance = create(SimpleSchema);
      const cloned = clone(instance);

      assert.ok(cloned);
      assert.notStrictEqual(cloned, instance);
    });

    it('should return proxied instance', () => {
      const instance = create(SimpleSchema);
      const cloned = clone(instance);

      assert.equal(isProxied(cloned), true);
    });

    it('should copy values', () => {
      const instance = create(SimpleSchema);
      instance.name = 'Alice';
      instance.age = 30;

      const cloned = clone(instance);

      assert.equal(cloned.name, 'Alice');
      assert.equal(cloned.age, 30);
    });

    it('should copy default values', () => {
      const instance = create(WithDefaults);
      const cloned = clone(instance);

      assert.equal(cloned.name, 'Anonymous');
      assert.equal(cloned.active, true);
    });
  });

  describe('independence', () => {
    it('should be independent of original', () => {
      const instance = create(SimpleSchema);
      instance.name = 'Alice';

      const cloned = clone(instance);
      cloned.name = 'Bob';

      assert.equal(instance.name, 'Alice');
      assert.equal(cloned.name, 'Bob');
    });

    it('should have independent integer values', () => {
      const instance = create(SimpleSchema);
      instance.age = 30;

      const cloned = clone(instance);
      cloned.age = 25;

      assert.equal(instance.age, 30);
      assert.equal(cloned.age, 25);
    });

    it('should have independent boolean values', () => {
      const instance = create(WithDefaults);
      instance.active = true;

      const cloned = clone(instance);
      cloned.active = false;

      assert.equal(instance.active, true);
      assert.equal(cloned.active, false);
    });
  });

  describe('array cloning', () => {
    it('should deep clone arrays', () => {
      const instance = create(WithArray);
      instance.tags = ['a', 'b'];

      const cloned = clone(instance);

      assert.deepEqual(cloned.tags, ['a', 'b']);
      assert.notStrictEqual(cloned.tags, instance.tags);
    });

    it('should be independent for array modifications', () => {
      const instance = create(WithArray);
      instance.tags = ['a', 'b'];

      const cloned = clone(instance);
      (cloned.tags as string[]).push('c');

      assert.deepEqual(instance.tags, ['a', 'b']);
      assert.deepEqual(cloned.tags, ['a', 'b', 'c']);
    });

    it('should handle empty arrays', () => {
      const instance = create(WithArray);

      const cloned = clone(instance);

      assert.deepEqual(cloned.tags, []);
      assert.deepEqual(cloned.scores, []);
    });

    it('should handle integer arrays', () => {
      const instance = create(WithArray);
      instance.scores = [1, 2, 3];

      const cloned = clone(instance);
      (cloned.scores as number[])[0] = 100;

      assert.deepEqual(instance.scores, [1, 2, 3]);
      assert.deepEqual(cloned.scores, [100, 2, 3]);
    });
  });

  describe('nested object cloning', () => {
    it('should deep clone nested objects', () => {
      const instance = create(WithNested);
      parse(instance, {
        name: 'Alice',
        address: { street: '123 Main', city: 'Boston' },
      });

      const cloned = clone(instance);

      assert.equal(cloned.address.street, '123 Main');
      assert.equal(cloned.address.city, 'Boston');
    });

    it('should have independent nested objects', () => {
      const instance = create(WithNested);
      parse(instance, {
        name: 'Alice',
        address: { street: '123 Main', city: 'Boston' },
      });

      const cloned = clone(instance);
      cloned.address.city = 'New York';

      assert.equal(instance.address.city, 'Boston');
      assert.equal(cloned.address.city, 'New York');
    });
  });

  describe('complex cloning', () => {
    it('should deep clone complex schemas', () => {
      const instance = create(ComplexSchema);
      parse(instance, {
        name: 'Alice',
        age: 30,
        active: true,
        tags: ['vip', 'premium'],
        address: { street: '456 Oak', city: 'Chicago' },
      });

      const cloned = clone(instance);

      // Modify cloned
      cloned.name = 'Bob';
      cloned.age = 25;
      cloned.active = false;
      (cloned.tags as string[]).push('new');
      cloned.address.city = 'LA';

      // Original unchanged
      assert.equal(instance.name, 'Alice');
      assert.equal(instance.age, 30);
      assert.equal(instance.active, true);
      assert.deepEqual(instance.tags, ['vip', 'premium']);
      assert.equal(instance.address.city, 'Chicago');

      // Cloned changed
      assert.equal(cloned.name, 'Bob');
      assert.equal(cloned.age, 25);
      assert.equal(cloned.active, false);
      assert.deepEqual(cloned.tags, ['vip', 'premium', 'new']);
      assert.equal(cloned.address.city, 'LA');
    });
  });

  describe('multiple clones', () => {
    it('should allow multiple clones from same source', () => {
      const instance = create(SimpleSchema);
      instance.name = 'Original';

      const clone1 = clone(instance);
      const clone2 = clone(instance);

      clone1.name = 'Clone1';
      clone2.name = 'Clone2';

      assert.equal(instance.name, 'Original');
      assert.equal(clone1.name, 'Clone1');
      assert.equal(clone2.name, 'Clone2');
    });

    it('should allow cloning a clone', () => {
      const instance = create(SimpleSchema);
      instance.name = 'Level1';

      const level2 = clone(instance);
      level2.name = 'Level2';

      const level3 = clone(level2);
      level3.name = 'Level3';

      assert.equal(instance.name, 'Level1');
      assert.equal(level2.name, 'Level2');
      assert.equal(level3.name, 'Level3');
    });
  });

  describe('edge cases', () => {
    it('should handle empty schema', () => {
      class Empty {}
      const instance = create(Empty);
      const cloned = clone(instance);

      assert.ok(cloned);
      assert.equal(isProxied(cloned), true);
    });

    it('should handle unicode values', () => {
      const instance = create(SimpleSchema);
      instance.name = '日本語 🎉';

      const cloned = clone(instance);

      assert.equal(cloned.name, '日本語 🎉');
    });

    it('should handle number precision', () => {
      const instance = create(WithNumber);
      instance.price = 19.99;

      const cloned = clone(instance);

      assert.equal(cloned.price, 19.99);
    });

    it('should handle null-like defaults', () => {
      const instance = create(SimpleSchema);
      // Default empty string and zero

      const cloned = clone(instance);

      assert.equal(cloned.name, '');
      assert.equal(cloned.age, 0);
    });
  });
});
