/**
 * Tests for presets module.
 */

import assert from 'node:assert';
import { describe, it } from 'node:test';

import {
  adjustXAIModelForReasoning,
  CREATIVITY_PRESETS,
  createEmptyCost,
  createEmptyTiming,
  createEmptyUsage,
  getReasoningConfig,
  isCreativityLevel,
  isModelPreset,
  MODEL_PRESETS,
  REASONING_PRESETS,
  resolveCreativity,
  resolveModelPreset,
  supportsReasoning,
} from './presets.js';

describe('Model Presets', () => {
  describe('isModelPreset()', () => {
    it('should return true for valid presets', () => {
      assert.equal(isModelPreset('fast'), true);
      assert.equal(isModelPreset('cheap'), true);
      assert.equal(isModelPreset('best'), true);
      assert.equal(isModelPreset('balanced'), true);
      assert.equal(isModelPreset('reasoning'), true);
    });

    it('should return false for actual model names', () => {
      assert.equal(isModelPreset('gpt-4o'), false);
      assert.equal(isModelPreset('claude-sonnet-4'), false);
      assert.equal(isModelPreset('grok-3'), false);
    });

    it('should return false for invalid values', () => {
      assert.equal(isModelPreset(''), false);
      assert.equal(isModelPreset('invalid'), false);
    });
  });

  describe('resolveModelPreset()', () => {
    it('should resolve fast preset to provider models', () => {
      assert.equal(resolveModelPreset('fast', 'openai'), 'gpt-4o-mini');
      assert.equal(resolveModelPreset('fast', 'anthropic'), 'claude-3-5-haiku-20241022');
      assert.equal(resolveModelPreset('fast', 'xai'), 'grok-4-1-fast-non-reasoning');
    });

    it('should resolve best preset to provider models', () => {
      assert.equal(resolveModelPreset('best', 'openai'), 'gpt-5.1');
      assert.equal(resolveModelPreset('best', 'anthropic'), 'claude-sonnet-4-20250514');
      assert.equal(resolveModelPreset('best', 'xai'), 'grok-4-0709');
    });

    it('should resolve cheap preset to provider models', () => {
      assert.equal(resolveModelPreset('cheap', 'openai'), 'gpt-4o-mini');
      assert.equal(resolveModelPreset('cheap', 'anthropic'), 'claude-3-5-haiku-20241022');
      assert.equal(resolveModelPreset('cheap', 'xai'), 'grok-3-mini');
    });

    it('should default to openai when provider not specified', () => {
      assert.equal(resolveModelPreset('balanced'), 'gpt-4o');
    });
  });

  describe('MODEL_PRESETS structure', () => {
    it('should have all providers for each preset', () => {
      for (const preset of Object.keys(MODEL_PRESETS) as Array<keyof typeof MODEL_PRESETS>) {
        assert.ok(MODEL_PRESETS[preset].openai, `${preset} missing openai`);
        assert.ok(MODEL_PRESETS[preset].anthropic, `${preset} missing anthropic`);
        assert.ok(MODEL_PRESETS[preset].xai, `${preset} missing xai`);
      }
    });
  });
});

describe('Reasoning Presets', () => {
  describe('getReasoningConfig()', () => {
    it('should return correct OpenAI config for each level', () => {
      assert.deepEqual(getReasoningConfig('off', 'openai'), { reasoningEffort: 'none' });
      assert.deepEqual(getReasoningConfig('low', 'openai'), { reasoningEffort: 'low' });
      assert.deepEqual(getReasoningConfig('medium', 'openai'), { reasoningEffort: 'medium' });
      assert.deepEqual(getReasoningConfig('high', 'openai'), { reasoningEffort: 'high' });
    });

    it('should return correct Anthropic config for each level', () => {
      const offConfig = getReasoningConfig('off', 'anthropic');
      assert.equal(offConfig.thinking, undefined);

      const lowConfig = getReasoningConfig('low', 'anthropic');
      assert.equal(lowConfig.thinking?.budget_tokens, 2048);

      const mediumConfig = getReasoningConfig('medium', 'anthropic');
      assert.equal(mediumConfig.thinking?.budget_tokens, 8192);

      const highConfig = getReasoningConfig('high', 'anthropic');
      assert.equal(highConfig.thinking?.budget_tokens, 32768);
    });

    it('should return correct xAI config for each level', () => {
      assert.deepEqual(getReasoningConfig('off', 'xai'), { preferReasoningModel: false });
      assert.deepEqual(getReasoningConfig('low', 'xai'), { preferReasoningModel: false });
      assert.deepEqual(getReasoningConfig('medium', 'xai'), { preferReasoningModel: true });
      assert.deepEqual(getReasoningConfig('high', 'xai'), { preferReasoningModel: true });
    });
  });

  describe('supportsReasoning()', () => {
    it('should return true for GPT-5+ models', () => {
      assert.equal(supportsReasoning('gpt-5.1'), true);
      assert.equal(supportsReasoning('gpt-5-mini'), true);
    });

    it('should return true for o-series models', () => {
      assert.equal(supportsReasoning('o1-preview'), true);
      assert.equal(supportsReasoning('o3-mini'), true);
      assert.equal(supportsReasoning('o4-mini'), true);
    });

    it('should return true for Claude models', () => {
      assert.equal(supportsReasoning('claude-sonnet-4-20250514'), true);
      assert.equal(supportsReasoning('claude-3-5-haiku'), true);
    });

    it('should return false for GPT-4 models', () => {
      assert.equal(supportsReasoning('gpt-4o'), false);
      assert.equal(supportsReasoning('gpt-4o-mini'), false);
      assert.equal(supportsReasoning('gpt-4-turbo'), false);
    });

    it('should return false for Grok models (reasoning is model-based)', () => {
      assert.equal(supportsReasoning('grok-3'), false);
      assert.equal(supportsReasoning('grok-4-0709'), false);
    });
  });

  describe('adjustXAIModelForReasoning()', () => {
    it('should swap grok-4-1-fast-reasoning to non-reasoning when preferReasoning is false', () => {
      assert.equal(
        adjustXAIModelForReasoning('grok-4-1-fast-reasoning', false),
        'grok-4-1-fast-non-reasoning',
      );
    });

    it('should swap grok-4-1-fast-non-reasoning to reasoning when preferReasoning is true', () => {
      assert.equal(
        adjustXAIModelForReasoning('grok-4-1-fast-non-reasoning', true),
        'grok-4-1-fast-reasoning',
      );
    });

    it('should swap grok-4-fast variants', () => {
      assert.equal(
        adjustXAIModelForReasoning('grok-4-fast-reasoning', false),
        'grok-4-fast-non-reasoning',
      );
      assert.equal(
        adjustXAIModelForReasoning('grok-4-fast-non-reasoning', true),
        'grok-4-fast-reasoning',
      );
    });

    it('should not change non-swappable models', () => {
      assert.equal(adjustXAIModelForReasoning('grok-3', true), 'grok-3');
      assert.equal(adjustXAIModelForReasoning('grok-4-0709', false), 'grok-4-0709');
    });
  });

  describe('REASONING_PRESETS structure', () => {
    it('should have all levels defined', () => {
      assert.ok(REASONING_PRESETS.off);
      assert.ok(REASONING_PRESETS.low);
      assert.ok(REASONING_PRESETS.medium);
      assert.ok(REASONING_PRESETS.high);
    });
  });
});

describe('Creativity Presets', () => {
  describe('CREATIVITY_PRESETS', () => {
    it('should have correct temperature values', () => {
      assert.equal(CREATIVITY_PRESETS.precise, 0);
      assert.equal(CREATIVITY_PRESETS.balanced, 0.7);
      assert.equal(CREATIVITY_PRESETS.creative, 1.0);
      assert.equal(CREATIVITY_PRESETS.wild, 1.5);
    });
  });

  describe('isCreativityLevel()', () => {
    it('should return true for valid levels', () => {
      assert.equal(isCreativityLevel('precise'), true);
      assert.equal(isCreativityLevel('balanced'), true);
      assert.equal(isCreativityLevel('creative'), true);
      assert.equal(isCreativityLevel('wild'), true);
    });

    it('should return false for invalid values', () => {
      assert.equal(isCreativityLevel('invalid'), false);
      assert.equal(isCreativityLevel(0.7), false);
      assert.equal(isCreativityLevel(null), false);
      assert.equal(isCreativityLevel(undefined), false);
    });
  });

  describe('resolveCreativity()', () => {
    it('should resolve levels to temperature values', () => {
      assert.equal(resolveCreativity('precise'), 0);
      assert.equal(resolveCreativity('balanced'), 0.7);
      assert.equal(resolveCreativity('creative'), 1.0);
      assert.equal(resolveCreativity('wild'), 1.5);
    });
  });
});

describe('Response Metadata Helpers', () => {
  describe('createEmptyUsage()', () => {
    it('should create empty usage with all zeros', () => {
      const usage = createEmptyUsage();
      assert.equal(usage.inputTokens, 0);
      assert.equal(usage.outputTokens, 0);
      assert.equal(usage.reasoningTokens, 0);
      assert.equal(usage.cachedTokens, 0);
      assert.equal(usage.totalTokens, 0);
    });
  });

  describe('createEmptyTiming()', () => {
    it('should create empty timing', () => {
      const timing = createEmptyTiming();
      assert.equal(timing.latencyMs, 0);
      assert.equal(timing.timeToFirstTokenMs, undefined);
    });
  });

  describe('createEmptyCost()', () => {
    it('should create empty cost', () => {
      const cost = createEmptyCost();
      assert.equal(cost.estimatedUsd, 0);
    });
  });
});
