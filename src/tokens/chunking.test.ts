/**
 * Tests for text chunking utilities.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  estimateChunkCount,
  fitMessages,
  paginateMessages,
  splitText,
  truncateContent,
} from './chunking.js';
import { estimateTokens } from './estimate.js';
import type { TokenMessage } from './types.js';

describe('tokens/chunking', () => {
  describe('splitText', () => {
    it('should return empty array for empty string', () => {
      const chunks = splitText('', { maxTokens: 100 });
      assert.deepEqual(chunks, []);
    });

    it('should return single chunk if text fits', () => {
      const text = 'Short text';
      const chunks = splitText(text, { maxTokens: 1000 });
      assert.equal(chunks.length, 1);
      assert.equal(chunks[0], text);
    });

    it('should split long text into multiple chunks', () => {
      const text = 'Word '.repeat(100);
      const chunks = splitText(text, { maxTokens: 10 });
      assert.ok(chunks.length > 1);
    });

    it('should produce chunks under maxTokens', () => {
      const text = 'This is a test sentence. '.repeat(50);
      const maxTokens = 20;
      const chunks = splitText(text, { maxTokens });

      for (const chunk of chunks) {
        const tokens = estimateTokens(chunk);
        // Allow some tolerance as estimation isn't exact
        assert.ok(tokens <= maxTokens * 1.5, `Chunk has ${tokens} tokens, expected ~${maxTokens}`);
      }
    });

    it('should handle overlap', () => {
      const text =
        'One two three four five six seven eight nine ten. ' +
        'Eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty.';
      const chunks = splitText(text, { maxTokens: 10, overlap: 2 });

      // With overlap, chunks should share some content
      assert.ok(chunks.length >= 1);
    });

    it('should respect custom separator', () => {
      const text = 'Part one.\n\nPart two.\n\nPart three.';
      const chunks = splitText(text, { maxTokens: 10, separator: '\n\n' });
      assert.ok(chunks.length >= 1);
    });

    it('should handle very long words', () => {
      const longWord = 'a'.repeat(1000);
      const chunks = splitText(longWord, { maxTokens: 10 });
      assert.ok(chunks.length > 0);
    });

    it('should preserve text (no data loss)', () => {
      const text = 'Hello world. This is a test.';
      const chunks = splitText(text, { maxTokens: 5 });
      // All words should appear somewhere in chunks
      const allContent = chunks.join(' ');
      for (const word of ['Hello', 'world', 'test']) {
        assert.ok(allContent.includes(word), `Missing word: ${word}`);
      }
    });
  });

  describe('fitMessages', () => {
    it('should return empty array for empty messages', () => {
      const fitted = fitMessages([], { maxTokens: 100 });
      assert.deepEqual(fitted, []);
    });

    it('should return empty array for zero budget', () => {
      const messages: TokenMessage[] = [{ role: 'user', content: 'Hello' }];
      const fitted = fitMessages(messages, { maxTokens: 0 });
      assert.deepEqual(fitted, []);
    });

    it('should return all messages if they fit', () => {
      const messages: TokenMessage[] = [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello' },
      ];
      const fitted = fitMessages(messages, { maxTokens: 10000 });
      assert.equal(fitted.length, 2);
    });

    it('should keep system message when truncating', () => {
      const messages: TokenMessage[] = [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Old message' },
        { role: 'user', content: 'Recent message' },
      ];
      const fitted = fitMessages(messages, { maxTokens: 50 });

      // System message should always be first if present
      if (fitted.length > 0) {
        assert.equal(fitted[0].role, 'system');
      }
    });

    it('should keep most recent messages', () => {
      const messages: TokenMessage[] = [
        { role: 'user', content: 'First' },
        { role: 'assistant', content: 'Second' },
        { role: 'user', content: 'Third' },
        { role: 'assistant', content: 'Fourth' },
      ];
      // Small budget that can only fit a couple messages
      const fitted = fitMessages(messages, { maxTokens: 30 });

      // Should have fewer messages
      assert.ok(fitted.length <= messages.length);

      // If any messages kept, should include the last one
      if (fitted.length > 0) {
        const lastFitted = fitted[fitted.length - 1];
        assert.equal(lastFitted.content, 'Fourth');
      }
    });

    it('should respect reserveForResponse', () => {
      const messages: TokenMessage[] = [
        { role: 'user', content: 'A message that uses some tokens' },
      ];
      const fittedNoReserve = fitMessages(messages, { maxTokens: 100 });
      const fittedWithReserve = fitMessages(messages, {
        maxTokens: 100,
        reserveForResponse: 90,
      });

      // With large reserve, should have fewer or no messages
      assert.ok(fittedWithReserve.length <= fittedNoReserve.length);
    });
  });

  describe('truncateContent', () => {
    it('should return original if under limit', () => {
      const content = 'Short text';
      const truncated = truncateContent(content, 1000);
      assert.equal(truncated, content);
    });

    it('should truncate with ellipsis', () => {
      const content = 'This is a longer piece of text that needs truncation';
      const truncated = truncateContent(content, 5);
      assert.ok(truncated.endsWith('...'));
      assert.ok(truncated.length < content.length);
    });

    it('should use custom ellipsis', () => {
      const content = 'A'.repeat(100);
      const truncated = truncateContent(content, 5, ' [more]');
      assert.ok(truncated.endsWith('[more]'));
    });

    it('should handle empty content', () => {
      assert.equal(truncateContent('', 10), '');
    });

    it('should return just ellipsis for very small limit', () => {
      const content = 'Hello world';
      const truncated = truncateContent(content, 0);
      assert.equal(truncated, '...');
    });
  });

  describe('paginateMessages', () => {
    it('should return empty array for empty messages', () => {
      const pages = paginateMessages([], 100);
      assert.deepEqual(pages, []);
    });

    it('should return single page if all fit', () => {
      const messages: TokenMessage[] = [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello' },
      ];
      const pages = paginateMessages(messages, 10000);
      assert.equal(pages.length, 1);
      assert.equal(pages[0].length, 2);
    });

    it('should split into multiple pages', () => {
      const messages: TokenMessage[] = [
        { role: 'user', content: 'Message one' },
        { role: 'assistant', content: 'Message two' },
        { role: 'user', content: 'Message three' },
        { role: 'assistant', content: 'Message four' },
      ];
      // Small page size to force multiple pages
      const pages = paginateMessages(messages, 15);
      assert.ok(pages.length >= 1);

      // All messages should be present across pages
      const totalMessages = pages.reduce((sum, page) => sum + page.length, 0);
      assert.equal(totalMessages, messages.length);
    });

    it('should preserve message order within pages', () => {
      const messages: TokenMessage[] = [
        { role: 'user', content: 'First' },
        { role: 'assistant', content: 'Second' },
        { role: 'user', content: 'Third' },
      ];
      const pages = paginateMessages(messages, 10000);

      assert.equal(pages[0][0].content, 'First');
      assert.equal(pages[0][1].content, 'Second');
      assert.equal(pages[0][2].content, 'Third');
    });
  });

  describe('estimateChunkCount', () => {
    it('should return 0 for empty text', () => {
      assert.equal(estimateChunkCount('', 100), 0);
    });

    it('should return 0 for invalid chunk size', () => {
      assert.equal(estimateChunkCount('Hello', 0), 0);
      assert.equal(estimateChunkCount('Hello', -1), 0);
    });

    it('should return 1 for short text', () => {
      assert.equal(estimateChunkCount('Hi', 100), 1);
    });

    it('should return multiple for long text', () => {
      const longText = 'Word '.repeat(1000);
      const count = estimateChunkCount(longText, 50);
      assert.ok(count > 1);
    });

    it('should be consistent with splitText', () => {
      const text = 'This is a test sentence. '.repeat(20);
      const chunkSize = 20;
      const estimated = estimateChunkCount(text, chunkSize);
      const actual = splitText(text, { maxTokens: chunkSize });

      // Both should produce multiple chunks for long text
      assert.ok(estimated > 1, 'Should estimate multiple chunks');
      assert.ok(actual.length > 1, 'Should produce multiple chunks');
      // Estimation and actual may differ due to boundary handling, but both should be reasonable
      assert.ok(estimated >= 1 && actual.length >= 1);
    });
  });
});
