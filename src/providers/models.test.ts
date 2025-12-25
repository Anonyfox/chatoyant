/**
 * Tests for provider models module.
 */

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ANTHROPIC_MODELS,
  getAllKnownModels,
  getModelsForProvider,
  isKnownModel,
  MODELS_BY_PROVIDER,
  OPENAI_MODELS,
  XAI_MODELS,
} from './models.js';

describe('providers/models', () => {
  describe('OPENAI_MODELS', () => {
    it('should contain GPT models', () => {
      assert.ok(OPENAI_MODELS.includes('gpt-5.2'));
      assert.ok(OPENAI_MODELS.includes('gpt-5'));
      assert.ok(OPENAI_MODELS.includes('gpt-4.1'));
      assert.ok(OPENAI_MODELS.includes('gpt-4o'));
      assert.ok(OPENAI_MODELS.includes('gpt-3.5-turbo'));
    });

    it('should contain O1 reasoning models', () => {
      assert.ok(OPENAI_MODELS.includes('o1'));
      assert.ok(OPENAI_MODELS.includes('o1-preview'));
      assert.ok(OPENAI_MODELS.includes('o1-mini'));
    });

    it('should contain O3 reasoning models', () => {
      assert.ok(OPENAI_MODELS.includes('o3'));
      assert.ok(OPENAI_MODELS.includes('o3-mini'));
      assert.ok(OPENAI_MODELS.includes('o3-pro'));
      assert.ok(OPENAI_MODELS.includes('o3-deep-research'));
    });

    it('should contain specialized models', () => {
      assert.ok(OPENAI_MODELS.includes('gpt-realtime'));
      assert.ok(OPENAI_MODELS.includes('gpt-audio'));
      assert.ok(OPENAI_MODELS.includes('gpt-image-1'));
    });

    it('should contain ChatGPT models', () => {
      assert.ok(OPENAI_MODELS.includes('chatgpt-4o-latest'));
      assert.ok(OPENAI_MODELS.includes('chatgpt-image-latest'));
    });

    it('should contain open-source models', () => {
      assert.ok(OPENAI_MODELS.includes('gpt-oss-120b'));
      assert.ok(OPENAI_MODELS.includes('gpt-oss-20b'));
    });
  });

  describe('ANTHROPIC_MODELS', () => {
    it('should contain Claude 4 models', () => {
      assert.ok(ANTHROPIC_MODELS.includes('claude-opus-4'));
      assert.ok(ANTHROPIC_MODELS.includes('claude-sonnet-4'));
      assert.ok(ANTHROPIC_MODELS.includes('claude-opus-4.5'));
      assert.ok(ANTHROPIC_MODELS.includes('claude-haiku-4.5'));
    });

    it('should contain Claude 3.5 models', () => {
      assert.ok(ANTHROPIC_MODELS.includes('claude-3-5-sonnet-latest'));
      assert.ok(ANTHROPIC_MODELS.includes('claude-3-5-sonnet-20241022'));
      assert.ok(ANTHROPIC_MODELS.includes('claude-3-5-haiku-latest'));
    });

    it('should contain Claude 3 models', () => {
      assert.ok(ANTHROPIC_MODELS.includes('claude-3-opus-latest'));
      assert.ok(ANTHROPIC_MODELS.includes('claude-3-sonnet-20240229'));
      assert.ok(ANTHROPIC_MODELS.includes('claude-3-haiku-20240307'));
    });

    it('should contain legacy Claude 2 models', () => {
      assert.ok(ANTHROPIC_MODELS.includes('claude-2.1'));
      assert.ok(ANTHROPIC_MODELS.includes('claude-2.0'));
      assert.ok(ANTHROPIC_MODELS.includes('claude-instant-1.2'));
    });
  });

  describe('XAI_MODELS', () => {
    it('should contain Grok 4 models', () => {
      assert.ok(XAI_MODELS.includes('grok-4'));
      assert.ok(XAI_MODELS.includes('grok-4-fast-reasoning'));
      assert.ok(XAI_MODELS.includes('grok-4-fast-non-reasoning'));
    });

    it('should contain Grok 3 models', () => {
      assert.ok(XAI_MODELS.includes('grok-3'));
      assert.ok(XAI_MODELS.includes('grok-3-mini'));
    });

    it('should contain Grok 2 models', () => {
      assert.ok(XAI_MODELS.includes('grok-2'));
      assert.ok(XAI_MODELS.includes('grok-2-vision-1212'));
      assert.ok(XAI_MODELS.includes('grok-2-image-1212'));
    });

    it('should contain specialized Grok models', () => {
      assert.ok(XAI_MODELS.includes('grok-code-fast-1'));
    });
  });

  describe('MODELS_BY_PROVIDER', () => {
    it('should map providers to their models', () => {
      assert.deepEqual(MODELS_BY_PROVIDER.openai, OPENAI_MODELS);
      assert.deepEqual(MODELS_BY_PROVIDER.anthropic, ANTHROPIC_MODELS);
      assert.deepEqual(MODELS_BY_PROVIDER.xai, XAI_MODELS);
    });

    it('should contain all three providers', () => {
      assert.ok('openai' in MODELS_BY_PROVIDER);
      assert.ok('anthropic' in MODELS_BY_PROVIDER);
      assert.ok('xai' in MODELS_BY_PROVIDER);
    });
  });

  describe('getModelsForProvider', () => {
    it('should return OpenAI models', () => {
      const models = getModelsForProvider('openai');
      assert.deepEqual(models, OPENAI_MODELS);
    });

    it('should return Anthropic models', () => {
      const models = getModelsForProvider('anthropic');
      assert.deepEqual(models, ANTHROPIC_MODELS);
    });

    it('should return xAI models', () => {
      const models = getModelsForProvider('xai');
      assert.deepEqual(models, XAI_MODELS);
    });
  });

  describe('isKnownModel', () => {
    it('should return true for known OpenAI models', () => {
      assert.equal(isKnownModel('gpt-5.2'), true);
      assert.equal(isKnownModel('o1-preview'), true);
      assert.equal(isKnownModel('o3-mini'), true);
    });

    it('should return true for known Anthropic models', () => {
      assert.equal(isKnownModel('claude-opus-4'), true);
      assert.equal(isKnownModel('claude-3-5-sonnet-latest'), true);
    });

    it('should return true for known xAI models', () => {
      assert.equal(isKnownModel('grok-4'), true);
      assert.equal(isKnownModel('grok-3-mini'), true);
    });

    it('should return false for unknown models', () => {
      assert.equal(isKnownModel('unknown-model'), false);
      assert.equal(isKnownModel('llama-3.1'), false);
      assert.equal(isKnownModel('mistral-large'), false);
    });

    it('should be case-insensitive', () => {
      assert.equal(isKnownModel('GPT-5.2'), true);
      assert.equal(isKnownModel('CLAUDE-OPUS-4'), true);
      assert.equal(isKnownModel('GROK-4'), true);
    });
  });

  describe('getAllKnownModels', () => {
    it('should return all models from all providers', () => {
      const all = getAllKnownModels();
      const expectedLength = OPENAI_MODELS.length + ANTHROPIC_MODELS.length + XAI_MODELS.length;
      assert.equal(all.length, expectedLength);
    });

    it('should include models from each provider', () => {
      const all = getAllKnownModels();
      // OpenAI
      assert.ok(all.includes('gpt-5.2'));
      assert.ok(all.includes('o1-preview'));
      // Anthropic
      assert.ok(all.includes('claude-opus-4'));
      // xAI
      assert.ok(all.includes('grok-4'));
    });

    it('should return a readonly array', () => {
      const all = getAllKnownModels();
      assert.ok(Array.isArray(all));
    });
  });

  describe('model count sanity checks', () => {
    it('should have a reasonable number of OpenAI models', () => {
      assert.ok(OPENAI_MODELS.length >= 20, 'Should have at least 20 OpenAI models');
      assert.ok(OPENAI_MODELS.length <= 100, 'Should have at most 100 OpenAI models');
    });

    it('should have a reasonable number of Anthropic models', () => {
      assert.ok(ANTHROPIC_MODELS.length >= 10, 'Should have at least 10 Anthropic models');
      assert.ok(ANTHROPIC_MODELS.length <= 50, 'Should have at most 50 Anthropic models');
    });

    it('should have a reasonable number of xAI models', () => {
      assert.ok(XAI_MODELS.length >= 5, 'Should have at least 5 xAI models');
      assert.ok(XAI_MODELS.length <= 50, 'Should have at most 50 xAI models');
    });
  });
});
