/**
 * Tests for xAI embeddings API.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { cosineSimilarity, embed, embedMany, embedOne, findSimilar } from './embeddings.js';
import type { EmbeddingResponse } from './types.js';

describe('embedding functions with mocked fetch', () => {
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

  const mockEmbeddingResponse: EmbeddingResponse = {
    object: 'list',
    data: [{ object: 'embedding', index: 0, embedding: [0.1, 0.2, 0.3] }],
    model: 'grok-embedding-1',
    usage: { prompt_tokens: 5, total_tokens: 5 },
  };

  describe('embed()', () => {
    it('should make POST request to /embeddings', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockEmbeddingResponse), { status: 200 });
      });

      const result = await embed('Hello', { apiKey: 'xai-test', model: 'grok-embedding-1' });

      assert.equal(result.object, 'list');
      assert.equal(result.data.length, 1);

      const [url, options] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).endsWith('/embeddings'));
      assert.equal(options?.method, 'POST');
    });

    it('should include model and input in request', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockEmbeddingResponse), { status: 200 });
      });

      await embed('Hello', { apiKey: 'xai-test', model: 'grok-embedding-1' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.model, 'grok-embedding-1');
      assert.equal(body.input, 'Hello');
    });

    it('should accept array of strings', async () => {
      const multiResponse: EmbeddingResponse = {
        ...mockEmbeddingResponse,
        data: [
          { object: 'embedding', index: 0, embedding: [0.1, 0.2, 0.3] },
          { object: 'embedding', index: 1, embedding: [0.4, 0.5, 0.6] },
        ],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(multiResponse), { status: 200 });
      });

      const result = await embed(['Hello', 'World'], {
        apiKey: 'xai-test',
        model: 'grok-embedding-1',
      });

      assert.equal(result.data.length, 2);
    });

    it('should include optional parameters', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockEmbeddingResponse), { status: 200 });
      });

      await embed('Hello', {
        apiKey: 'xai-test',
        model: 'grok-embedding-1',
        dimensions: 256,
        encodingFormat: 'float',
      });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.dimensions, 256);
      assert.equal(body.encoding_format, 'float');
    });
  });

  describe('embedOne()', () => {
    it('should return just the embedding vector', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockEmbeddingResponse), { status: 200 });
      });

      const vector = await embedOne('Hello', { apiKey: 'xai-test', model: 'grok-embedding-1' });

      assert.deepEqual(vector, [0.1, 0.2, 0.3]);
    });
  });

  describe('embedMany()', () => {
    it('should return array of embedding vectors', async () => {
      const multiResponse: EmbeddingResponse = {
        ...mockEmbeddingResponse,
        data: [
          { object: 'embedding', index: 0, embedding: [0.1, 0.2, 0.3] },
          { object: 'embedding', index: 1, embedding: [0.4, 0.5, 0.6] },
        ],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(multiResponse), { status: 200 });
      });

      const vectors = await embedMany(['Hello', 'World'], {
        apiKey: 'xai-test',
        model: 'grok-embedding-1',
      });

      assert.equal(vectors.length, 2);
      assert.deepEqual(vectors[0], [0.1, 0.2, 0.3]);
      assert.deepEqual(vectors[1], [0.4, 0.5, 0.6]);
    });
  });
});

describe('similarity utilities', () => {
  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const a = [1, 0, 0];
      const b = [1, 0, 0];
      assert.equal(cosineSimilarity(a, b), 1);
    });

    it('should return 0 for orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      assert.equal(cosineSimilarity(a, b), 0);
    });

    it('should return -1 for opposite vectors', () => {
      const a = [1, 0, 0];
      const b = [-1, 0, 0];
      assert.equal(cosineSimilarity(a, b), -1);
    });

    it('should throw for vectors of different lengths', () => {
      const a = [1, 0, 0];
      const b = [1, 0];
      assert.throws(() => cosineSimilarity(a, b), /same length/);
    });

    it('should return 0 for zero vectors', () => {
      const a = [0, 0, 0];
      const b = [1, 2, 3];
      assert.equal(cosineSimilarity(a, b), 0);
    });
  });

  describe('findSimilar', () => {
    it('should find most similar items', () => {
      const query = [1, 0, 0];
      const corpus = [
        { embedding: [1, 0, 0], item: 'exact match' },
        { embedding: [0.9, 0.1, 0], item: 'close match' },
        { embedding: [0, 1, 0], item: 'orthogonal' },
      ];

      const results = findSimilar(query, corpus, 2);

      assert.equal(results.length, 2);
      assert.equal(results[0].item, 'exact match');
      assert.equal(results[0].score, 1);
    });

    it('should respect topK parameter', () => {
      const query = [1, 0, 0];
      const corpus = [
        { embedding: [1, 0, 0], item: 'a' },
        { embedding: [0.9, 0.1, 0], item: 'b' },
        { embedding: [0.8, 0.2, 0], item: 'c' },
      ];

      const results = findSimilar(query, corpus, 1);

      assert.equal(results.length, 1);
    });

    it('should sort by similarity descending', () => {
      const query = [1, 0, 0];
      const corpus = [
        { embedding: [0.5, 0.5, 0], item: 'low' },
        { embedding: [1, 0, 0], item: 'high' },
        { embedding: [0.8, 0.2, 0], item: 'medium' },
      ];

      const results = findSimilar(query, corpus, 3);

      assert.equal(results[0].item, 'high');
      assert.ok(results[0].score > results[1].score);
      assert.ok(results[1].score > results[2].score);
    });
  });
});
