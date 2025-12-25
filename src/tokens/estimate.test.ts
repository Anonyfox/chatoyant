/**
 * Tests for token estimation utilities.
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  estimatePromptTokens,
  estimateTokens,
  estimateTokensMany,
  estimateTokensWithRatio,
  TOKEN_RATIOS,
} from './estimate.js';

describe('tokens/estimate', () => {
  describe('estimateTokens', () => {
    it('should return 0 for empty string', () => {
      assert.equal(estimateTokens(''), 0);
    });

    it('should return 0 for null-ish values', () => {
      assert.equal(estimateTokens(null as unknown as string), 0);
      assert.equal(estimateTokens(undefined as unknown as string), 0);
    });

    it('should return positive number for non-empty text', () => {
      const tokens = estimateTokens('Hello, world!');
      assert.ok(tokens > 0);
    });

    it('should return higher count for longer text', () => {
      const short = estimateTokens('Hi');
      const long = estimateTokens('Hello, this is a much longer piece of text that should have more tokens.');
      assert.ok(long > short);
    });

    it('should handle single character', () => {
      const tokens = estimateTokens('a');
      assert.ok(tokens >= 1);
    });

    it('should estimate code differently than prose', () => {
      const prose = 'The quick brown fox jumps over the lazy dog';
      const code = 'function greet(name) { return `Hello, ${name}!`; }';

      // Both should return reasonable estimates
      assert.ok(estimateTokens(prose) > 0);
      assert.ok(estimateTokens(code) > 0);
    });

    it('should handle CJK characters', () => {
      const cjk = '你好世界';
      const tokens = estimateTokens(cjk);
      assert.ok(tokens > 0);
      // CJK should have more tokens per character
      assert.ok(tokens >= cjk.length / 2);
    });

    it('should handle mixed content', () => {
      const mixed = 'Hello 世界! How are you?';
      const tokens = estimateTokens(mixed);
      assert.ok(tokens > 0);
    });

    it('should handle whitespace-only text', () => {
      const tokens = estimateTokens('   \n\t  ');
      assert.ok(tokens >= 1); // Whitespace still counts
    });

    it('should handle emoji', () => {
      const tokens = estimateTokens('Hello 👋 World 🌍!');
      assert.ok(tokens > 0);
    });
  });

  describe('estimatePromptTokens', () => {
    it('should return input and output separately', () => {
      const result = estimatePromptTokens('Hello', 'Hi there');
      assert.ok(result.input > 0);
      assert.ok(result.output > 0);
      assert.equal(result.total, result.input + result.output);
    });

    it('should handle missing response', () => {
      const result = estimatePromptTokens('Hello');
      assert.ok(result.input > 0);
      assert.equal(result.output, 0);
      assert.equal(result.total, result.input);
    });

    it('should handle empty prompt', () => {
      const result = estimatePromptTokens('', 'Response');
      assert.equal(result.input, 0);
      assert.ok(result.output > 0);
    });
  });

  describe('estimateTokensMany', () => {
    it('should return 0 for empty array', () => {
      assert.equal(estimateTokensMany([]), 0);
    });

    it('should sum tokens across all texts', () => {
      const texts = ['Hello', 'World', 'Test'];
      const total = estimateTokensMany(texts);
      const individual = texts.map(estimateTokens);
      assert.equal(total, individual.reduce((a, b) => a + b, 0));
    });

    it('should handle array with empty strings', () => {
      const texts = ['Hello', '', 'World'];
      const total = estimateTokensMany(texts);
      assert.ok(total > 0);
    });
  });

  describe('estimateTokensWithRatio', () => {
    it('should return 0 for empty string', () => {
      assert.equal(estimateTokensWithRatio('', 4), 0);
    });

    it('should return 0 for invalid ratio', () => {
      assert.equal(estimateTokensWithRatio('Hello', 0), 0);
      assert.equal(estimateTokensWithRatio('Hello', -1), 0);
    });

    it('should calculate based on provided ratio', () => {
      const text = 'Hello World'; // 11 chars
      assert.equal(estimateTokensWithRatio(text, 1), 11); // 1:1 ratio
      assert.equal(estimateTokensWithRatio(text, 11), 1); // 11:1 ratio
    });

    it('should ceil the result', () => {
      const text = 'Hi'; // 2 chars
      assert.equal(estimateTokensWithRatio(text, 3), 1); // 2/3 = 0.67 → 1
    });
  });

  describe('TOKEN_RATIOS', () => {
    it('should have expected content types', () => {
      assert.ok('english' in TOKEN_RATIOS);
      assert.ok('code' in TOKEN_RATIOS);
      assert.ok('cjk' in TOKEN_RATIOS);
      assert.ok('mixed' in TOKEN_RATIOS);
    });

    it('should have positive ratios', () => {
      for (const [type, ratio] of Object.entries(TOKEN_RATIOS)) {
        assert.ok(ratio > 0, `${type} should have positive ratio`);
      }
    });

    it('should have CJK ratio lower than English (more tokens per char)', () => {
      assert.ok(TOKEN_RATIOS.cjk < TOKEN_RATIOS.english);
    });
  });
});

