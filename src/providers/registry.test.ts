/**
 * Tests for provider registry.
 */

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PROVIDER_IDS, PROVIDERS } from './registry.js';

describe('providers/registry', () => {
  describe('PROVIDERS', () => {
    it('should contain all three providers', () => {
      assert.ok('openai' in PROVIDERS);
      assert.ok('anthropic' in PROVIDERS);
      assert.ok('xai' in PROVIDERS);
      assert.equal(Object.keys(PROVIDERS).length, 3);
    });

    describe('openai', () => {
      it('should have correct metadata', () => {
        const openai = PROVIDERS.openai;
        assert.equal(openai.name, 'OpenAI');
        assert.deepEqual(openai.signatures, ['gpt', 'o1', 'o3', 'chatgpt']);
        assert.equal(openai.envKey, 'API_KEY_OPENAI');
        assert.equal(openai.baseUrl, 'https://api.openai.com/v1');
      });

      it('should have signatures for all OpenAI model families', () => {
        const signatures = PROVIDERS.openai.signatures;
        assert.ok(signatures.includes('gpt'), 'should include gpt for GPT models');
        assert.ok(signatures.includes('o1'), 'should include o1 for reasoning models');
        assert.ok(signatures.includes('o3'), 'should include o3 for reasoning models');
        assert.ok(signatures.includes('chatgpt'), 'should include chatgpt for ChatGPT models');
      });
    });

    describe('anthropic', () => {
      it('should have correct metadata', () => {
        const anthropic = PROVIDERS.anthropic;
        assert.equal(anthropic.name, 'Anthropic');
        assert.deepEqual(anthropic.signatures, ['claude']);
        assert.equal(anthropic.envKey, 'API_KEY_ANTHROPIC');
        assert.equal(anthropic.baseUrl, 'https://api.anthropic.com/v1');
      });
    });

    describe('xai', () => {
      it('should have correct metadata', () => {
        const xai = PROVIDERS.xai;
        assert.equal(xai.name, 'xAI');
        assert.deepEqual(xai.signatures, ['grok']);
        assert.equal(xai.envKey, 'API_KEY_XAI');
        assert.equal(xai.baseUrl, 'https://api.x.ai/v1');
      });
    });

    it('should be readonly', () => {
      // TypeScript prevents modification at compile time
      // Runtime check that the object structure is correct
      assert.deepEqual(Object.keys(PROVIDERS).sort(), ['anthropic', 'openai', 'xai']);
    });

    it('should have no overlapping signatures between providers', () => {
      const allSignatures = Object.values(PROVIDERS).flatMap((p) => p.signatures);
      const uniqueSignatures = new Set(allSignatures);
      assert.equal(
        allSignatures.length,
        uniqueSignatures.size,
        'Signatures should be unique across providers',
      );
    });

    it('should have at least one signature per provider', () => {
      for (const provider of Object.values(PROVIDERS)) {
        assert.ok(
          provider.signatures.length >= 1,
          `${provider.name} should have at least one signature`,
        );
      }
    });

    it('should have unique env keys for each provider', () => {
      const envKeys = Object.values(PROVIDERS).map((p) => p.envKey);
      const uniqueEnvKeys = new Set(envKeys);
      assert.equal(envKeys.length, uniqueEnvKeys.size);
    });

    it('should have valid base URLs', () => {
      for (const provider of Object.values(PROVIDERS)) {
        assert.ok(provider.baseUrl.startsWith('https://'));
        assert.ok(provider.baseUrl.includes('/v1'));
      }
    });
  });

  describe('PROVIDER_IDS', () => {
    it('should contain all provider IDs', () => {
      assert.equal(PROVIDER_IDS.length, 3);
      assert.ok(PROVIDER_IDS.includes('openai'));
      assert.ok(PROVIDER_IDS.includes('anthropic'));
      assert.ok(PROVIDER_IDS.includes('xai'));
    });

    it('should match PROVIDERS keys', () => {
      const registryKeys = Object.keys(PROVIDERS).sort();
      const idsArray = [...PROVIDER_IDS].sort();
      assert.deepEqual(idsArray, registryKeys);
    });

    it('should be iterable', () => {
      const collected: string[] = [];
      for (const id of PROVIDER_IDS) {
        collected.push(id);
      }
      assert.equal(collected.length, 3);
    });
  });
});
