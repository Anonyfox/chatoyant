import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Integer } from '../descriptors/integer.js';
import { String } from '../descriptors/string.js';
import { create } from './create.js';
import { stringify } from './stringify.js';

// Test schema
class SimpleSchema {
  name = String();
  age = Integer();
}

class WithConstraints {
  name = String({ description: 'Full name', minLength: 1 });
  age = Integer({ minimum: 0 });
}

describe('stringify', () => {
  describe('basic output', () => {
    it('should return a string', () => {
      const instance = create(SimpleSchema);
      const result = stringify(instance);

      assert.equal(typeof result, 'string');
    });

    it('should return valid JSON', () => {
      const instance = create(SimpleSchema);
      const result = stringify(instance);
      const parsed = JSON.parse(result);

      assert.ok(parsed);
      assert.equal(parsed.$schema, 'https://json-schema.org/draft/2020-12/schema');
    });

    it('should include schema properties', () => {
      const instance = create(SimpleSchema);
      const result = stringify(instance);
      const parsed = JSON.parse(result);

      assert.ok(parsed.properties);
      assert.ok(parsed.properties.name);
      assert.ok(parsed.properties.age);
    });
  });

  describe('pretty printing', () => {
    it('should pretty print by default', () => {
      const instance = create(SimpleSchema);
      const result = stringify(instance);

      assert.ok(result.includes('\n'));
      assert.ok(result.includes('  ')); // Indentation
    });

    it('should pretty print when pretty=true', () => {
      const instance = create(SimpleSchema);
      const result = stringify(instance, true);

      assert.ok(result.includes('\n'));
    });

    it('should not pretty print when pretty=false', () => {
      const instance = create(SimpleSchema);
      const result = stringify(instance, false);

      assert.ok(!result.includes('\n'));
    });
  });

  describe('content verification', () => {
    it('should include $schema', () => {
      const instance = create(SimpleSchema);
      const result = stringify(instance);

      assert.ok(result.includes('$schema'));
      assert.ok(result.includes('json-schema.org'));
    });

    it('should include type object', () => {
      const instance = create(SimpleSchema);
      const result = stringify(instance);

      assert.ok(result.includes('"type"'));
      assert.ok(result.includes('"object"'));
    });

    it('should include description when present', () => {
      const instance = create(WithConstraints);
      const result = stringify(instance);

      assert.ok(result.includes('Full name'));
    });

    it('should include constraints', () => {
      const instance = create(WithConstraints);
      const result = stringify(instance);

      assert.ok(result.includes('minLength'));
      assert.ok(result.includes('minimum'));
    });
  });

  describe('roundtrip', () => {
    it('should produce same result when re-stringified', () => {
      const instance = create(SimpleSchema);
      const result1 = stringify(instance);
      const result2 = stringify(instance);

      assert.equal(result1, result2);
    });

    it('should be parseable and re-stringifiable', () => {
      const instance = create(SimpleSchema);
      const result = stringify(instance);
      const parsed = JSON.parse(result);
      const reStringified = JSON.stringify(parsed, null, 2);

      assert.equal(result, reStringified);
    });
  });

  describe('edge cases', () => {
    it('should handle empty schema', () => {
      class Empty {}
      const instance = create(Empty);
      const result = stringify(instance);
      const parsed = JSON.parse(result);

      assert.equal(parsed.type, 'object');
      assert.deepEqual(parsed.properties, {});
    });

    it('should handle unicode in descriptions', () => {
      class WithUnicode {
        名前 = String({ description: '日本語の名前 🎉' });
      }
      const instance = create(WithUnicode);
      const result = stringify(instance);

      assert.ok(result.includes('日本語の名前'));
      assert.ok(result.includes('🎉'));
    });

    it('should handle special characters in patterns', () => {
      class WithPattern {
        email = String({ pattern: '^[^@]+@[^@]+\\.[^@]+$' });
      }
      const instance = create(WithPattern);
      const result = stringify(instance);

      assert.ok(result.includes('pattern'));
    });
  });
});
