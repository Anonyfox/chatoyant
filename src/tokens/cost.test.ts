/**
 * Tests for cost calculation utilities.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  calculateBatchCost,
  calculateCost,
  calculateCostCustom,
  calculateImageCost,
  calculateVideoCost,
  estimateCost,
  getCostPerToken,
} from './cost.js';

describe('tokens/cost', () => {
  describe('calculateCost', () => {
    it('should return all zeros for unknown model', () => {
      const cost = calculateCost({
        model: 'unknown-model-xyz',
        inputTokens: 1000,
        outputTokens: 500,
      });
      assert.equal(cost.input, 0);
      assert.equal(cost.output, 0);
      assert.equal(cost.cached, 0);
      assert.equal(cost.cacheWrite, 0);
      assert.equal(cost.total, 0);
    });

    it('should return positive costs for known model', () => {
      const cost = calculateCost({
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 500,
      });
      assert.ok(cost.input > 0);
      assert.ok(cost.output > 0);
      assert.ok(cost.total > 0);
      assert.equal(cost.total, cost.input + cost.output + cost.cached + cost.cacheWrite);
    });

    it('should handle zero tokens', () => {
      const cost = calculateCost({
        model: 'gpt-4o',
        inputTokens: 0,
        outputTokens: 0,
      });
      assert.equal(cost.input, 0);
      assert.equal(cost.output, 0);
      assert.equal(cost.cacheWrite, 0);
      assert.equal(cost.total, 0);
    });

    it('should scale linearly with token count', () => {
      const cost1 = calculateCost({
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 0,
      });
      const cost2 = calculateCost({
        model: 'gpt-4o',
        inputTokens: 2000,
        outputTokens: 0,
      });
      // Should be exactly 2x (within floating point precision)
      assert.ok(Math.abs(cost2.input / cost1.input - 2) < 0.0001);
    });

    it('should handle cached tokens', () => {
      const withoutCache = calculateCost({
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 0,
      });
      const withCache = calculateCost({
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 0,
        cachedTokens: 500,
      });
      // With cache should be cheaper
      assert.ok(withCache.total < withoutCache.total);
      // Cached cost should be separate
      assert.ok(withCache.cached >= 0);
      assert.equal(withCache.cacheWrite, 0);
    });

    it('should not go negative with more cached than input tokens', () => {
      const cost = calculateCost({
        model: 'gpt-4o',
        inputTokens: 100,
        outputTokens: 0,
        cachedTokens: 500, // More than input
      });
      assert.ok(cost.input >= 0);
      assert.ok(cost.total >= 0);
    });
  });

  describe('calculateCostCustom', () => {
    it('should use custom pricing', () => {
      const cost = calculateCostCustom({
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        pricing: { input: 10.0, output: 20.0 },
      });
      assert.equal(cost.input, 10.0);
      assert.equal(cost.output, 20.0);
      assert.equal(cost.total, 30.0);
    });

    it('should handle custom cached pricing', () => {
      const cost = calculateCostCustom({
        inputTokens: 1_000_000,
        outputTokens: 0,
        cachedTokens: 500_000,
        pricing: { input: 10.0, output: 20.0, cached: 2.0 },
      });
      assert.equal(cost.input, 5.0); // 500k * 10
      assert.equal(cost.cached, 1.0); // 500k * 2
      assert.equal(cost.cacheWrite, 0);
      assert.equal(cost.total, 6.0);
    });

    it('should handle custom cache write pricing', () => {
      const cost = calculateCostCustom({
        inputTokens: 1_000_000,
        outputTokens: 0,
        cacheWriteTokens: 250_000,
        pricing: { input: 10.0, output: 20.0, cacheWrite5m: 12.5 },
      });
      assert.equal(cost.input, 7.5);
      assert.equal(cost.cacheWrite, 3.125);
      assert.equal(cost.total, 10.625);
    });
  });

  describe('estimateCost', () => {
    it('should estimate from input tokens', () => {
      const cost = estimateCost({
        model: 'gpt-4o',
        inputTokens: 1000,
        expectedOutputTokens: 500,
      });
      assert.ok(cost.input > 0);
      assert.ok(cost.output > 0);
    });

    it('should estimate from input text', () => {
      const cost = estimateCost({
        model: 'gpt-4o',
        inputText: 'Hello, this is a test message.',
        expectedOutputTokens: 100,
      });
      assert.ok(cost.input > 0);
      assert.ok(cost.output > 0);
    });

    it('should prefer inputTokens over inputText', () => {
      const cost = estimateCost({
        model: 'gpt-4o',
        inputTokens: 1000,
        inputText: 'Short text',
        expectedOutputTokens: 100,
      });
      // Should use inputTokens (1000), not estimate from short text
      const costFromTokens = calculateCost({
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 100,
      });
      assert.equal(cost.input, costFromTokens.input);
    });
  });

  describe('getCostPerToken', () => {
    it('should return undefined for unknown model', () => {
      const perToken = getCostPerToken('unknown-model');
      assert.equal(perToken, undefined);
    });

    it('should return very small numbers for known model', () => {
      const perToken = getCostPerToken('gpt-4o');
      assert.ok(perToken !== undefined);
      assert.ok(perToken!.input > 0);
      assert.ok(perToken!.input < 0.001); // Should be much less than a penny
      assert.ok(perToken!.output > 0);
      assert.ok(perToken!.cacheWrite >= 0);
    });

    it('should be 1 millionth of the pricing table value', () => {
      const perToken = getCostPerToken('gpt-4o');
      assert.ok(perToken !== undefined);
      // Verify the math: per-token should be pricing / 1M
      const cost1M = calculateCost({
        model: 'gpt-4o',
        inputTokens: 1_000_000,
        outputTokens: 0,
      });
      assert.ok(Math.abs(cost1M.input - perToken!.input * 1_000_000) < 0.0001);
    });
  });

  describe('calculateImageCost', () => {
    it('should calculate cost for grok-imagine-image', () => {
      const cost = calculateImageCost({ model: 'grok-imagine-image', count: 4 });
      assert.ok(Math.abs(cost - 0.08) < 0.0001);
    });

    it('should calculate cost for grok-imagine-image-pro', () => {
      const cost = calculateImageCost({ model: 'grok-imagine-image-pro', count: 1 });
      assert.ok(Math.abs(cost - 0.07) < 0.0001);
    });

    it('should return 0 for non-image models', () => {
      const cost = calculateImageCost({ model: 'gpt-4o', count: 5 });
      assert.equal(cost, 0);
    });

    it('should return 0 for unknown models', () => {
      const cost = calculateImageCost({ model: 'unknown-model', count: 3 });
      assert.equal(cost, 0);
    });
  });

  describe('calculateVideoCost', () => {
    it('should calculate cost for grok-imagine-video', () => {
      const cost = calculateVideoCost({ model: 'grok-imagine-video', durationSeconds: 10 });
      assert.ok(Math.abs(cost - 0.5) < 0.0001);
    });

    it('should scale linearly with duration', () => {
      const cost5 = calculateVideoCost({ model: 'grok-imagine-video', durationSeconds: 5 });
      const cost15 = calculateVideoCost({ model: 'grok-imagine-video', durationSeconds: 15 });
      assert.ok(Math.abs(cost15 / cost5 - 3) < 0.0001);
    });

    it('should return 0 for non-video models', () => {
      const cost = calculateVideoCost({ model: 'gpt-4o', durationSeconds: 10 });
      assert.equal(cost, 0);
    });

    it('should return 0 for unknown models', () => {
      const cost = calculateVideoCost({ model: 'unknown-model', durationSeconds: 10 });
      assert.equal(cost, 0);
    });
  });

  describe('calculateBatchCost', () => {
    it('should return zeros for empty batch', () => {
      const cost = calculateBatchCost([], 'gpt-4o');
      assert.equal(cost.total, 0);
    });

    it('should sum costs across all requests', () => {
      const batch = [
        { inputTokens: 100, outputTokens: 50 },
        { inputTokens: 200, outputTokens: 100 },
        { inputTokens: 300, outputTokens: 150 },
      ];
      const batchCost = calculateBatchCost(batch, 'gpt-4o');

      // Should equal sum of individual costs
      const individualCost = calculateCost({
        model: 'gpt-4o',
        inputTokens: 600,
        outputTokens: 300,
      });
      assert.ok(Math.abs(batchCost.total - individualCost.total) < 0.0000001);
    });

    it('should handle cached tokens in batch', () => {
      const batch = [
        { inputTokens: 100, outputTokens: 50, cachedTokens: 20 },
        { inputTokens: 100, outputTokens: 50, cachedTokens: 30 },
      ];
      const cost = calculateBatchCost(batch, 'gpt-4o');
      assert.ok(cost.cached >= 0);
      assert.equal(cost.cacheWrite, 0);
    });

    it('should handle cache write tokens in batch', () => {
      const batch = [
        { inputTokens: 1000, outputTokens: 0, cacheWriteTokens: 100 },
        { inputTokens: 2000, outputTokens: 0, cacheWriteTokens: 200 },
      ];
      const cost = calculateBatchCost(batch, 'claude-sonnet-4-6');
      assert.ok(cost.cacheWrite > 0);
    });
  });
});
