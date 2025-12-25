/**
 * Tests for OpenAI schema utilities.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { makeOpenAIStrict, needsOpenAIStrictTransform } from './schema-utils.js';

describe('makeOpenAIStrict', () => {
  it('should add additionalProperties: false to objects', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      required: ['name'],
    };

    const result = makeOpenAIStrict(schema);

    assert.equal(result.additionalProperties, false);
  });

  it('should make all properties required', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'], // age is optional
    };

    const result = makeOpenAIStrict(schema);

    assert.deepEqual(result.required, ['name', 'age']);
  });

  it('should convert optional properties to nullable via anyOf', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'], // age is optional
    };

    const result = makeOpenAIStrict(schema);
    const props = result.properties as Record<string, Record<string, unknown>>;

    // name should be unchanged (except for recursive processing)
    assert.equal(props.name.type, 'string');

    // age should be wrapped in anyOf
    assert.ok(props.age.anyOf);
    assert.deepEqual(props.age.anyOf, [{ type: 'number' }, { type: 'null' }]);
  });

  it('should recursively process nested objects', () => {
    const schema = {
      type: 'object',
      properties: {
        person: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
        },
      },
      required: ['person'],
    };

    const result = makeOpenAIStrict(schema);
    const person = (result.properties as Record<string, Record<string, unknown>>).person;

    assert.equal(person.additionalProperties, false);
    assert.deepEqual(person.required, ['name']);
  });

  it('should recursively process array items', () => {
    const schema = {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      },
    };

    const result = makeOpenAIStrict(schema);
    const items = result.items as Record<string, unknown>;

    assert.equal(items.additionalProperties, false);
  });

  it('should handle deeply nested structures', () => {
    const schema = {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              nested: {
                type: 'object',
                properties: {
                  value: { type: 'string' },
                },
              },
            },
          },
        },
      },
      required: ['data'],
    };

    const result = makeOpenAIStrict(schema);
    const data = (result.properties as Record<string, Record<string, unknown>>).data;
    const items = data.items as Record<string, unknown>;
    const nested = (items.properties as Record<string, Record<string, unknown>>).nested;

    // Check all levels have additionalProperties: false
    assert.equal(result.additionalProperties, false);
    assert.equal(items.additionalProperties, false);

    // nested is optional (not in items.required), so it's wrapped in anyOf
    assert.ok(nested.anyOf);
    const nestedObj = (nested.anyOf as unknown[])[0] as Record<string, unknown>;
    assert.equal(nestedObj.additionalProperties, false);
  });

  it('should not modify primitive types', () => {
    const schema = { type: 'string' };
    const result = makeOpenAIStrict(schema);

    assert.deepEqual(result, { type: 'string' });
  });
});

describe('needsOpenAIStrictTransform', () => {
  it('should return true when additionalProperties is missing', () => {
    const schema = {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    };

    assert.ok(needsOpenAIStrictTransform(schema));
  });

  it('should return true when additionalProperties is true', () => {
    const schema = {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
      additionalProperties: true,
    };

    assert.ok(needsOpenAIStrictTransform(schema));
  });

  it('should return true when not all properties are required', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'],
      additionalProperties: false,
    };

    assert.ok(needsOpenAIStrictTransform(schema));
  });

  it('should return false for already strict schemas', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      required: ['name'],
      additionalProperties: false,
    };

    assert.ok(!needsOpenAIStrictTransform(schema));
  });

  it('should check nested objects', () => {
    const schema = {
      type: 'object',
      properties: {
        person: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          // Missing required and additionalProperties
        },
      },
      required: ['person'],
      additionalProperties: false,
    };

    assert.ok(needsOpenAIStrictTransform(schema));
  });

  it('should return false for primitives', () => {
    assert.ok(!needsOpenAIStrictTransform({ type: 'string' }));
    assert.ok(!needsOpenAIStrictTransform({ type: 'number' }));
    assert.ok(!needsOpenAIStrictTransform({ type: 'boolean' }));
  });
});
