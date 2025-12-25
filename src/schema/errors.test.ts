import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { SchemaError } from './errors.js';

describe('SchemaError', () => {
  describe('constructor', () => {
    it('should create error with all properties', () => {
      const error = new SchemaError('Test error', 'user.name', 'string', 123);

      assert.equal(error.message, 'Test error');
      assert.equal(error.path, 'user.name');
      assert.equal(error.expected, 'string');
      assert.equal(error.received, 123);
      assert.equal(error.name, 'SchemaError');
    });

    it('should extend Error', () => {
      const error = new SchemaError('Test', 'path', 'type');

      assert.ok(error instanceof Error);
      assert.ok(error instanceof SchemaError);
    });

    it('should have stack trace', () => {
      const error = new SchemaError('Test', 'path', 'type');

      assert.ok(error.stack);
      assert.ok(error.stack.includes('SchemaError'));
    });

    it('should handle undefined received value', () => {
      const error = new SchemaError('Test', 'path', 'type');

      assert.equal(error.received, undefined);
    });

    it('should handle complex received values', () => {
      const complexValue = { nested: { array: [1, 2, 3] } };
      const error = new SchemaError('Test', 'path', 'type', complexValue);

      assert.deepEqual(error.received, complexValue);
    });

    it('should handle empty path', () => {
      const error = new SchemaError('Root error', '', 'object');

      assert.equal(error.path, '');
    });

    it('should handle deeply nested paths', () => {
      const error = new SchemaError('Deep error', 'a.b.c.d.e.f[0].g', 'string');

      assert.equal(error.path, 'a.b.c.d.e.f[0].g');
    });
  });

  describe('missingField', () => {
    it('should create error for missing field', () => {
      const error = SchemaError.missingField('user.email');

      assert.equal(error.path, 'user.email');
      assert.equal(error.expected, 'value');
      assert.equal(error.received, undefined);
      assert.ok(error.message.includes('Missing required field'));
      assert.ok(error.message.includes('user.email'));
    });

    it('should handle root level field', () => {
      const error = SchemaError.missingField('name');

      assert.equal(error.path, 'name');
      assert.ok(error.message.includes('name'));
    });

    it('should handle array index paths', () => {
      const error = SchemaError.missingField('items[0].id');

      assert.equal(error.path, 'items[0].id');
    });

    it('should be catchable as Error', () => {
      try {
        throw SchemaError.missingField('test');
      } catch (e) {
        assert.ok(e instanceof Error);
        assert.ok(e instanceof SchemaError);
      }
    });
  });

  describe('typeMismatch', () => {
    it('should create error for type mismatch', () => {
      const error = SchemaError.typeMismatch('age', 'number', 'hello');

      assert.equal(error.path, 'age');
      assert.equal(error.expected, 'number');
      assert.equal(error.received, 'hello');
      assert.ok(error.message.includes('Type mismatch'));
      assert.ok(error.message.includes('expected number'));
      assert.ok(error.message.includes('got string'));
    });

    it('should handle null value', () => {
      const error = SchemaError.typeMismatch('name', 'string', null);

      assert.equal(error.received, null);
      assert.ok(error.message.includes('got null'));
    });

    it('should handle undefined value', () => {
      const error = SchemaError.typeMismatch('name', 'string', undefined);

      assert.equal(error.received, undefined);
      assert.ok(error.message.includes('got undefined'));
    });

    it('should handle object value', () => {
      const error = SchemaError.typeMismatch('name', 'string', { foo: 'bar' });

      assert.ok(error.message.includes('got object'));
    });

    it('should handle array value', () => {
      const error = SchemaError.typeMismatch('name', 'string', [1, 2, 3]);

      assert.ok(error.message.includes('got object')); // typeof [] === 'object'
    });

    it('should handle function value', () => {
      const error = SchemaError.typeMismatch('callback', 'string', () => {});

      assert.ok(error.message.includes('got function'));
    });

    it('should handle symbol value', () => {
      const error = SchemaError.typeMismatch('id', 'string', Symbol('test'));

      assert.ok(error.message.includes('got symbol'));
    });

    it('should handle bigint value', () => {
      const error = SchemaError.typeMismatch('count', 'number', BigInt(123));

      assert.ok(error.message.includes('got bigint'));
    });
  });

  describe('constraintViolation', () => {
    it('should create error for constraint violation', () => {
      const error = SchemaError.constraintViolation('name', 'minLength 1', '');

      assert.equal(error.path, 'name');
      assert.equal(error.expected, 'minLength 1');
      assert.equal(error.received, '');
      assert.ok(error.message.includes('Constraint violation'));
      assert.ok(error.message.includes('minLength 1'));
    });

    it('should handle numeric constraints', () => {
      const error = SchemaError.constraintViolation('age', 'minimum 0', -5);

      assert.equal(error.received, -5);
      assert.ok(error.message.includes('minimum 0'));
    });

    it('should handle pattern constraints', () => {
      const error = SchemaError.constraintViolation('email', 'pattern ^.+@.+$', 'invalid');

      assert.ok(error.message.includes('pattern'));
    });

    it('should handle array length constraints', () => {
      const error = SchemaError.constraintViolation('tags', 'minItems 1', []);

      assert.deepEqual(error.received, []);
    });

    it('should handle uniqueItems constraint', () => {
      const error = SchemaError.constraintViolation('ids', 'uniqueItems', [1, 1, 2]);

      assert.deepEqual(error.received, [1, 1, 2]);
    });
  });

  describe('invalidEnum', () => {
    it('should create error for invalid enum', () => {
      const error = SchemaError.invalidEnum('role', ['admin', 'user'], 'guest');

      assert.equal(error.path, 'role');
      assert.equal(error.received, 'guest');
      assert.ok(error.message.includes('Invalid enum value'));
      assert.ok(error.message.includes('guest'));
      assert.ok(error.message.includes('admin'));
      assert.ok(error.message.includes('user'));
    });

    it('should handle numeric enums', () => {
      const error = SchemaError.invalidEnum('priority', [1, 2, 3], 5);

      assert.equal(error.received, 5);
      assert.ok(error.message.includes('5'));
      assert.ok(error.message.includes('[1,2,3]'));
    });

    it('should handle single value enum', () => {
      const error = SchemaError.invalidEnum('type', ['only'], 'other');

      assert.ok(error.message.includes('only'));
    });

    it('should handle mixed type enums', () => {
      const error = SchemaError.invalidEnum('value', [1, 'two', true], 'invalid');

      assert.ok(error.message.includes('1'));
      assert.ok(error.message.includes('two'));
      assert.ok(error.message.includes('true'));
    });

    it('should handle null in enum values', () => {
      const error = SchemaError.invalidEnum('nullable', [null, 'value'], 'other');

      assert.ok(error.message.includes('null'));
    });

    it('should handle received null value', () => {
      const error = SchemaError.invalidEnum('status', ['active', 'inactive'], null);

      assert.equal(error.received, null);
      assert.ok(error.message.includes('null'));
    });

    it('should properly stringify complex received values', () => {
      const error = SchemaError.invalidEnum('data', ['a', 'b'], { complex: true });

      assert.ok(error.message.includes('complex'));
    });
  });

  describe('error serialization', () => {
    it('should convert to string properly', () => {
      const error = new SchemaError('Test message', 'path', 'type');

      assert.ok(error.toString().includes('SchemaError'));
      assert.ok(error.toString().includes('Test message'));
    });

    it('should be JSON serializable (message only)', () => {
      const error = SchemaError.missingField('test');
      const json = JSON.stringify({ error: error.message });

      assert.ok(json.includes('Missing required field'));
    });
  });
});
