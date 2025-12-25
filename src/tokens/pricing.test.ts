/**
 * Tests for pricing utilities.
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { getPricing, hasPricing, PRICING } from './pricing.js';

describe('tokens/pricing', () => {
  describe('PRICING', () => {
    it('should be a non-empty object', () => {
      assert.equal(typeof PRICING, 'object');
      assert.ok(Object.keys(PRICING).length > 0);
    });

    it('should have valid pricing structure for all models', () => {
      for (const [model, pricing] of Object.entries(PRICING)) {
        assert.ok(typeof pricing.input === 'number', `${model} input should be number`);
        assert.ok(typeof pricing.output === 'number', `${model} output should be number`);
        assert.ok(pricing.input >= 0, `${model} input should be non-negative`);
        assert.ok(pricing.output >= 0, `${model} output should be non-negative`);

        if (pricing.cached !== undefined) {
          assert.ok(typeof pricing.cached === 'number', `${model} cached should be number`);
          assert.ok(pricing.cached >= 0, `${model} cached should be non-negative`);
          // Cached price should be less than or equal to input price
          assert.ok(pricing.cached <= pricing.input, `${model} cached should be <= input`);
        }
      }
    });

    it('should include known OpenAI models', () => {
      assert.ok('gpt-4o' in PRICING);
      assert.ok('gpt-4o-mini' in PRICING);
    });

    it('should include known Anthropic models', () => {
      assert.ok('claude-sonnet-4' in PRICING);
      assert.ok('claude-3-opus' in PRICING);
    });

    it('should include known xAI models', () => {
      assert.ok('grok-3' in PRICING);
      assert.ok('grok-2' in PRICING);
    });

    it('should include embedding models', () => {
      assert.ok('text-embedding-3-small' in PRICING);
    });
  });

  describe('getPricing', () => {
    it('should return pricing for known model', () => {
      const pricing = getPricing('gpt-4o');
      assert.ok(pricing !== undefined);
      assert.ok(typeof pricing!.input === 'number');
      assert.ok(typeof pricing!.output === 'number');
    });

    it('should return undefined for unknown model', () => {
      const pricing = getPricing('unknown-model-xyz');
      assert.equal(pricing, undefined);
    });

    it('should return fallback for unknown model when provided', () => {
      const fallback = { input: 1.0, output: 2.0 };
      const pricing = getPricing('unknown-model-xyz', fallback);
      assert.deepEqual(pricing, fallback);
    });

    it('should not use fallback for known model', () => {
      const fallback = { input: 999, output: 999 };
      const pricing = getPricing('gpt-4o', fallback);
      assert.ok(pricing!.input !== 999);
    });
  });

  describe('hasPricing', () => {
    it('should return true for known model', () => {
      assert.equal(hasPricing('gpt-4o'), true);
      assert.equal(hasPricing('claude-3-opus'), true);
      assert.equal(hasPricing('grok-3'), true);
    });

    it('should return false for unknown model', () => {
      assert.equal(hasPricing('unknown-model'), false);
      assert.equal(hasPricing(''), false);
    });
  });
});

