/**
 * Tests for provider types.
 */

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ProviderId, ProviderMeta, ProviderRegistry } from './types.js';

describe('providers/types', () => {
  describe('ProviderId', () => {
    it('should accept valid provider ids', () => {
      const openai: ProviderId = 'openai';
      const anthropic: ProviderId = 'anthropic';
      const xai: ProviderId = 'xai';

      assert.equal(openai, 'openai');
      assert.equal(anthropic, 'anthropic');
      assert.equal(xai, 'xai');
    });

    it('should be usable in type-safe contexts', () => {
      const ids: ProviderId[] = ['openai', 'anthropic', 'xai'];
      assert.equal(ids.length, 3);
      assert.ok(ids.includes('openai'));
      assert.ok(ids.includes('anthropic'));
      assert.ok(ids.includes('xai'));
    });
  });

  describe('ProviderMeta', () => {
    it('should define provider metadata structure', () => {
      const meta: ProviderMeta = {
        name: 'Test Provider',
        signatures: ['test', 'tst'],
        envKey: 'API_KEY_TEST',
        baseUrl: 'https://api.test.com/v1',
      };

      assert.equal(meta.name, 'Test Provider');
      assert.deepEqual(meta.signatures, ['test', 'tst']);
      assert.equal(meta.envKey, 'API_KEY_TEST');
      assert.equal(meta.baseUrl, 'https://api.test.com/v1');
    });

    it('should require all fields', () => {
      const meta: ProviderMeta = {
        name: 'OpenAI',
        signatures: ['gpt', 'o1', 'o3'],
        envKey: 'API_KEY_OPENAI',
        baseUrl: 'https://api.openai.com/v1',
      };

      // All fields should be defined
      assert.ok('name' in meta);
      assert.ok('signatures' in meta);
      assert.ok('envKey' in meta);
      assert.ok('baseUrl' in meta);
    });

    it('should support multiple signatures for a provider', () => {
      const meta: ProviderMeta = {
        name: 'OpenAI',
        signatures: ['gpt', 'o1', 'o3', 'chatgpt'],
        envKey: 'API_KEY_OPENAI',
        baseUrl: 'https://api.openai.com/v1',
      };

      assert.equal(meta.signatures.length, 4);
      assert.ok(meta.signatures.includes('gpt'));
      assert.ok(meta.signatures.includes('o1'));
      assert.ok(meta.signatures.includes('o3'));
      assert.ok(meta.signatures.includes('chatgpt'));
    });
  });

  describe('ProviderRegistry', () => {
    it('should map provider IDs to metadata', () => {
      const registry: ProviderRegistry = {
        openai: {
          name: 'OpenAI',
          signatures: ['gpt', 'o1', 'o3', 'chatgpt'],
          envKey: 'API_KEY_OPENAI',
          baseUrl: 'https://api.openai.com/v1',
        },
        anthropic: {
          name: 'Anthropic',
          signatures: ['claude'],
          envKey: 'API_KEY_ANTHROPIC',
          baseUrl: 'https://api.anthropic.com/v1',
        },
        xai: {
          name: 'xAI',
          signatures: ['grok'],
          envKey: 'API_KEY_XAI',
          baseUrl: 'https://api.x.ai/v1',
        },
      };

      assert.equal(Object.keys(registry).length, 3);
      assert.ok('openai' in registry);
      assert.ok('anthropic' in registry);
      assert.ok('xai' in registry);
    });
  });
});
