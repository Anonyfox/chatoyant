/**
 * Tests for provider detection utilities.
 *
 * Covers all routing scenarios including ambiguous cases, edge cases,
 * and the OpenRouter slash-notation convention.
 */

import * as assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  activeProviders,
  assertProviderActive,
  detectProviderByModel,
  getApiKey,
  getBaseUrl,
  getOpenRouterApiKey,
  isProviderActive,
  ProviderError,
  resolveProvider,
} from './detection.js';
import { PROVIDERS } from './registry.js';

describe('providers/detection', () => {
  // Store original env values
  const originalEnv: Record<string, string | undefined> = {};
  const envKeys = [
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'XAI_API_KEY',
    'OPENROUTER_API_KEY',
    'API_KEY_OPENAI',
    'API_KEY_ANTHROPIC',
    'API_KEY_XAI',
    'API_KEY_OPENROUTER',
    'LOCAL_BASE_URL',
    'LOCAL_API_KEY',
  ];

  beforeEach(() => {
    for (const key of envKeys) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  // =========================================================================
  // ProviderError
  // =========================================================================

  describe('ProviderError', () => {
    it('should create error with message', () => {
      const error = new ProviderError('Test error');
      assert.equal(error.message, 'Test error');
      assert.equal(error.name, 'ProviderError');
      assert.ok(error instanceof Error);
    });

    it('should create error with provider info', () => {
      const error = new ProviderError('Test error', 'openai', 'OPENAI_API_KEY');
      assert.equal(error.providerId, 'openai');
      assert.equal(error.envKey, 'OPENAI_API_KEY');
    });

    it('should create missing API key error for openai', () => {
      const error = ProviderError.missingApiKey('openai');
      assert.ok(error.message.includes('OpenAI'));
      assert.ok(error.message.includes('OPENAI_API_KEY'));
      assert.equal(error.providerId, 'openai');
      assert.equal(error.envKey, 'OPENAI_API_KEY');
    });

    it('should create missing API key error for local (mentions LOCAL_BASE_URL)', () => {
      const error = ProviderError.missingApiKey('local');
      assert.ok(error.message.includes('LOCAL_BASE_URL'));
      assert.equal(error.providerId, 'local');
    });

    it('should create missing API key error for openrouter', () => {
      const error = ProviderError.missingApiKey('openrouter');
      assert.ok(error.message.includes('OPENROUTER_API_KEY'));
      assert.equal(error.providerId, 'openrouter');
    });

    it('should create unknown provider error listing known signatures', () => {
      const error = ProviderError.unknownProvider('mystery-model');
      assert.ok(error.message.includes('mystery-model'));
      assert.ok(error.message.includes('gpt'));
      assert.ok(error.message.includes('claude'));
      assert.ok(error.message.includes('grok'));
    });
  });

  // =========================================================================
  // detectProviderByModel — OpenRouter (slash notation, highest priority)
  // =========================================================================

  describe('detectProviderByModel — OpenRouter slash notation', () => {
    it('should detect org/model as openrouter', () => {
      assert.equal(detectProviderByModel('meta-llama/llama-3.1-8b-instruct'), 'openrouter');
    });

    it('should detect anthropic/claude-opus-4 as openrouter (not anthropic)', () => {
      assert.equal(detectProviderByModel('anthropic/claude-opus-4'), 'openrouter');
    });

    it('should detect openai/gpt-4o as openrouter (not openai)', () => {
      assert.equal(detectProviderByModel('openai/gpt-4o'), 'openrouter');
    });

    it('should detect x-ai/grok-3 as openrouter (not xai)', () => {
      assert.equal(detectProviderByModel('x-ai/grok-3'), 'openrouter');
    });

    it('should detect google/gemini-pro as openrouter', () => {
      assert.equal(detectProviderByModel('google/gemini-pro'), 'openrouter');
    });

    it('should detect mistralai/mistral-large as openrouter', () => {
      assert.equal(detectProviderByModel('mistralai/mistral-large'), 'openrouter');
    });

    it('should detect cohere/command-r-plus as openrouter', () => {
      assert.equal(detectProviderByModel('cohere/command-r-plus'), 'openrouter');
    });

    it('should detect deepseek/deepseek-r1 as openrouter', () => {
      assert.equal(detectProviderByModel('deepseek/deepseek-r1'), 'openrouter');
    });

    it('should detect qwen/qwen-72b as openrouter', () => {
      assert.equal(detectProviderByModel('qwen/qwen-72b'), 'openrouter');
    });

    it('should detect openai/o3 as openrouter (slash beats o3 signature)', () => {
      assert.equal(detectProviderByModel('openai/o3'), 'openrouter');
    });

    it('should detect anthropic/claude-3-5-sonnet-20241022 as openrouter', () => {
      assert.equal(detectProviderByModel('anthropic/claude-3-5-sonnet-20241022'), 'openrouter');
    });

    it('slash detection is case-sensitive to the slash character itself', () => {
      // Slash is always slash — no case concern here
      assert.equal(detectProviderByModel('Meta-Llama/Llama-3.1-8B'), 'openrouter');
    });
  });

  // =========================================================================
  // detectProviderByModel — native providers (no slash)
  // =========================================================================

  describe('detectProviderByModel — OpenAI (native, no slash)', () => {
    it('should detect gpt-4', () => assert.equal(detectProviderByModel('gpt-4'), 'openai'));
    it('should detect gpt-4-turbo', () =>
      assert.equal(detectProviderByModel('gpt-4-turbo'), 'openai'));
    it('should detect gpt-4o', () => assert.equal(detectProviderByModel('gpt-4o'), 'openai'));
    it('should detect gpt-4o-mini', () =>
      assert.equal(detectProviderByModel('gpt-4o-mini'), 'openai'));
    it('should detect gpt-3.5-turbo', () =>
      assert.equal(detectProviderByModel('gpt-3.5-turbo'), 'openai'));
    it('should detect gpt-5', () => assert.equal(detectProviderByModel('gpt-5'), 'openai'));
    it('should detect o1-preview', () =>
      assert.equal(detectProviderByModel('o1-preview'), 'openai'));
    it('should detect o1-mini', () => assert.equal(detectProviderByModel('o1-mini'), 'openai'));
    it('should detect o1', () => assert.equal(detectProviderByModel('o1'), 'openai'));
    it('should detect o3', () => assert.equal(detectProviderByModel('o3'), 'openai'));
    it('should detect o3-mini', () => assert.equal(detectProviderByModel('o3-mini'), 'openai'));
    it('should detect o3-pro', () => assert.equal(detectProviderByModel('o3-pro'), 'openai'));
    it('should detect chatgpt-4o-latest', () =>
      assert.equal(detectProviderByModel('chatgpt-4o-latest'), 'openai'));
  });

  describe('detectProviderByModel — Anthropic (native, no slash)', () => {
    it('should detect claude-opus-4', () =>
      assert.equal(detectProviderByModel('claude-opus-4'), 'anthropic'));
    it('should detect claude-sonnet-4', () =>
      assert.equal(detectProviderByModel('claude-sonnet-4'), 'anthropic'));
    it('should detect claude-3-5-sonnet-latest', () =>
      assert.equal(detectProviderByModel('claude-3-5-sonnet-latest'), 'anthropic'));
    it('should detect claude-3-5-sonnet-20241022', () =>
      assert.equal(detectProviderByModel('claude-3-5-sonnet-20241022'), 'anthropic'));
    it('should detect claude-3-opus', () =>
      assert.equal(detectProviderByModel('claude-3-opus'), 'anthropic'));
    it('should detect claude-3-haiku', () =>
      assert.equal(detectProviderByModel('claude-3-haiku'), 'anthropic'));
    it('should detect claude-2.1', () =>
      assert.equal(detectProviderByModel('claude-2.1'), 'anthropic'));
  });

  describe('detectProviderByModel — xAI (native, no slash)', () => {
    it('should detect grok-2', () => assert.equal(detectProviderByModel('grok-2'), 'xai'));
    it('should detect grok-3', () => assert.equal(detectProviderByModel('grok-3'), 'xai'));
    it('should detect grok-3-mini', () =>
      assert.equal(detectProviderByModel('grok-3-mini'), 'xai'));
    it('should detect grok-4', () => assert.equal(detectProviderByModel('grok-4'), 'xai'));
    it('should detect grok-beta', () => assert.equal(detectProviderByModel('grok-beta'), 'xai'));
  });

  describe('detectProviderByModel — case insensitivity', () => {
    it('should detect GPT-4 (uppercase)', () =>
      assert.equal(detectProviderByModel('GPT-4'), 'openai'));
    it('should detect Claude-3-Opus (mixed case)', () =>
      assert.equal(detectProviderByModel('Claude-3-Opus'), 'anthropic'));
    it('should detect GROK-2 (uppercase)', () =>
      assert.equal(detectProviderByModel('GROK-2'), 'xai'));
  });

  describe('detectProviderByModel — unknown / local models (no slash)', () => {
    it('should return null for unknown model', () =>
      assert.equal(detectProviderByModel('unknown-model'), null));
    it('should return null for empty string', () => assert.equal(detectProviderByModel(''), null));
    it('should return null for Qwen (local fallback happens in resolveProvider)', () =>
      assert.equal(detectProviderByModel('Qwen3.5-9B-MLX-4bit'), null));
    it('should return null for mistral (no slash)', () =>
      assert.equal(detectProviderByModel('mistral-large'), null));
    it('should return null for llama (no slash)', () =>
      assert.equal(detectProviderByModel('llama-3.1-70b'), null));
    it('should return null for DeepSeek (no slash)', () =>
      assert.equal(detectProviderByModel('DeepSeek-R1-7B'), null));
    it('should return null for Ministral (no slash)', () =>
      assert.equal(detectProviderByModel('Ministral-3-14B'), null));
  });

  // =========================================================================
  // The critical ambiguity cases — slash BEATS signature
  // =========================================================================

  describe('detectProviderByModel — slash beats native signature (critical)', () => {
    it('anthropic/ prefix overrides claude signature', () => {
      // "claude" is in the model name AND it has a slash — slash must win
      assert.equal(detectProviderByModel('anthropic/claude-opus-4'), 'openrouter');
      assert.notEqual(detectProviderByModel('anthropic/claude-opus-4'), 'anthropic');
    });

    it('openai/ prefix overrides gpt signature', () => {
      assert.equal(detectProviderByModel('openai/gpt-4o'), 'openrouter');
      assert.notEqual(detectProviderByModel('openai/gpt-4o'), 'openai');
    });

    it('openai/ prefix overrides o3 signature', () => {
      assert.equal(detectProviderByModel('openai/o3-mini'), 'openrouter');
      assert.notEqual(detectProviderByModel('openai/o3-mini'), 'openai');
    });

    it('x-ai/ prefix overrides grok signature', () => {
      assert.equal(detectProviderByModel('x-ai/grok-3'), 'openrouter');
      assert.notEqual(detectProviderByModel('x-ai/grok-3'), 'xai');
    });

    it('no slash → native provider detection still works', () => {
      assert.equal(detectProviderByModel('claude-opus-4'), 'anthropic');
      assert.equal(detectProviderByModel('gpt-4o'), 'openai');
      assert.equal(detectProviderByModel('grok-3'), 'xai');
    });
  });

  // =========================================================================
  // isProviderActive
  // =========================================================================

  describe('isProviderActive', () => {
    it('returns false for all providers when no env vars set', () => {
      assert.equal(isProviderActive('openai'), false);
      assert.equal(isProviderActive('anthropic'), false);
      assert.equal(isProviderActive('xai'), false);
      assert.equal(isProviderActive('openrouter'), false);
      assert.equal(isProviderActive('local'), false);
    });

    it('returns false when env var is empty string', () => {
      process.env.OPENAI_API_KEY = '';
      process.env.OPENROUTER_API_KEY = '';
      assert.equal(isProviderActive('openai'), false);
      assert.equal(isProviderActive('openrouter'), false);
    });

    it('returns true when OPENAI_API_KEY is set', () => {
      process.env.OPENAI_API_KEY = 'sk-test';
      assert.equal(isProviderActive('openai'), true);
    });

    it('returns true when ANTHROPIC_API_KEY is set', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      assert.equal(isProviderActive('anthropic'), true);
    });

    it('returns true when XAI_API_KEY is set', () => {
      process.env.XAI_API_KEY = 'xai-test';
      assert.equal(isProviderActive('xai'), true);
    });

    it('returns true when OPENROUTER_API_KEY is set', () => {
      process.env.OPENROUTER_API_KEY = 'sk-or-test';
      assert.equal(isProviderActive('openrouter'), true);
    });

    it('returns true for local when LOCAL_BASE_URL is set', () => {
      process.env.LOCAL_BASE_URL = 'http://127.0.0.1:8765/v1';
      assert.equal(isProviderActive('local'), true);
    });

    it('openrouter active does NOT activate any other provider', () => {
      process.env.OPENROUTER_API_KEY = 'sk-or-test';
      assert.equal(isProviderActive('openai'), false);
      assert.equal(isProviderActive('anthropic'), false);
      assert.equal(isProviderActive('xai'), false);
    });
  });

  // =========================================================================
  // activeProviders
  // =========================================================================

  describe('activeProviders', () => {
    it('returns empty array when no providers active', () => {
      assert.deepEqual(activeProviders(), []);
    });

    it('returns only openrouter when OPENROUTER_API_KEY set', () => {
      process.env.OPENROUTER_API_KEY = 'sk-or-test';
      const active = activeProviders();
      assert.ok(active.includes('openrouter'));
      assert.equal(active.length, 1);
    });

    it('can have both openrouter and native providers active simultaneously', () => {
      process.env.OPENAI_API_KEY = 'sk-openai';
      process.env.OPENROUTER_API_KEY = 'sk-or-test';
      const active = activeProviders();
      assert.ok(active.includes('openai'));
      assert.ok(active.includes('openrouter'));
    });

    it('returns all 5 when all providers configured', () => {
      process.env.OPENAI_API_KEY = 'key1';
      process.env.ANTHROPIC_API_KEY = 'key2';
      process.env.XAI_API_KEY = 'key3';
      process.env.OPENROUTER_API_KEY = 'key4';
      process.env.LOCAL_BASE_URL = 'http://localhost:8765/v1';
      assert.equal(activeProviders().length, 5);
    });
  });

  // =========================================================================
  // local provider
  // =========================================================================

  describe('local provider', () => {
    it('isProviderActive("local") false without LOCAL_BASE_URL', () => {
      assert.equal(isProviderActive('local'), false);
    });

    it('isProviderActive("local") true when LOCAL_BASE_URL set', () => {
      process.env.LOCAL_BASE_URL = 'http://127.0.0.1:8765/v1';
      assert.equal(isProviderActive('local'), true);
    });

    it('getBaseUrl("local") returns LOCAL_BASE_URL', () => {
      process.env.LOCAL_BASE_URL = 'http://127.0.0.1:8765/v1';
      assert.equal(getBaseUrl('local'), 'http://127.0.0.1:8765/v1');
    });

    it('getBaseUrl("local") returns empty string when not set', () => {
      assert.equal(getBaseUrl('local'), '');
    });

    it('getApiKey("local") returns LOCAL_API_KEY when set', () => {
      process.env.LOCAL_BASE_URL = 'http://localhost:8765/v1';
      process.env.LOCAL_API_KEY = 'my-local-key';
      assert.equal(getApiKey('local'), 'my-local-key');
    });

    it('getApiKey("local") defaults to "local" when LOCAL_API_KEY not set', () => {
      process.env.LOCAL_BASE_URL = 'http://localhost:8765/v1';
      assert.equal(getApiKey('local'), 'local');
    });

    it('getApiKey("local") throws when LOCAL_BASE_URL not set', () => {
      assert.throws(
        () => getApiKey('local'),
        (e) => e instanceof ProviderError,
      );
    });
  });

  // =========================================================================
  // OpenRouter provider
  // =========================================================================

  describe('openrouter provider', () => {
    it('isProviderActive("openrouter") false without OPENROUTER_API_KEY', () => {
      assert.equal(isProviderActive('openrouter'), false);
    });

    it('isProviderActive("openrouter") true when OPENROUTER_API_KEY set', () => {
      process.env.OPENROUTER_API_KEY = 'sk-or-v1-test';
      assert.equal(isProviderActive('openrouter'), true);
    });

    it('isProviderActive("openrouter") true via legacy API_KEY_OPENROUTER', () => {
      process.env.API_KEY_OPENROUTER = 'legacy-or-key';
      assert.equal(isProviderActive('openrouter'), true);
    });

    it('getBaseUrl("openrouter") returns OpenRouter API endpoint', () => {
      assert.equal(getBaseUrl('openrouter'), 'https://openrouter.ai/api/v1');
    });

    it('getBaseUrl("openrouter") matches PROVIDERS registry', () => {
      assert.equal(getBaseUrl('openrouter'), PROVIDERS.openrouter.baseUrl);
    });

    it('getOpenRouterApiKey() returns OPENROUTER_API_KEY', () => {
      process.env.OPENROUTER_API_KEY = 'sk-or-key-123';
      assert.equal(getOpenRouterApiKey(), 'sk-or-key-123');
    });

    it('getOpenRouterApiKey() returns legacy API_KEY_OPENROUTER when primary not set', () => {
      process.env.API_KEY_OPENROUTER = 'legacy-or-key';
      assert.equal(getOpenRouterApiKey(), 'legacy-or-key');
    });

    it('getOpenRouterApiKey() throws ProviderError when neither key set', () => {
      assert.throws(
        () => getOpenRouterApiKey(),
        (e) => e instanceof ProviderError,
      );
    });

    it('OPENROUTER_API_KEY takes precedence over legacy API_KEY_OPENROUTER', () => {
      process.env.OPENROUTER_API_KEY = 'primary-key';
      process.env.API_KEY_OPENROUTER = 'legacy-key';
      assert.equal(getOpenRouterApiKey(), 'primary-key');
    });

    it('ProviderError.missingApiKey("openrouter") mentions OPENROUTER_API_KEY', () => {
      const error = ProviderError.missingApiKey('openrouter');
      assert.ok(error.message.includes('OPENROUTER_API_KEY'));
      assert.equal(error.providerId, 'openrouter');
    });
  });

  // =========================================================================
  // resolveProvider — the full routing logic
  // =========================================================================

  describe('resolveProvider — native providers', () => {
    it('resolves gpt-4 to openai when active', () => {
      process.env.OPENAI_API_KEY = 'sk-test';
      assert.equal(resolveProvider('gpt-4'), 'openai');
    });

    it('resolves claude-opus-4 to anthropic when active', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant';
      assert.equal(resolveProvider('claude-opus-4'), 'anthropic');
    });

    it('resolves grok-3 to xai when active', () => {
      process.env.XAI_API_KEY = 'xai-key';
      assert.equal(resolveProvider('grok-3'), 'xai');
    });

    it('throws for known model with inactive provider', () => {
      assert.throws(
        () => resolveProvider('gpt-4'),
        (e) => e instanceof ProviderError && e.providerId === 'openai',
      );
    });

    it('throws for claude model when ANTHROPIC_API_KEY not set', () => {
      assert.throws(
        () => resolveProvider('claude-opus-4'),
        (e) => e instanceof ProviderError && e.providerId === 'anthropic',
      );
    });
  });

  describe('resolveProvider — OpenRouter', () => {
    it('resolves org/model to openrouter when OPENROUTER_API_KEY set', () => {
      process.env.OPENROUTER_API_KEY = 'sk-or-key';
      assert.equal(resolveProvider('meta-llama/llama-3.1-8b'), 'openrouter');
    });

    it('resolves anthropic/claude-opus-4 to openrouter (not anthropic)', () => {
      process.env.OPENROUTER_API_KEY = 'sk-or-key';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-key'; // both active
      assert.equal(resolveProvider('anthropic/claude-opus-4'), 'openrouter');
    });

    it('resolves openai/gpt-4o to openrouter (not openai)', () => {
      process.env.OPENROUTER_API_KEY = 'sk-or-key';
      process.env.OPENAI_API_KEY = 'sk-openai-key'; // both active
      assert.equal(resolveProvider('openai/gpt-4o'), 'openrouter');
    });

    it('resolves x-ai/grok-3 to openrouter (not xai)', () => {
      process.env.OPENROUTER_API_KEY = 'sk-or-key';
      process.env.XAI_API_KEY = 'xai-key'; // both active
      assert.equal(resolveProvider('x-ai/grok-3'), 'openrouter');
    });

    it('throws for slash-notation model when OPENROUTER_API_KEY not set', () => {
      // Even if native keys are set, slash model goes to openrouter — not native
      process.env.ANTHROPIC_API_KEY = 'sk-ant-key';
      assert.throws(
        () => resolveProvider('anthropic/claude-opus-4'),
        (e) => e instanceof ProviderError && e.providerId === 'openrouter',
      );
    });

    it('throws for openai/gpt-4o when OPENROUTER_API_KEY not set (not silently using openai)', () => {
      process.env.OPENAI_API_KEY = 'sk-openai-key'; // openai active, but model has slash
      assert.throws(
        () => resolveProvider('openai/gpt-4o'),
        (e) => e instanceof ProviderError && e.providerId === 'openrouter',
      );
    });

    it('resolves via legacy API_KEY_OPENROUTER', () => {
      process.env.API_KEY_OPENROUTER = 'legacy-key';
      assert.equal(resolveProvider('mistralai/mistral-large'), 'openrouter');
    });
  });

  describe('resolveProvider — local fallback', () => {
    it('falls back to local for unknown model when LOCAL_BASE_URL set', () => {
      process.env.LOCAL_BASE_URL = 'http://127.0.0.1:8765/v1';
      assert.equal(resolveProvider('Qwen3.5-9B-MLX-4bit'), 'local');
    });

    it('falls back to local for any unrecognised model name (no slash)', () => {
      process.env.LOCAL_BASE_URL = 'http://localhost:11434/v1';
      assert.equal(resolveProvider('mistral-nemo'), 'local');
      assert.equal(resolveProvider('my-fine-tuned-model'), 'local');
      assert.equal(resolveProvider('llama3.2:3b'), 'local');
    });

    it('does NOT fall back to local for slash-notation (slash → openrouter, not local)', () => {
      process.env.LOCAL_BASE_URL = 'http://localhost:8765/v1'; // local active
      // But no OPENROUTER_API_KEY — should throw about openrouter, not silently use local
      assert.throws(
        () => resolveProvider('meta-llama/llama-3.1-8b'),
        (e) => e instanceof ProviderError && e.providerId === 'openrouter',
      );
    });

    it('still detects native providers even when LOCAL_BASE_URL set', () => {
      process.env.OPENAI_API_KEY = 'sk-test';
      process.env.LOCAL_BASE_URL = 'http://localhost:8765/v1';
      assert.equal(resolveProvider('gpt-4o'), 'openai');
    });

    it('throws for unknown model when neither LOCAL_BASE_URL nor OPENROUTER_API_KEY set', () => {
      assert.throws(
        () => resolveProvider('Qwen3.5-9B-MLX-4bit'),
        (e) => e instanceof ProviderError && e.message.includes('Qwen3.5-9B-MLX-4bit'),
      );
    });
  });

  describe('resolveProvider — all providers active simultaneously', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'sk-openai';
      process.env.ANTHROPIC_API_KEY = 'sk-anthropic';
      process.env.XAI_API_KEY = 'sk-xai';
      process.env.OPENROUTER_API_KEY = 'sk-openrouter';
      process.env.LOCAL_BASE_URL = 'http://localhost:8765/v1';
    });

    it('native claude model goes to anthropic', () => {
      assert.equal(resolveProvider('claude-opus-4'), 'anthropic');
    });

    it('native gpt model goes to openai', () => {
      assert.equal(resolveProvider('gpt-4o'), 'openai');
    });

    it('native grok model goes to xai', () => {
      assert.equal(resolveProvider('grok-3'), 'xai');
    });

    it('slash claude model goes to openrouter', () => {
      assert.equal(resolveProvider('anthropic/claude-opus-4'), 'openrouter');
    });

    it('slash gpt model goes to openrouter', () => {
      assert.equal(resolveProvider('openai/gpt-4o'), 'openrouter');
    });

    it('third-party slash model goes to openrouter', () => {
      assert.equal(resolveProvider('meta-llama/llama-3.1-70b'), 'openrouter');
    });

    it('unknown local model name goes to local', () => {
      assert.equal(resolveProvider('Qwen3-4B-MLX'), 'local');
    });
  });

  // =========================================================================
  // assertProviderActive
  // =========================================================================

  describe('assertProviderActive', () => {
    it('does not throw when provider is active', () => {
      process.env.OPENAI_API_KEY = 'sk-test';
      assert.doesNotThrow(() => assertProviderActive('openai'));
    });

    it('does not throw for openrouter when key set', () => {
      process.env.OPENROUTER_API_KEY = 'sk-or-test';
      assert.doesNotThrow(() => assertProviderActive('openrouter'));
    });

    it('throws ProviderError for each inactive provider', () => {
      assert.throws(() => assertProviderActive('openai'));
      assert.throws(() => assertProviderActive('anthropic'));
      assert.throws(() => assertProviderActive('xai'));
      assert.throws(() => assertProviderActive('openrouter'));
      assert.throws(() => assertProviderActive('local'));
    });
  });

  // =========================================================================
  // getApiKey
  // =========================================================================

  describe('getApiKey', () => {
    it('returns correct key for each native provider', () => {
      process.env.OPENAI_API_KEY = 'openai-key';
      process.env.ANTHROPIC_API_KEY = 'anthropic-key';
      process.env.XAI_API_KEY = 'xai-key';

      assert.equal(getApiKey('openai'), 'openai-key');
      assert.equal(getApiKey('anthropic'), 'anthropic-key');
      assert.equal(getApiKey('xai'), 'xai-key');
    });

    it('throws when API key not set', () => {
      assert.throws(
        () => getApiKey('openai'),
        (e) => e instanceof ProviderError,
      );
      assert.throws(
        () => getApiKey('anthropic'),
        (e) => e instanceof ProviderError,
      );
      assert.throws(
        () => getApiKey('xai'),
        (e) => e instanceof ProviderError,
      );
    });
  });

  // =========================================================================
  // Legacy env var fallback
  // =========================================================================

  describe('legacy env var fallback', () => {
    it('recognizes API_KEY_OPENAI as fallback for OPENAI_API_KEY', () => {
      process.env.API_KEY_OPENAI = 'legacy-openai-key';
      assert.equal(isProviderActive('openai'), true);
      assert.equal(getApiKey('openai'), 'legacy-openai-key');
    });

    it('recognizes API_KEY_ANTHROPIC as fallback', () => {
      process.env.API_KEY_ANTHROPIC = 'legacy-anthropic-key';
      assert.equal(isProviderActive('anthropic'), true);
      assert.equal(getApiKey('anthropic'), 'legacy-anthropic-key');
    });

    it('recognizes API_KEY_XAI as fallback', () => {
      process.env.API_KEY_XAI = 'legacy-xai-key';
      assert.equal(isProviderActive('xai'), true);
      assert.equal(getApiKey('xai'), 'legacy-xai-key');
    });

    it('recognizes API_KEY_OPENROUTER as fallback', () => {
      process.env.API_KEY_OPENROUTER = 'legacy-or-key';
      assert.equal(isProviderActive('openrouter'), true);
    });

    it('primary key takes precedence over legacy for each provider', () => {
      process.env.OPENAI_API_KEY = 'new-openai';
      process.env.API_KEY_OPENAI = 'legacy-openai';
      assert.equal(getApiKey('openai'), 'new-openai');

      process.env.ANTHROPIC_API_KEY = 'new-anthropic';
      process.env.API_KEY_ANTHROPIC = 'legacy-anthropic';
      assert.equal(getApiKey('anthropic'), 'new-anthropic');

      process.env.OPENROUTER_API_KEY = 'new-or';
      process.env.API_KEY_OPENROUTER = 'legacy-or';
      assert.equal(getOpenRouterApiKey(), 'new-or');
    });

    it('error message includes legacy env var name', () => {
      const error = ProviderError.missingApiKey('anthropic');
      assert.ok(error.message.includes('ANTHROPIC_API_KEY'));
      assert.ok(error.message.includes('API_KEY_ANTHROPIC'));
    });
  });

  // =========================================================================
  // getBaseUrl
  // =========================================================================

  describe('getBaseUrl', () => {
    it('returns correct base URLs for all providers', () => {
      assert.equal(getBaseUrl('openai'), 'https://api.openai.com/v1');
      assert.equal(getBaseUrl('anthropic'), 'https://api.anthropic.com/v1');
      assert.equal(getBaseUrl('xai'), 'https://api.x.ai/v1');
      assert.equal(getBaseUrl('openrouter'), 'https://openrouter.ai/api/v1');
    });

    it('matches PROVIDERS registry for all static providers', () => {
      assert.equal(getBaseUrl('openai'), PROVIDERS.openai.baseUrl);
      assert.equal(getBaseUrl('anthropic'), PROVIDERS.anthropic.baseUrl);
      assert.equal(getBaseUrl('xai'), PROVIDERS.xai.baseUrl);
      assert.equal(getBaseUrl('openrouter'), PROVIDERS.openrouter.baseUrl);
    });

    it('returns LOCAL_BASE_URL dynamically for local provider', () => {
      process.env.LOCAL_BASE_URL = 'http://127.0.0.1:8765/v1';
      assert.equal(getBaseUrl('local'), 'http://127.0.0.1:8765/v1');
    });
  });
});
