/**
 * Tests for OpenAI models API.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { getModel, listModelIds, listModels, modelExists } from './models.js';
import type { Model, ModelsResponse } from './types.js';

describe('models API with mocked fetch', () => {
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

  const mockModelsResponse: ModelsResponse = {
    object: 'list',
    data: [
      { id: 'gpt-4o', object: 'model', created: 1234567890, owned_by: 'openai' },
      { id: 'gpt-4o-mini', object: 'model', created: 1234567891, owned_by: 'openai' },
      { id: 'text-embedding-3-small', object: 'model', created: 1234567892, owned_by: 'openai' },
    ],
  };

  const mockModel: Model = {
    id: 'gpt-4o',
    object: 'model',
    created: 1234567890,
    owned_by: 'openai',
  };

  describe('listModels()', () => {
    it('should make GET request to /models', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockModelsResponse), { status: 200 });
      });

      const result = await listModels({ apiKey: 'sk-test' });

      assert.equal(result.object, 'list');
      assert.equal(result.data.length, 3);

      const [url, options] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).endsWith('/models'));
      assert.equal(options?.method, 'GET');
    });

    it('should return all model data', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockModelsResponse), { status: 200 });
      });

      const result = await listModels({ apiKey: 'sk-test' });

      assert.equal(result.data[0].id, 'gpt-4o');
      assert.equal(result.data[1].id, 'gpt-4o-mini');
      assert.equal(result.data[2].id, 'text-embedding-3-small');
    });
  });

  describe('getModel()', () => {
    it('should make GET request to /models/{model_id}', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockModel), { status: 200 });
      });

      const result = await getModel('gpt-4o', { apiKey: 'sk-test' });

      assert.equal(result.id, 'gpt-4o');
      assert.equal(result.owned_by, 'openai');

      const [url] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).endsWith('/models/gpt-4o'));
    });

    it('should encode model ID in URL', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockModel), { status: 200 });
      });

      await getModel('ft:gpt-4o:my-org:custom', { apiKey: 'sk-test' });

      const [url] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).includes(encodeURIComponent('ft:gpt-4o:my-org:custom')));
    });
  });

  describe('listModelIds()', () => {
    it('should return just model IDs', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockModelsResponse), { status: 200 });
      });

      const ids = await listModelIds({ apiKey: 'sk-test' });

      assert.deepEqual(ids, ['gpt-4o', 'gpt-4o-mini', 'text-embedding-3-small']);
    });
  });

  describe('modelExists()', () => {
    it('should return true when model exists', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockModel), { status: 200 });
      });

      const exists = await modelExists('gpt-4o', { apiKey: 'sk-test' });

      assert.equal(exists, true);
    });

    it('should return false when model does not exist', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(
          JSON.stringify({ error: { message: 'Not found', type: 'not_found_error' } }),
          { status: 404 },
        );
      });

      const exists = await modelExists('nonexistent-model', { apiKey: 'sk-test' });

      assert.equal(exists, false);
    });

    it('should return false on any error', async () => {
      mockFetch.mock.mockImplementation(async () => {
        throw new Error('Network error');
      });

      const exists = await modelExists('gpt-4o', { apiKey: 'sk-test' });

      assert.equal(exists, false);
    });
  });
});
