/**
 * Tests for providers module exports.
 */

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as providers from './index.js';

describe('providers/index', () => {
  describe('type exports', () => {
    it('should export ProviderId type usable at runtime', () => {
      // TypeScript types are compile-time only, but we can verify
      // the module exports what we expect
      const id: providers.ProviderId = 'openai';
      assert.equal(id, 'openai');
    });

    it('should export ProviderMeta type usable at runtime', () => {
      const meta: providers.ProviderMeta = {
        name: 'Test',
        signatures: ['test'],
        envKey: 'API_KEY_TEST',
        baseUrl: 'https://test.com',
      };
      assert.equal(meta.name, 'Test');
    });
  });

  describe('constant exports', () => {
    it('should export PROVIDERS registry', () => {
      assert.ok('PROVIDERS' in providers);
      assert.equal(typeof providers.PROVIDERS, 'object');
      assert.ok('openai' in providers.PROVIDERS);
      assert.ok('anthropic' in providers.PROVIDERS);
      assert.ok('xai' in providers.PROVIDERS);
    });

    it('should export PROVIDER_IDS array', () => {
      assert.ok('PROVIDER_IDS' in providers);
      assert.ok(Array.isArray(providers.PROVIDER_IDS));
      assert.equal(providers.PROVIDER_IDS.length, 3);
    });
  });

  describe('error exports', () => {
    it('should export ProviderError class', () => {
      assert.ok('ProviderError' in providers);
      const error = new providers.ProviderError('test');
      assert.ok(error instanceof Error);
      assert.equal(error.name, 'ProviderError');
    });
  });

  describe('function exports', () => {
    it('should export isProviderActive function', () => {
      assert.ok('isProviderActive' in providers);
      assert.equal(typeof providers.isProviderActive, 'function');
    });

    it('should export activeProviders function', () => {
      assert.ok('activeProviders' in providers);
      assert.equal(typeof providers.activeProviders, 'function');
    });

    it('should export detectProviderByModel function', () => {
      assert.ok('detectProviderByModel' in providers);
      assert.equal(typeof providers.detectProviderByModel, 'function');
    });

    it('should export assertProviderActive function', () => {
      assert.ok('assertProviderActive' in providers);
      assert.equal(typeof providers.assertProviderActive, 'function');
    });

    it('should export getApiKey function', () => {
      assert.ok('getApiKey' in providers);
      assert.equal(typeof providers.getApiKey, 'function');
    });

    it('should export getBaseUrl function', () => {
      assert.ok('getBaseUrl' in providers);
      assert.equal(typeof providers.getBaseUrl, 'function');
    });

    it('should export resolveProvider function', () => {
      assert.ok('resolveProvider' in providers);
      assert.equal(typeof providers.resolveProvider, 'function');
    });
  });

  describe('models exports', () => {
    it('should export model arrays', () => {
      assert.ok('OPENAI_MODELS' in providers);
      assert.ok('ANTHROPIC_MODELS' in providers);
      assert.ok('XAI_MODELS' in providers);
      assert.ok('MODELS_BY_PROVIDER' in providers);
    });

    it('should export model utility functions', () => {
      assert.ok('getModelsForProvider' in providers);
      assert.ok('isKnownModel' in providers);
      assert.ok('getAllKnownModels' in providers);
    });
  });

  describe('full API coverage', () => {
    it('should export exactly the expected number of items', () => {
      const expectedExports = [
        // Constants
        'PROVIDERS',
        'PROVIDER_IDS',
        // Error
        'ProviderError',
        // Functions
        'isProviderActive',
        'activeProviders',
        'detectProviderByModel',
        'assertProviderActive',
        'getApiKey',
        'getBaseUrl',
        'resolveProvider',
        // Models
        'OPENAI_MODELS',
        'ANTHROPIC_MODELS',
        'XAI_MODELS',
        'MODELS_BY_PROVIDER',
        'getModelsForProvider',
        'isKnownModel',
        'getAllKnownModels',
      ];

      for (const name of expectedExports) {
        assert.ok(name in providers, `Missing export: ${name}`);
      }
    });
  });
});
