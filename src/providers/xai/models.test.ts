/**
 * Tests for xAI models API.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import {
  getImageGenerationModel,
  getLanguageModel,
  getModel,
  listImageGenerationModels,
  listLanguageModels,
  listModels,
  modelExists,
} from './models.js';
import type {
  ImageGenerationModel,
  ImageGenerationModelsResponse,
  LanguageModel,
  LanguageModelsResponse,
  Model,
  ModelsResponse,
} from './types.js';

describe('models functions with mocked fetch', () => {
  let originalFetch: typeof globalThis.fetch;
  let mockFetch: ReturnType<typeof mock.fn<typeof fetch>>;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockFetch = mock.fn<typeof fetch>();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const mockModel: Model = {
    id: 'grok-3',
    object: 'model',
    created: 1234567890,
    owned_by: 'xai',
  };

  const mockModelsResponse: ModelsResponse = {
    object: 'list',
    data: [mockModel],
  };

  const mockLanguageModel: LanguageModel = {
    id: 'grok-3',
    fingerprint: 'abc123',
    aliases: ['grok-3-latest'],
    context_length: 131072,
    input_modalities: ['text'],
    output_modalities: ['text'],
    pricing: { input: 3.0, output: 15.0 },
  };

  const mockLanguageModelsResponse: LanguageModelsResponse = {
    models: [mockLanguageModel],
  };

  const mockImageModel: ImageGenerationModel = {
    id: 'grok-2-image-1212',
    fingerprint: 'def456',
    aliases: ['grok-image-latest'],
    pricing: { per_image: 0.07 },
  };

  const mockImageModelsResponse: ImageGenerationModelsResponse = {
    models: [mockImageModel],
  };

  describe('listModels()', () => {
    it('should make GET request to /models', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockModelsResponse), { status: 200 });
      });

      const result = await listModels({ apiKey: 'xai-test' });

      assert.equal(result.object, 'list');
      assert.equal(result.data.length, 1);

      const [url, options] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).endsWith('/models'));
      assert.equal(options?.method, 'GET');
    });
  });

  describe('getModel()', () => {
    it('should make GET request to /models/{id}', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockModel), { status: 200 });
      });

      const result = await getModel('grok-3', { apiKey: 'xai-test' });

      assert.equal(result.id, 'grok-3');

      const [url] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).endsWith('/models/grok-3'));
    });
  });

  describe('modelExists()', () => {
    it('should return true if model exists', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockModel), { status: 200 });
      });

      const exists = await modelExists('grok-3', { apiKey: 'xai-test' });

      assert.equal(exists, true);
    });

    it('should return false if model does not exist', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(
          JSON.stringify({ error: { message: 'Not found', type: 'not_found_error' } }),
          { status: 404 },
        );
      });

      const exists = await modelExists('nonexistent', { apiKey: 'xai-test' });

      assert.equal(exists, false);
    });
  });

  describe('listLanguageModels()', () => {
    it('should make GET request to /language-models', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockLanguageModelsResponse), { status: 200 });
      });

      const result = await listLanguageModels({ apiKey: 'xai-test' });

      assert.equal(result.models.length, 1);
      assert.equal(result.models[0].id, 'grok-3');
      assert.equal(result.models[0].context_length, 131072);

      const [url] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).endsWith('/language-models'));
    });
  });

  describe('getLanguageModel()', () => {
    it('should make GET request to /language-models/{id}', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockLanguageModel), { status: 200 });
      });

      const result = await getLanguageModel('grok-3', { apiKey: 'xai-test' });

      assert.equal(result.id, 'grok-3');
      assert.equal(result.pricing.input, 3.0);

      const [url] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).endsWith('/language-models/grok-3'));
    });
  });

  describe('listImageGenerationModels()', () => {
    it('should make GET request to /image-generation-models', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockImageModelsResponse), { status: 200 });
      });

      const result = await listImageGenerationModels({ apiKey: 'xai-test' });

      assert.equal(result.models.length, 1);
      assert.equal(result.models[0].id, 'grok-2-image-1212');

      const [url] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).endsWith('/image-generation-models'));
    });
  });

  describe('getImageGenerationModel()', () => {
    it('should make GET request to /image-generation-models/{id}', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockImageModel), { status: 200 });
      });

      const result = await getImageGenerationModel('grok-2-image-1212', { apiKey: 'xai-test' });

      assert.equal(result.id, 'grok-2-image-1212');
      assert.equal(result.pricing.per_image, 0.07);

      const [url] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).endsWith('/image-generation-models/grok-2-image-1212'));
    });
  });
});
