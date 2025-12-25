/**
 * Tests for context window utilities.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { CONTEXT_WINDOWS, getContextWindow, hasContextWindow } from './context-windows.js';

describe('tokens/context-windows', () => {
  describe('CONTEXT_WINDOWS', () => {
    it('should be a non-empty object', () => {
      assert.equal(typeof CONTEXT_WINDOWS, 'object');
      assert.ok(Object.keys(CONTEXT_WINDOWS).length > 0);
    });

    it('should have all values as positive integers', () => {
      for (const [model, size] of Object.entries(CONTEXT_WINDOWS)) {
        assert.ok(Number.isInteger(size), `${model} should be integer`);
        assert.ok(size > 0, `${model} should be positive`);
      }
    });

    it('should include known OpenAI models', () => {
      assert.ok('gpt-4o' in CONTEXT_WINDOWS);
      assert.ok('gpt-4o-mini' in CONTEXT_WINDOWS);
    });

    it('should include known Anthropic models', () => {
      assert.ok('claude-sonnet-4-20250514' in CONTEXT_WINDOWS);
      assert.ok('claude-3-opus' in CONTEXT_WINDOWS);
    });

    it('should include known xAI models', () => {
      assert.ok('grok-3' in CONTEXT_WINDOWS);
      assert.ok('grok-2' in CONTEXT_WINDOWS);
    });
  });

  describe('getContextWindow', () => {
    it('should return context window for known model', () => {
      const size = getContextWindow('gpt-4o');
      assert.ok(typeof size === 'number');
      assert.ok(size! > 0);
    });

    it('should return undefined for unknown model', () => {
      const size = getContextWindow('unknown-model-xyz');
      assert.equal(size, undefined);
    });

    it('should return fallback for unknown model when provided', () => {
      const size = getContextWindow('unknown-model-xyz', 8192);
      assert.equal(size, 8192);
    });

    it('should not use fallback for known model', () => {
      const size = getContextWindow('gpt-4o', 1);
      assert.ok(size! > 1); // Known model should return its actual size, not fallback
    });
  });

  describe('hasContextWindow', () => {
    it('should return true for known model', () => {
      assert.equal(hasContextWindow('gpt-4o'), true);
      assert.equal(hasContextWindow('claude-3-opus'), true);
      assert.equal(hasContextWindow('grok-3'), true);
    });

    it('should return false for unknown model', () => {
      assert.equal(hasContextWindow('unknown-model'), false);
      assert.equal(hasContextWindow(''), false);
    });
  });
});
