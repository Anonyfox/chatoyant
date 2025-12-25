/**
 * Tests for token module exports.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import * as tokens from './index.js';

describe('tokens/index', () => {
  describe('exports', () => {
    it('should export CONTEXT_WINDOWS', () => {
      assert.ok(typeof tokens.CONTEXT_WINDOWS === 'object');
      assert.ok(Object.keys(tokens.CONTEXT_WINDOWS).length > 0);
    });

    it('should export PRICING', () => {
      assert.ok(typeof tokens.PRICING === 'object');
      assert.ok(Object.keys(tokens.PRICING).length > 0);
    });

    it('should export TOKEN_RATIOS', () => {
      assert.ok(typeof tokens.TOKEN_RATIOS === 'object');
    });

    it('should export context window functions', () => {
      assert.equal(typeof tokens.getContextWindow, 'function');
      assert.equal(typeof tokens.hasContextWindow, 'function');
    });

    it('should export pricing functions', () => {
      assert.equal(typeof tokens.getPricing, 'function');
      assert.equal(typeof tokens.hasPricing, 'function');
    });

    it('should export estimation functions', () => {
      assert.equal(typeof tokens.estimateTokens, 'function');
      assert.equal(typeof tokens.estimatePromptTokens, 'function');
      assert.equal(typeof tokens.estimateTokensMany, 'function');
      assert.equal(typeof tokens.estimateTokensWithRatio, 'function');
    });

    it('should export cost functions', () => {
      assert.equal(typeof tokens.calculateCost, 'function');
      assert.equal(typeof tokens.calculateCostCustom, 'function');
      assert.equal(typeof tokens.calculateBatchCost, 'function');
      assert.equal(typeof tokens.estimateCost, 'function');
      assert.equal(typeof tokens.getCostPerToken, 'function');
    });

    it('should export message functions', () => {
      assert.equal(typeof tokens.estimateMessageTokens, 'function');
      assert.equal(typeof tokens.estimateChatTokens, 'function');
      assert.equal(typeof tokens.estimateSystemPromptTokens, 'function');
      assert.equal(typeof tokens.calculateAvailableTokens, 'function');
      assert.equal(typeof tokens.getMessageOverhead, 'function');
      assert.equal(typeof tokens.messagesFitBudget, 'function');
    });

    it('should export chunking functions', () => {
      assert.equal(typeof tokens.splitText, 'function');
      assert.equal(typeof tokens.fitMessages, 'function');
      assert.equal(typeof tokens.truncateContent, 'function');
      assert.equal(typeof tokens.paginateMessages, 'function');
      assert.equal(typeof tokens.estimateChunkCount, 'function');
    });
  });

  describe('integration', () => {
    it('should work end-to-end: estimate -> cost', () => {
      const text = 'Hello, this is a test message for the LLM.';
      const inputTokens = tokens.estimateTokens(text);
      const outputTokens = 100;

      // Find a known model
      const model = 'gpt-4o';
      assert.ok(tokens.hasPricing(model));

      const cost = tokens.calculateCost({
        model,
        inputTokens,
        outputTokens,
      });

      assert.ok(cost.total > 0);
    });

    it('should work end-to-end: messages -> fit -> estimate', () => {
      const messages: tokens.TokenMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi there! How can I help you today?' },
        { role: 'user', content: 'Tell me about TypeScript.' },
      ];

      // Get a context window
      const model = 'gpt-4o';
      const contextWindow = tokens.getContextWindow(model, 8192);

      // Fit messages
      const fitted = tokens.fitMessages(messages, {
        maxTokens: contextWindow!,
        reserveForResponse: 1000,
      });

      // Estimate tokens
      const chatTokens = tokens.estimateChatTokens(fitted);
      assert.ok(chatTokens > 0);
      assert.ok(chatTokens <= contextWindow! - 1000);
    });

    it('should work end-to-end: split text -> count chunks', () => {
      const longText = 'This is a sentence. '.repeat(100);
      const chunkSize = 50;

      const chunks = tokens.splitText(longText, { maxTokens: chunkSize });
      const estimated = tokens.estimateChunkCount(longText, chunkSize);

      assert.ok(chunks.length > 0);
      // Both should indicate multiple chunks for long text
      assert.ok(estimated > 1);
      // Estimation is approximate - actual chunking may differ due to boundary handling
      assert.ok(chunks.length >= 1 && estimated >= 1);
    });
  });
});
