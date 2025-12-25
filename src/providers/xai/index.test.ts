/**
 * Tests for xAI provider module exports.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as xai from './index.js';

describe('xAI provider module', () => {
  describe('client exports', () => {
    it('should export XAIClient class', () => {
      assert.ok(xai.XAIClient);
      assert.equal(typeof xai.XAIClient, 'function');
    });

    it('should export createXAIClient function', () => {
      assert.equal(typeof xai.createXAIClient, 'function');
    });
  });

  describe('chat exports', () => {
    it('should export chat function', () => {
      assert.equal(typeof xai.chat, 'function');
    });

    it('should export chatSimple function', () => {
      assert.equal(typeof xai.chatSimple, 'function');
    });

    it('should export chatWithTools function', () => {
      assert.equal(typeof xai.chatWithTools, 'function');
    });

    it('should export chatWithWebSearch function (xAI-specific)', () => {
      assert.equal(typeof xai.chatWithWebSearch, 'function');
    });

    it('should export chatStructured function', () => {
      assert.equal(typeof xai.chatStructured, 'function');
    });
  });

  describe('streaming exports', () => {
    it('should export chatStream function', () => {
      assert.equal(typeof xai.chatStream, 'function');
    });

    it('should export chatStreamContent function', () => {
      assert.equal(typeof xai.chatStreamContent, 'function');
    });

    it('should export chatStreamAccumulate function', () => {
      assert.equal(typeof xai.chatStreamAccumulate, 'function');
    });

    it('should export chatStreamReadable function', () => {
      assert.equal(typeof xai.chatStreamReadable, 'function');
    });
  });

  describe('embedding exports', () => {
    it('should export embed function', () => {
      assert.equal(typeof xai.embed, 'function');
    });

    it('should export embedOne function', () => {
      assert.equal(typeof xai.embedOne, 'function');
    });

    it('should export embedMany function', () => {
      assert.equal(typeof xai.embedMany, 'function');
    });

    it('should export cosineSimilarity function', () => {
      assert.equal(typeof xai.cosineSimilarity, 'function');
    });

    it('should export findSimilar function', () => {
      assert.equal(typeof xai.findSimilar, 'function');
    });
  });

  describe('image generation exports', () => {
    it('should export generateImage function', () => {
      assert.equal(typeof xai.generateImage, 'function');
    });

    it('should export generateImageUrl function', () => {
      assert.equal(typeof xai.generateImageUrl, 'function');
    });

    it('should export generateImageBase64 function', () => {
      assert.equal(typeof xai.generateImageBase64, 'function');
    });

    it('should export generateImages function', () => {
      assert.equal(typeof xai.generateImages, 'function');
    });
  });

  describe('model exports', () => {
    it('should export listModels function', () => {
      assert.equal(typeof xai.listModels, 'function');
    });

    it('should export getModel function', () => {
      assert.equal(typeof xai.getModel, 'function');
    });

    it('should export modelExists function', () => {
      assert.equal(typeof xai.modelExists, 'function');
    });

    it('should export listLanguageModels function (xAI-specific)', () => {
      assert.equal(typeof xai.listLanguageModels, 'function');
    });

    it('should export getLanguageModel function (xAI-specific)', () => {
      assert.equal(typeof xai.getLanguageModel, 'function');
    });

    it('should export listImageGenerationModels function (xAI-specific)', () => {
      assert.equal(typeof xai.listImageGenerationModels, 'function');
    });

    it('should export getImageGenerationModel function (xAI-specific)', () => {
      assert.equal(typeof xai.getImageGenerationModel, 'function');
    });
  });

  describe('request exports', () => {
    it('should export BASE_URL constant', () => {
      assert.equal(xai.BASE_URL, 'https://api.x.ai/v1');
    });

    it('should export DEFAULT_TIMEOUT constant', () => {
      assert.equal(xai.DEFAULT_TIMEOUT, 60_000);
    });

    it('should export request function', () => {
      assert.equal(typeof xai.request, 'function');
    });

    it('should export requestRaw function', () => {
      assert.equal(typeof xai.requestRaw, 'function');
    });

    it('should export requestGet function', () => {
      assert.equal(typeof xai.requestGet, 'function');
    });

    it('should export buildHeaders function', () => {
      assert.equal(typeof xai.buildHeaders, 'function');
    });

    it('should export buildUrl function', () => {
      assert.equal(typeof xai.buildUrl, 'function');
    });
  });

  describe('stream exports', () => {
    it('should export parseSSEStream function', () => {
      assert.equal(typeof xai.parseSSEStream, 'function');
    });

    it('should export createAccumulator function', () => {
      assert.equal(typeof xai.createAccumulator, 'function');
    });

    it('should export updateAccumulator function', () => {
      assert.equal(typeof xai.updateAccumulator, 'function');
    });

    it('should export accumulatorToToolCalls function', () => {
      assert.equal(typeof xai.accumulatorToToolCalls, 'function');
    });
  });

  describe('error exports', () => {
    it('should export XAIError class', () => {
      assert.ok(xai.XAIError);
      assert.equal(typeof xai.XAIError, 'function');
    });

    it('should export isXAIError function', () => {
      assert.equal(typeof xai.isXAIError, 'function');
    });
  });

  describe('client instantiation', () => {
    it('should create client with minimal config', () => {
      const client = xai.createXAIClient({ apiKey: 'xai-test' });
      assert.ok(client instanceof xai.XAIClient);
    });

    it('should have all expected methods', () => {
      const client = xai.createXAIClient({ apiKey: 'test' });

      // Chat methods
      assert.equal(typeof client.chat, 'function');
      assert.equal(typeof client.chatSimple, 'function');
      assert.equal(typeof client.chatWithTools, 'function');
      assert.equal(typeof client.chatWithWebSearch, 'function');
      assert.equal(typeof client.chatStructured, 'function');

      // Streaming methods
      assert.equal(typeof client.stream, 'function');
      assert.equal(typeof client.streamContent, 'function');
      assert.equal(typeof client.streamAccumulate, 'function');
      assert.equal(typeof client.streamReadable, 'function');

      // Embedding methods
      assert.equal(typeof client.embed, 'function');
      assert.equal(typeof client.embedOne, 'function');
      assert.equal(typeof client.embedMany, 'function');

      // Image methods
      assert.equal(typeof client.generateImage, 'function');
      assert.equal(typeof client.generateImageUrl, 'function');
      assert.equal(typeof client.generateImageBase64, 'function');

      // Model methods
      assert.equal(typeof client.listModels, 'function');
      assert.equal(typeof client.getModel, 'function');
      assert.equal(typeof client.modelExists, 'function');
      assert.equal(typeof client.listLanguageModels, 'function');
      assert.equal(typeof client.getLanguageModel, 'function');
      assert.equal(typeof client.listImageGenerationModels, 'function');
      assert.equal(typeof client.getImageGenerationModel, 'function');

      // Utility methods
      assert.equal(typeof client.cosineSimilarity, 'function');
      assert.equal(typeof client.findSimilar, 'function');
    });
  });
});
