/**
 * Tests for provider detection utilities.
 */

import * as assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  activeProviders,
  assertProviderActive,
  detectProviderByModel,
  getApiKey,
  getBaseUrl,
  isProviderActive,
  ProviderError,
  resolveProvider,
} from './detection.js';
import { PROVIDERS } from './registry.js';

describe('providers/detection', () => {
  // Store original env values
  const originalEnv: Record<string, string | undefined> = {};
  const envKeys = ['API_KEY_OPENAI', 'API_KEY_ANTHROPIC', 'API_KEY_XAI'];

  beforeEach(() => {
    // Save and clear env vars
    for (const key of envKeys) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    // Restore env vars
    for (const key of envKeys) {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  describe('ProviderError', () => {
    it('should create error with message', () => {
      const error = new ProviderError('Test error');
      assert.equal(error.message, 'Test error');
      assert.equal(error.name, 'ProviderError');
      assert.ok(error instanceof Error);
    });

    it('should create error with provider info', () => {
      const error = new ProviderError('Test error', 'openai', 'API_KEY_OPENAI');
      assert.equal(error.providerId, 'openai');
      assert.equal(error.envKey, 'API_KEY_OPENAI');
    });

    it('should create missing API key error via factory', () => {
      const error = ProviderError.missingApiKey('openai');
      assert.ok(error.message.includes('OpenAI'));
      assert.ok(error.message.includes('API_KEY_OPENAI'));
      assert.equal(error.providerId, 'openai');
      assert.equal(error.envKey, 'API_KEY_OPENAI');
    });

    it('should create unknown provider error via factory', () => {
      const error = ProviderError.unknownProvider('mystery-model');
      assert.ok(error.message.includes('mystery-model'));
      assert.ok(error.message.includes('gpt'));
      assert.ok(error.message.includes('claude'));
      assert.ok(error.message.includes('grok'));
    });
  });

  describe('isProviderActive', () => {
    it('should return false when env var is not set', () => {
      assert.equal(isProviderActive('openai'), false);
      assert.equal(isProviderActive('anthropic'), false);
      assert.equal(isProviderActive('xai'), false);
    });

    it('should return false when env var is empty string', () => {
      process.env.API_KEY_OPENAI = '';
      assert.equal(isProviderActive('openai'), false);
    });

    it('should return true when env var is set', () => {
      process.env.API_KEY_OPENAI = 'sk-test-key';
      assert.equal(isProviderActive('openai'), true);
    });

    it('should check correct env var for each provider', () => {
      process.env.API_KEY_OPENAI = 'key1';
      process.env.API_KEY_ANTHROPIC = 'key2';
      process.env.API_KEY_XAI = 'key3';

      assert.equal(isProviderActive('openai'), true);
      assert.equal(isProviderActive('anthropic'), true);
      assert.equal(isProviderActive('xai'), true);
    });
  });

  describe('activeProviders', () => {
    it('should return empty array when no providers active', () => {
      const active = activeProviders();
      assert.deepEqual(active, []);
    });

    it('should return single active provider', () => {
      process.env.API_KEY_OPENAI = 'sk-test';
      const active = activeProviders();
      assert.deepEqual(active, ['openai']);
    });

    it('should return multiple active providers', () => {
      process.env.API_KEY_OPENAI = 'sk-test';
      process.env.API_KEY_ANTHROPIC = 'sk-ant';
      const active = activeProviders();
      assert.ok(active.includes('openai'));
      assert.ok(active.includes('anthropic'));
      assert.equal(active.length, 2);
    });

    it('should return all providers when all active', () => {
      process.env.API_KEY_OPENAI = 'key1';
      process.env.API_KEY_ANTHROPIC = 'key2';
      process.env.API_KEY_XAI = 'key3';
      const active = activeProviders();
      assert.equal(active.length, 3);
    });
  });

  describe('detectProviderByModel', () => {
    describe('OpenAI detection', () => {
      // GPT models
      it('should detect gpt-4', () => {
        assert.equal(detectProviderByModel('gpt-4'), 'openai');
      });

      it('should detect gpt-4-turbo', () => {
        assert.equal(detectProviderByModel('gpt-4-turbo'), 'openai');
      });

      it('should detect gpt-4o', () => {
        assert.equal(detectProviderByModel('gpt-4o'), 'openai');
      });

      it('should detect gpt-4o-mini', () => {
        assert.equal(detectProviderByModel('gpt-4o-mini'), 'openai');
      });

      it('should detect gpt-3.5-turbo', () => {
        assert.equal(detectProviderByModel('gpt-3.5-turbo'), 'openai');
      });

      it('should detect gpt-5.2', () => {
        assert.equal(detectProviderByModel('gpt-5.2'), 'openai');
      });

      it('should detect gpt-5-mini', () => {
        assert.equal(detectProviderByModel('gpt-5-mini'), 'openai');
      });

      // O1 reasoning models
      it('should detect o1-preview', () => {
        assert.equal(detectProviderByModel('o1-preview'), 'openai');
      });

      it('should detect o1-mini', () => {
        assert.equal(detectProviderByModel('o1-mini'), 'openai');
      });

      it('should detect o1', () => {
        assert.equal(detectProviderByModel('o1'), 'openai');
      });

      // O3 reasoning models
      it('should detect o3', () => {
        assert.equal(detectProviderByModel('o3'), 'openai');
      });

      it('should detect o3-mini', () => {
        assert.equal(detectProviderByModel('o3-mini'), 'openai');
      });

      it('should detect o3-pro', () => {
        assert.equal(detectProviderByModel('o3-pro'), 'openai');
      });

      it('should detect o3-deep-research', () => {
        assert.equal(detectProviderByModel('o3-deep-research'), 'openai');
      });

      // ChatGPT models
      it('should detect chatgpt-4o-latest', () => {
        assert.equal(detectProviderByModel('chatgpt-4o-latest'), 'openai');
      });

      it('should detect chatgpt-image-latest', () => {
        assert.equal(detectProviderByModel('chatgpt-image-latest'), 'openai');
      });
    });

    describe('Anthropic detection', () => {
      // Claude 4 series
      it('should detect claude-opus-4', () => {
        assert.equal(detectProviderByModel('claude-opus-4'), 'anthropic');
      });

      it('should detect claude-sonnet-4', () => {
        assert.equal(detectProviderByModel('claude-sonnet-4'), 'anthropic');
      });

      it('should detect claude-opus-4.5', () => {
        assert.equal(detectProviderByModel('claude-opus-4.5'), 'anthropic');
      });

      it('should detect claude-haiku-4.5', () => {
        assert.equal(detectProviderByModel('claude-haiku-4.5'), 'anthropic');
      });

      // Claude 3.5 series
      it('should detect claude-3-5-sonnet-latest', () => {
        assert.equal(detectProviderByModel('claude-3-5-sonnet-latest'), 'anthropic');
      });

      it('should detect claude-3-5-sonnet-20241022', () => {
        assert.equal(detectProviderByModel('claude-3-5-sonnet-20241022'), 'anthropic');
      });

      // Claude 3 series
      it('should detect claude-3-opus', () => {
        assert.equal(detectProviderByModel('claude-3-opus'), 'anthropic');
      });

      it('should detect claude-3-sonnet', () => {
        assert.equal(detectProviderByModel('claude-3-sonnet'), 'anthropic');
      });

      it('should detect claude-3-haiku', () => {
        assert.equal(detectProviderByModel('claude-3-haiku'), 'anthropic');
      });

      // Legacy
      it('should detect claude-2.1', () => {
        assert.equal(detectProviderByModel('claude-2.1'), 'anthropic');
      });
    });

    describe('xAI detection', () => {
      it('should detect grok-2', () => {
        assert.equal(detectProviderByModel('grok-2'), 'xai');
      });

      it('should detect grok-beta', () => {
        assert.equal(detectProviderByModel('grok-beta'), 'xai');
      });

      it('should detect grok-2-1212', () => {
        assert.equal(detectProviderByModel('grok-2-1212'), 'xai');
      });

      it('should detect grok-3', () => {
        assert.equal(detectProviderByModel('grok-3'), 'xai');
      });

      it('should detect grok-3-mini', () => {
        assert.equal(detectProviderByModel('grok-3-mini'), 'xai');
      });

      it('should detect grok-4', () => {
        assert.equal(detectProviderByModel('grok-4'), 'xai');
      });

      it('should detect grok-4-fast-reasoning', () => {
        assert.equal(detectProviderByModel('grok-4-fast-reasoning'), 'xai');
      });

      it('should detect grok-code-fast-1', () => {
        assert.equal(detectProviderByModel('grok-code-fast-1'), 'xai');
      });
    });

    describe('case insensitivity', () => {
      it('should detect uppercase GPT-4', () => {
        assert.equal(detectProviderByModel('GPT-4'), 'openai');
      });

      it('should detect mixed case Claude-3', () => {
        assert.equal(detectProviderByModel('Claude-3-Opus'), 'anthropic');
      });

      it('should detect uppercase GROK', () => {
        assert.equal(detectProviderByModel('GROK-2'), 'xai');
      });
    });

    describe('unknown models', () => {
      it('should return null for unknown model', () => {
        assert.equal(detectProviderByModel('unknown-model'), null);
      });

      it('should return null for empty string', () => {
        assert.equal(detectProviderByModel(''), null);
      });

      it('should return null for llama models', () => {
        assert.equal(detectProviderByModel('llama-3.1-70b'), null);
      });

      it('should return null for mistral models', () => {
        assert.equal(detectProviderByModel('mistral-large'), null);
      });
    });
  });

  describe('assertProviderActive', () => {
    it('should not throw when provider is active', () => {
      process.env.API_KEY_OPENAI = 'sk-test';
      assert.doesNotThrow(() => assertProviderActive('openai'));
    });

    it('should throw ProviderError when provider is not active', () => {
      assert.throws(
        () => assertProviderActive('openai'),
        (error) => {
          assert.ok(error instanceof ProviderError);
          assert.equal(error.providerId, 'openai');
          return true;
        },
      );
    });

    it('should throw for each inactive provider', () => {
      assert.throws(() => assertProviderActive('openai'));
      assert.throws(() => assertProviderActive('anthropic'));
      assert.throws(() => assertProviderActive('xai'));
    });
  });

  describe('getApiKey', () => {
    it('should return API key when set', () => {
      process.env.API_KEY_OPENAI = 'sk-test-key-123';
      assert.equal(getApiKey('openai'), 'sk-test-key-123');
    });

    it('should throw when API key not set', () => {
      assert.throws(
        () => getApiKey('openai'),
        (error) => error instanceof ProviderError,
      );
    });

    it('should return correct key for each provider', () => {
      process.env.API_KEY_OPENAI = 'openai-key';
      process.env.API_KEY_ANTHROPIC = 'anthropic-key';
      process.env.API_KEY_XAI = 'xai-key';

      assert.equal(getApiKey('openai'), 'openai-key');
      assert.equal(getApiKey('anthropic'), 'anthropic-key');
      assert.equal(getApiKey('xai'), 'xai-key');
    });
  });

  describe('getBaseUrl', () => {
    it('should return OpenAI base URL', () => {
      assert.equal(getBaseUrl('openai'), 'https://api.openai.com/v1');
    });

    it('should return Anthropic base URL', () => {
      assert.equal(getBaseUrl('anthropic'), 'https://api.anthropic.com/v1');
    });

    it('should return xAI base URL', () => {
      assert.equal(getBaseUrl('xai'), 'https://api.x.ai/v1');
    });

    it('should match PROVIDERS registry', () => {
      assert.equal(getBaseUrl('openai'), PROVIDERS.openai.baseUrl);
      assert.equal(getBaseUrl('anthropic'), PROVIDERS.anthropic.baseUrl);
      assert.equal(getBaseUrl('xai'), PROVIDERS.xai.baseUrl);
    });
  });

  describe('resolveProvider', () => {
    it('should detect and return active provider', () => {
      process.env.API_KEY_OPENAI = 'sk-test';
      const provider = resolveProvider('gpt-4');
      assert.equal(provider, 'openai');
    });

    it('should throw for unknown model', () => {
      assert.throws(
        () => resolveProvider('unknown-model'),
        (error) => {
          assert.ok(error instanceof ProviderError);
          assert.ok(error.message.includes('unknown-model'));
          return true;
        },
      );
    });

    it('should throw for known model with inactive provider', () => {
      // Don't set API_KEY_OPENAI
      assert.throws(
        () => resolveProvider('gpt-4'),
        (error) => {
          assert.ok(error instanceof ProviderError);
          assert.equal(error.providerId, 'openai');
          return true;
        },
      );
    });

    it('should work for all providers when active', () => {
      process.env.API_KEY_OPENAI = 'key1';
      process.env.API_KEY_ANTHROPIC = 'key2';
      process.env.API_KEY_XAI = 'key3';

      assert.equal(resolveProvider('gpt-4'), 'openai');
      assert.equal(resolveProvider('claude-3'), 'anthropic');
      assert.equal(resolveProvider('grok-2'), 'xai');
    });

    it('should work for OpenAI o1/o3 models when active', () => {
      process.env.API_KEY_OPENAI = 'key1';

      assert.equal(resolveProvider('o1-preview'), 'openai');
      assert.equal(resolveProvider('o3-mini'), 'openai');
    });
  });
});
