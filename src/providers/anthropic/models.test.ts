/**
 * Tests for Anthropic models API.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { getModel, listAllModels, listModelIds, listModels, modelExists } from './models.js';
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

  const mockModel: Model = {
    type: 'model',
    id: 'claude-sonnet-4-20250514',
    display_name: 'Claude Sonnet 4',
    created_at: '2025-05-14T00:00:00Z',
  };

  const mockModelsResponse: ModelsResponse = {
    data: [
      {
        type: 'model',
        id: 'claude-sonnet-4-20250514',
        display_name: 'Claude Sonnet 4',
        created_at: '2025-05-14T00:00:00Z',
      },
      {
        type: 'model',
        id: 'claude-3-5-haiku-20241022',
        display_name: 'Claude 3.5 Haiku',
        created_at: '2024-10-22T00:00:00Z',
      },
      {
        type: 'model',
        id: 'claude-3-5-sonnet-20241022',
        display_name: 'Claude 3.5 Sonnet',
        created_at: '2024-10-22T00:00:00Z',
      },
    ],
    has_more: false,
    first_id: 'claude-sonnet-4-20250514',
    last_id: 'claude-3-5-sonnet-20241022',
  };

  describe('listModels()', () => {
    it('should make GET request to /models', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockModelsResponse), { status: 200 });
      });

      const result = await listModels({ apiKey: 'sk-ant-test' });

      assert.equal(result.data.length, 3);
      assert.equal(result.has_more, false);

      const [url, options] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).endsWith('/models'));
      assert.equal(options?.method, 'GET');
    });

    it('should return all model data', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockModelsResponse), { status: 200 });
      });

      const result = await listModels({ apiKey: 'sk-ant-test' });

      assert.equal(result.data[0].id, 'claude-sonnet-4-20250514');
      assert.equal(result.data[0].display_name, 'Claude Sonnet 4');
      assert.equal(result.data[0].type, 'model');
      assert.equal(result.data[1].id, 'claude-3-5-haiku-20241022');
      assert.equal(result.data[2].id, 'claude-3-5-sonnet-20241022');
    });

    it('should include pagination params in query string', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockModelsResponse), { status: 200 });
      });

      await listModels(
        { apiKey: 'sk-ant-test' },
        { limit: 5, after_id: 'claude-sonnet-4-20250514' },
      );

      const [url] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).includes('limit=5'));
      assert.ok((url as string).includes('after_id=claude-sonnet-4-20250514'));
    });

    it('should include before_id param in query string', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockModelsResponse), { status: 200 });
      });

      await listModels({ apiKey: 'sk-ant-test' }, { before_id: 'claude-3-5-haiku-20241022' });

      const [url] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).includes('before_id=claude-3-5-haiku-20241022'));
    });

    it('should not append query string when no params given', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockModelsResponse), { status: 200 });
      });

      await listModels({ apiKey: 'sk-ant-test' });

      const [url] = mockFetch.mock.calls[0].arguments;
      assert.ok(!(url as string).includes('?'));
    });
  });

  describe('getModel()', () => {
    it('should make GET request to /models/{model_id}', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockModel), { status: 200 });
      });

      const result = await getModel('claude-sonnet-4-20250514', { apiKey: 'sk-ant-test' });

      assert.equal(result.id, 'claude-sonnet-4-20250514');
      assert.equal(result.display_name, 'Claude Sonnet 4');

      const [url] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).endsWith('/models/claude-sonnet-4-20250514'));
    });

    it('should encode model ID in URL', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockModel), { status: 200 });
      });

      await getModel('claude:custom/variant', { apiKey: 'sk-ant-test' });

      const [url] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).includes(encodeURIComponent('claude:custom/variant')));
    });
  });

  describe('listAllModels()', () => {
    it('should return all models when single page', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockModelsResponse), { status: 200 });
      });

      const models = await listAllModels({ apiKey: 'sk-ant-test' });

      assert.equal(models.length, 3);
      assert.equal(models[0].id, 'claude-sonnet-4-20250514');
      assert.equal(models[2].id, 'claude-3-5-sonnet-20241022');
    });

    it('should auto-paginate through multiple pages', async () => {
      const page1: ModelsResponse = {
        data: [mockModelsResponse.data[0]],
        has_more: true,
        first_id: 'claude-sonnet-4-20250514',
        last_id: 'claude-sonnet-4-20250514',
      };

      const page2: ModelsResponse = {
        data: [mockModelsResponse.data[1], mockModelsResponse.data[2]],
        has_more: false,
        first_id: 'claude-3-5-haiku-20241022',
        last_id: 'claude-3-5-sonnet-20241022',
      };

      let callCount = 0;
      mockFetch.mock.mockImplementation(async () => {
        const response = callCount === 0 ? page1 : page2;
        callCount++;
        return new Response(JSON.stringify(response), { status: 200 });
      });

      const models = await listAllModels({ apiKey: 'sk-ant-test' });

      assert.equal(models.length, 3);
      assert.equal(mockFetch.mock.callCount(), 2);

      const [secondUrl] = mockFetch.mock.calls[1].arguments;
      assert.ok((secondUrl as string).includes('after_id=claude-sonnet-4-20250514'));
    });
  });

  describe('listModelIds()', () => {
    it('should return just model IDs', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockModelsResponse), { status: 200 });
      });

      const ids = await listModelIds({ apiKey: 'sk-ant-test' });

      assert.deepEqual(ids, [
        'claude-sonnet-4-20250514',
        'claude-3-5-haiku-20241022',
        'claude-3-5-sonnet-20241022',
      ]);
    });
  });

  describe('modelExists()', () => {
    it('should return true when model exists', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockModel), { status: 200 });
      });

      const exists = await modelExists('claude-sonnet-4-20250514', { apiKey: 'sk-ant-test' });

      assert.equal(exists, true);
    });

    it('should return false when model does not exist', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            type: 'error',
            error: { type: 'not_found_error', message: 'Model not found' },
          }),
          { status: 404 },
        );
      });

      const exists = await modelExists('nonexistent-model', { apiKey: 'sk-ant-test' });

      assert.equal(exists, false);
    });

    it('should return false on any error', async () => {
      mockFetch.mock.mockImplementation(async () => {
        throw new Error('Network error');
      });

      const exists = await modelExists('claude-sonnet-4-20250514', { apiKey: 'sk-ant-test' });

      assert.equal(exists, false);
    });
  });
});
