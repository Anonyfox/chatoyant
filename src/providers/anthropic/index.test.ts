/**
 * Tests for Anthropic provider module exports.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as anthropic from './index.js';

describe('Anthropic provider module', () => {
  describe('client exports', () => {
    it('should export AnthropicClient class', () => {
      assert.ok(anthropic.AnthropicClient);
      assert.equal(typeof anthropic.AnthropicClient, 'function');
    });

    it('should export createAnthropicClient function', () => {
      assert.equal(typeof anthropic.createAnthropicClient, 'function');
    });
  });

  describe('messages exports', () => {
    it('should export createMessage function', () => {
      assert.equal(typeof anthropic.createMessage, 'function');
    });

    it('should export messageSimple function', () => {
      assert.equal(typeof anthropic.messageSimple, 'function');
    });

    it('should export messageWithTools function', () => {
      assert.equal(typeof anthropic.messageWithTools, 'function');
    });

    it('should export messageStructured function', () => {
      assert.equal(typeof anthropic.messageStructured, 'function');
    });

    it('should export extractText function', () => {
      assert.equal(typeof anthropic.extractText, 'function');
    });

    it('should export extractToolUses function', () => {
      assert.equal(typeof anthropic.extractToolUses, 'function');
    });
  });

  describe('streaming exports', () => {
    it('should export messageStream function', () => {
      assert.equal(typeof anthropic.messageStream, 'function');
    });

    it('should export messageStreamContent function', () => {
      assert.equal(typeof anthropic.messageStreamContent, 'function');
    });

    it('should export messageStreamAccumulate function', () => {
      assert.equal(typeof anthropic.messageStreamAccumulate, 'function');
    });

    it('should export messageStreamReadable function', () => {
      assert.equal(typeof anthropic.messageStreamReadable, 'function');
    });

    it('should export messageStreamToWritable function', () => {
      assert.equal(typeof anthropic.messageStreamToWritable, 'function');
    });
  });

  describe('request exports', () => {
    it('should export BASE_URL constant', () => {
      assert.equal(anthropic.BASE_URL, 'https://api.anthropic.com/v1');
    });

    it('should export DEFAULT_TIMEOUT constant', () => {
      assert.equal(anthropic.DEFAULT_TIMEOUT, 60_000);
    });

    it('should export API_VERSION constant', () => {
      assert.equal(anthropic.API_VERSION, '2023-06-01');
    });

    it('should export request function', () => {
      assert.equal(typeof anthropic.request, 'function');
    });

    it('should export requestRaw function', () => {
      assert.equal(typeof anthropic.requestRaw, 'function');
    });

    it('should export requestGet function', () => {
      assert.equal(typeof anthropic.requestGet, 'function');
    });

    it('should export buildHeaders function', () => {
      assert.equal(typeof anthropic.buildHeaders, 'function');
    });

    it('should export buildUrl function', () => {
      assert.equal(typeof anthropic.buildUrl, 'function');
    });
  });

  describe('stream exports', () => {
    it('should export parseSSEStream function', () => {
      assert.equal(typeof anthropic.parseSSEStream, 'function');
    });

    it('should export createAccumulator function', () => {
      assert.equal(typeof anthropic.createAccumulator, 'function');
    });

    it('should export updateAccumulator function', () => {
      assert.equal(typeof anthropic.updateAccumulator, 'function');
    });

    it('should export accumulatorToToolUses function', () => {
      assert.equal(typeof anthropic.accumulatorToToolUses, 'function');
    });

    it('should export streamWithAccumulator function', () => {
      assert.equal(typeof anthropic.streamWithAccumulator, 'function');
    });
  });

  describe('error exports', () => {
    it('should export AnthropicError class', () => {
      assert.ok(anthropic.AnthropicError);
      assert.equal(typeof anthropic.AnthropicError, 'function');
    });

    it('should export isAnthropicError function', () => {
      assert.equal(typeof anthropic.isAnthropicError, 'function');
    });
  });

  describe('client instantiation', () => {
    it('should create client with minimal config', () => {
      const client = anthropic.createAnthropicClient({
        apiKey: 'sk-test',
      });

      assert.ok(client instanceof anthropic.AnthropicClient);
    });

    it('should create client with full config', () => {
      const client = anthropic.createAnthropicClient({
        apiKey: 'sk-test',
        baseUrl: 'https://custom.api.com',
        timeout: 30000,
        defaultModel: 'claude-3-opus',
        defaultMaxTokens: 2048,
        headers: { 'X-Custom': 'value' },
        betas: ['pdfs-2024-09-25'],
      });

      assert.ok(client instanceof anthropic.AnthropicClient);
    });

    it('should have all expected methods', () => {
      const client = anthropic.createAnthropicClient({ apiKey: 'test' });

      // Message methods
      assert.equal(typeof client.message, 'function');
      assert.equal(typeof client.messageSimple, 'function');
      assert.equal(typeof client.messageWithTools, 'function');
      assert.equal(typeof client.messageStructured, 'function');

      // Streaming methods
      assert.equal(typeof client.stream, 'function');
      assert.equal(typeof client.streamContent, 'function');
      assert.equal(typeof client.streamAccumulate, 'function');
      assert.equal(typeof client.streamReadable, 'function');

      // Utility methods
      assert.equal(typeof client.extractText, 'function');
      assert.equal(typeof client.extractToolUses, 'function');
    });
  });
});
