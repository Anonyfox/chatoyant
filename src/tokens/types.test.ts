/**
 * Tests for token types.
 *
 * These tests verify type structure at runtime.
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import type { ChunkOptions, CostResult, FitOptions, ModelPricing, Provider, TokenMessage } from './types.js';

describe('tokens/types', () => {
  describe('Provider type', () => {
    it('should accept valid provider strings', () => {
      const providers: Provider[] = ['openai', 'anthropic', 'xai'];
      assert.equal(providers.length, 3);
    });
  });

  describe('ModelPricing interface', () => {
    it('should allow input and output prices', () => {
      const pricing: ModelPricing = { input: 1.0, output: 2.0 };
      assert.equal(pricing.input, 1.0);
      assert.equal(pricing.output, 2.0);
      assert.equal(pricing.cached, undefined);
    });

    it('should allow optional cached price', () => {
      const pricing: ModelPricing = { input: 1.0, output: 2.0, cached: 0.5 };
      assert.equal(pricing.cached, 0.5);
    });
  });

  describe('CostResult interface', () => {
    it('should have all required fields', () => {
      const result: CostResult = { input: 0.01, output: 0.02, cached: 0, total: 0.03 };
      assert.equal(typeof result.input, 'number');
      assert.equal(typeof result.output, 'number');
      assert.equal(typeof result.cached, 'number');
      assert.equal(typeof result.total, 'number');
    });
  });

  describe('ChunkOptions interface', () => {
    it('should require maxTokens', () => {
      const options: ChunkOptions = { maxTokens: 512 };
      assert.equal(options.maxTokens, 512);
    });

    it('should allow optional overlap and separator', () => {
      const options: ChunkOptions = { maxTokens: 512, overlap: 50, separator: '\n\n' };
      assert.equal(options.overlap, 50);
      assert.equal(options.separator, '\n\n');
    });
  });

  describe('FitOptions interface', () => {
    it('should require maxTokens', () => {
      const options: FitOptions = { maxTokens: 4000 };
      assert.equal(options.maxTokens, 4000);
    });

    it('should allow optional fields', () => {
      const options: FitOptions = {
        maxTokens: 4000,
        reserveForResponse: 1000,
        provider: 'anthropic',
      };
      assert.equal(options.reserveForResponse, 1000);
      assert.equal(options.provider, 'anthropic');
    });
  });

  describe('TokenMessage interface', () => {
    it('should require role and content', () => {
      const message: TokenMessage = { role: 'user', content: 'Hello' };
      assert.equal(message.role, 'user');
      assert.equal(message.content, 'Hello');
    });

    it('should allow null content', () => {
      const message: TokenMessage = { role: 'assistant', content: null };
      assert.equal(message.content, null);
    });

    it('should allow optional name', () => {
      const message: TokenMessage = { role: 'user', content: 'Hi', name: 'Alice' };
      assert.equal(message.name, 'Alice');
    });
  });
});

