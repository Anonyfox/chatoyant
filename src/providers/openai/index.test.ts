/**
 * Tests for OpenAI provider module exports.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as openai from './index.js';

describe('OpenAI provider module', () => {
  describe('client exports', () => {
    it('should export OpenAIClient class', () => {
      assert.ok(openai.OpenAIClient);
      assert.equal(typeof openai.OpenAIClient, 'function');
    });

    it('should export createOpenAIClient function', () => {
      assert.equal(typeof openai.createOpenAIClient, 'function');
    });
  });

  describe('chat exports', () => {
    it('should export chat function', () => {
      assert.equal(typeof openai.chat, 'function');
    });

    it('should export chatSimple function', () => {
      assert.equal(typeof openai.chatSimple, 'function');
    });

    it('should export chatWithTools function', () => {
      assert.equal(typeof openai.chatWithTools, 'function');
    });

    it('should export chatStructured function', () => {
      assert.equal(typeof openai.chatStructured, 'function');
    });
  });

  describe('streaming exports', () => {
    it('should export chatStream function', () => {
      assert.equal(typeof openai.chatStream, 'function');
    });

    it('should export chatStreamContent function', () => {
      assert.equal(typeof openai.chatStreamContent, 'function');
    });

    it('should export chatStreamAccumulate function', () => {
      assert.equal(typeof openai.chatStreamAccumulate, 'function');
    });

    it('should export chatStreamReadable function', () => {
      assert.equal(typeof openai.chatStreamReadable, 'function');
    });

    it('should export chatStreamToWritable function', () => {
      assert.equal(typeof openai.chatStreamToWritable, 'function');
    });
  });

  describe('embedding exports', () => {
    it('should export embed function', () => {
      assert.equal(typeof openai.embed, 'function');
    });

    it('should export embedOne function', () => {
      assert.equal(typeof openai.embedOne, 'function');
    });

    it('should export embedMany function', () => {
      assert.equal(typeof openai.embedMany, 'function');
    });

    it('should export cosineSimilarity function', () => {
      assert.equal(typeof openai.cosineSimilarity, 'function');
    });

    it('should export findSimilar function', () => {
      assert.equal(typeof openai.findSimilar, 'function');
    });
  });

  describe('image exports', () => {
    it('should export generateImage function', () => {
      assert.equal(typeof openai.generateImage, 'function');
    });

    it('should export generateImageUrl function', () => {
      assert.equal(typeof openai.generateImageUrl, 'function');
    });

    it('should export generateImageBase64 function', () => {
      assert.equal(typeof openai.generateImageBase64, 'function');
    });

    it('should export generateImages function', () => {
      assert.equal(typeof openai.generateImages, 'function');
    });

    it('should export generateImageWithPrompt function', () => {
      assert.equal(typeof openai.generateImageWithPrompt, 'function');
    });
  });

  describe('model exports', () => {
    it('should export listModels function', () => {
      assert.equal(typeof openai.listModels, 'function');
    });

    it('should export getModel function', () => {
      assert.equal(typeof openai.getModel, 'function');
    });

    it('should export listModelIds function', () => {
      assert.equal(typeof openai.listModelIds, 'function');
    });

    it('should export modelExists function', () => {
      assert.equal(typeof openai.modelExists, 'function');
    });
  });

  describe('request exports', () => {
    it('should export BASE_URL constant', () => {
      assert.equal(openai.BASE_URL, 'https://api.openai.com/v1');
    });

    it('should export DEFAULT_TIMEOUT constant', () => {
      assert.equal(openai.DEFAULT_TIMEOUT, 60_000);
    });

    it('should export request function', () => {
      assert.equal(typeof openai.request, 'function');
    });

    it('should export requestRaw function', () => {
      assert.equal(typeof openai.requestRaw, 'function');
    });

    it('should export requestGet function', () => {
      assert.equal(typeof openai.requestGet, 'function');
    });

    it('should export buildHeaders function', () => {
      assert.equal(typeof openai.buildHeaders, 'function');
    });

    it('should export buildUrl function', () => {
      assert.equal(typeof openai.buildUrl, 'function');
    });
  });

  describe('stream exports', () => {
    it('should export parseSSEStream function', () => {
      assert.equal(typeof openai.parseSSEStream, 'function');
    });

    it('should export createAccumulator function', () => {
      assert.equal(typeof openai.createAccumulator, 'function');
    });

    it('should export updateAccumulator function', () => {
      assert.equal(typeof openai.updateAccumulator, 'function');
    });

    it('should export accumulatorToToolCalls function', () => {
      assert.equal(typeof openai.accumulatorToToolCalls, 'function');
    });

    it('should export streamWithAccumulator function', () => {
      assert.equal(typeof openai.streamWithAccumulator, 'function');
    });
  });

  describe('error exports', () => {
    it('should export OpenAIError class', () => {
      assert.ok(openai.OpenAIError);
      assert.equal(typeof openai.OpenAIError, 'function');
    });

    it('should export isOpenAIError function', () => {
      assert.equal(typeof openai.isOpenAIError, 'function');
    });
  });

  describe('client instantiation', () => {
    it('should create client with minimal config', () => {
      const client = openai.createOpenAIClient({
        apiKey: 'sk-test',
      });

      assert.ok(client instanceof openai.OpenAIClient);
    });

    it('should create client with full config', () => {
      const client = openai.createOpenAIClient({
        apiKey: 'sk-test',
        baseUrl: 'https://custom.api.com',
        timeout: 30000,
        defaultModel: 'gpt-4',
        defaultEmbeddingModel: 'text-embedding-3-small',
        defaultImageModel: 'dall-e-3',
        headers: { 'X-Custom': 'value' },
      });

      assert.ok(client instanceof openai.OpenAIClient);
    });

    it('should have all expected methods', () => {
      const client = openai.createOpenAIClient({ apiKey: 'test' });

      // Chat methods
      assert.equal(typeof client.chat, 'function');
      assert.equal(typeof client.chatSimple, 'function');
      assert.equal(typeof client.chatWithTools, 'function');
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
      assert.equal(typeof client.generateImages, 'function');

      // Model methods
      assert.equal(typeof client.listModels, 'function');
      assert.equal(typeof client.getModel, 'function');
      assert.equal(typeof client.listModelIds, 'function');
      assert.equal(typeof client.modelExists, 'function');
    });
  });
});
