/**
 * Tests for message token estimation.
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  calculateAvailableTokens,
  estimateChatTokens,
  estimateMessageTokens,
  estimateSystemPromptTokens,
  getMessageOverhead,
  messagesFitBudget,
} from './messages.js';
import type { Provider, TokenMessage } from './types.js';

describe('tokens/messages', () => {
  describe('estimateMessageTokens', () => {
    it('should return positive number for message with content', () => {
      const tokens = estimateMessageTokens({ role: 'user', content: 'Hello!' });
      assert.ok(tokens > 0);
    });

    it('should handle null content', () => {
      const tokens = estimateMessageTokens({ role: 'assistant', content: null });
      // Should still have overhead tokens
      assert.ok(tokens > 0);
    });

    it('should add overhead beyond just content tokens', () => {
      const contentOnly = 'Hello'; // ~1-2 tokens
      const msgTokens = estimateMessageTokens({ role: 'user', content: contentOnly });
      // Message tokens should be more than just content due to overhead
      assert.ok(msgTokens > 1);
    });

    it('should include name tokens when present', () => {
      const withoutName = estimateMessageTokens({ role: 'user', content: 'Hi' });
      const withName = estimateMessageTokens({ role: 'user', content: 'Hi', name: 'Alice' });
      assert.ok(withName > withoutName);
    });

    it('should work for all providers', () => {
      const msg: TokenMessage = { role: 'user', content: 'Hello!' };
      const providers: Provider[] = ['openai', 'anthropic', 'xai'];

      for (const provider of providers) {
        const tokens = estimateMessageTokens(msg, provider);
        assert.ok(tokens > 0, `${provider} should return positive tokens`);
      }
    });
  });

  describe('estimateChatTokens', () => {
    it('should return 0 for empty array', () => {
      assert.equal(estimateChatTokens([]), 0);
    });

    it('should sum tokens for all messages plus overhead', () => {
      const messages: TokenMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ];
      const total = estimateChatTokens(messages);
      assert.ok(total > 0);

      // Should be more than individual messages due to conversation overhead
      const msg1 = estimateMessageTokens(messages[0]);
      const msg2 = estimateMessageTokens(messages[1]);
      assert.ok(total >= msg1 + msg2);
    });

    it('should return consistent results', () => {
      const messages: TokenMessage[] = [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello!' },
      ];
      const tokens1 = estimateChatTokens(messages);
      const tokens2 = estimateChatTokens(messages);
      assert.equal(tokens1, tokens2);
    });

    it('should work for all providers', () => {
      const messages: TokenMessage[] = [{ role: 'user', content: 'Test' }];
      const providers: Provider[] = ['openai', 'anthropic', 'xai'];

      for (const provider of providers) {
        const tokens = estimateChatTokens(messages, provider);
        assert.ok(tokens > 0, `${provider} should return positive tokens`);
      }
    });
  });

  describe('getMessageOverhead', () => {
    it('should return overhead values for all providers', () => {
      const providers: Provider[] = ['openai', 'anthropic', 'xai'];

      for (const provider of providers) {
        const overhead = getMessageOverhead(provider);
        assert.ok(overhead.perMessage > 0, `${provider} perMessage should be positive`);
        assert.ok(overhead.conversation >= 0, `${provider} conversation should be non-negative`);
      }
    });

    it('should default to openai', () => {
      const defaultOverhead = getMessageOverhead();
      const openaiOverhead = getMessageOverhead('openai');
      assert.deepEqual(defaultOverhead, openaiOverhead);
    });
  });

  describe('estimateSystemPromptTokens', () => {
    it('should return tokens for system prompt', () => {
      const tokens = estimateSystemPromptTokens('You are a helpful assistant.');
      assert.ok(tokens > 0);
    });

    it('should be same as estimateMessageTokens with system role', () => {
      const systemPrompt = 'You are helpful.';
      const fromFunction = estimateSystemPromptTokens(systemPrompt, 'openai');
      const fromMessage = estimateMessageTokens(
        { role: 'system', content: systemPrompt },
        'openai',
      );
      assert.equal(fromFunction, fromMessage);
    });
  });

  describe('calculateAvailableTokens', () => {
    it('should return full context when no usage', () => {
      const available = calculateAvailableTokens({ contextWindow: 4000 });
      assert.equal(available, 4000);
    });

    it('should subtract system prompt tokens', () => {
      const available = calculateAvailableTokens({
        contextWindow: 4000,
        systemPromptTokens: 100,
      });
      assert.equal(available, 3900);
    });

    it('should subtract reserved response tokens', () => {
      const available = calculateAvailableTokens({
        contextWindow: 4000,
        reserveForResponse: 500,
      });
      assert.equal(available, 3500);
    });

    it('should subtract history tokens', () => {
      const available = calculateAvailableTokens({
        contextWindow: 4000,
        historyTokens: 1000,
      });
      assert.equal(available, 3000);
    });

    it('should subtract all factors', () => {
      const available = calculateAvailableTokens({
        contextWindow: 4000,
        systemPromptTokens: 100,
        reserveForResponse: 500,
        historyTokens: 1000,
      });
      assert.equal(available, 2400);
    });

    it('should return 0 when over budget', () => {
      const available = calculateAvailableTokens({
        contextWindow: 1000,
        systemPromptTokens: 500,
        reserveForResponse: 600,
      });
      assert.equal(available, 0);
    });
  });

  describe('messagesFitBudget', () => {
    it('should return true for empty messages', () => {
      assert.equal(messagesFitBudget([], 100), true);
    });

    it('should return true when under budget', () => {
      const messages: TokenMessage[] = [{ role: 'user', content: 'Hi' }];
      assert.equal(messagesFitBudget(messages, 1000), true);
    });

    it('should return false when over budget', () => {
      const messages: TokenMessage[] = [{ role: 'user', content: 'A'.repeat(10000) }];
      assert.equal(messagesFitBudget(messages, 10), false);
    });

    it('should respect provider overhead differences', () => {
      const messages: TokenMessage[] = [
        { role: 'user', content: 'Test message' },
        { role: 'assistant', content: 'Response' },
      ];
      // Get exact token count for each provider
      const openaiTokens = estimateChatTokens(messages, 'openai');
      const anthropicTokens = estimateChatTokens(messages, 'anthropic');

      // Should fit at exactly that budget
      assert.equal(messagesFitBudget(messages, openaiTokens, 'openai'), true);
      assert.equal(messagesFitBudget(messages, anthropicTokens, 'anthropic'), true);
    });
  });
});

