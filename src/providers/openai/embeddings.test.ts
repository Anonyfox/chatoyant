/**
 * Tests for OpenAI embeddings utilities.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { cosineSimilarity, embed, embedMany, embedOne, findSimilar } from './embeddings.js';
import type { EmbeddingResponse } from './types.js';

describe('embeddings API with mocked fetch', () => {
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
    model: 'text-embedding-3-small',
    usage: { prompt_tokens: 5, total_tokens: 5 },
  };

  describe('embed()', () => {
    it('should make POST request to /embeddings', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockEmbeddingResponse), { status: 200 });
      });

      const result = await embed('Hello', { apiKey: 'sk-test', model: 'text-embedding-3-small' });

      assert.equal(result.data.length, 1);
      assert.deepEqual(result.data[0].embedding, [0.1, 0.2, 0.3]);

      const [url, options] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).endsWith('/embeddings'));
      assert.equal(options?.method, 'POST');
    });

    it('should include model and input in request', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockEmbeddingResponse), { status: 200 });
      });

      await embed('Hello world', { apiKey: 'sk-test', model: 'text-embedding-3-small' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.model, 'text-embedding-3-small');
      assert.equal(body.input, 'Hello world');
    });

    it('should handle array input', async () => {
      const multiResponse: EmbeddingResponse = {
        ...mockEmbeddingResponse,
        data: [
          { object: 'embedding', index: 0, embedding: [0.1] },
          { object: 'embedding', index: 1, embedding: [0.2] },
        ],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(multiResponse), { status: 200 });
      });

      const result = await embed(['Hello', 'World'], {
        apiKey: 'sk-test',
        model: 'text-embedding-3-small',
      });

      assert.equal(result.data.length, 2);
    });

    it('should include dimensions when provided', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockEmbeddingResponse), { status: 200 });
      });

      await embed('Hello', { apiKey: 'sk-test', model: 'text-embedding-3-small', dimensions: 256 });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.dimensions, 256);
    });

    it('should include encoding_format when provided', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockEmbeddingResponse), { status: 200 });
      });

      await embed('Hello', {
        apiKey: 'sk-test',
        model: 'text-embedding-3-small',
        encodingFormat: 'base64',
      });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.encoding_format, 'base64');
    });
  });

  describe('embedOne()', () => {
    it('should return just the embedding vector', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockEmbeddingResponse), { status: 200 });
      });

      const vector = await embedOne('Hello', {
        apiKey: 'sk-test',
        model: 'text-embedding-3-small',
      });

      assert.deepEqual(vector, [0.1, 0.2, 0.3]);
    });
  });

  describe('embedMany()', () => {
    it('should return vectors in correct order', async () => {
      const multiResponse: EmbeddingResponse = {
        ...mockEmbeddingResponse,
        data: [
          { object: 'embedding', index: 1, embedding: [0.2] }, // out of order
          { object: 'embedding', index: 0, embedding: [0.1] },
        ],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(multiResponse), { status: 200 });
      });

      const vectors = await embedMany(['Hello', 'World'], {
        apiKey: 'sk-test',
        model: 'text-embedding-3-small',
      });

      assert.equal(vectors.length, 2);
      assert.deepEqual(vectors[0], [0.1]); // Should be reordered by index
      assert.deepEqual(vectors[1], [0.2]);
    });
  });
});

describe('embeddings utilities', () => {
  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3];
      const similarity = cosineSimilarity(a, b);
      assert.ok(Math.abs(similarity - 1) < 0.0001);
    });

    it('should return -1 for opposite vectors', () => {
      const a = [1, 0];
      const b = [-1, 0];
      const similarity = cosineSimilarity(a, b);
      assert.ok(Math.abs(similarity - -1) < 0.0001);
    });

    it('should return 0 for orthogonal vectors', () => {
      const a = [1, 0];
      const b = [0, 1];
      const similarity = cosineSimilarity(a, b);
      assert.ok(Math.abs(similarity) < 0.0001);
    });

    it('should handle normalized vectors', () => {
      const a = [0.6, 0.8]; // normalized
      const b = [0.8, 0.6]; // normalized
      const similarity = cosineSimilarity(a, b);
      assert.ok(similarity > 0.9); // Should be close but not identical
    });

    it('should throw for different length vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2];
      assert.throws(() => cosineSimilarity(a, b), /same length/);
    });

    it('should return 0 for zero vectors', () => {
      const a = [0, 0, 0];
      const b = [1, 2, 3];
      const similarity = cosineSimilarity(a, b);
      assert.equal(similarity, 0);
    });

    it('should handle large vectors', () => {
      const a = new Array(1536).fill(0.1);
      const b = new Array(1536).fill(0.1);
      const similarity = cosineSimilarity(a, b);
      assert.ok(Math.abs(similarity - 1) < 0.0001);
    });
  });

  describe('findSimilar', () => {
    const candidates = [
      { embedding: [1, 0, 0], data: 'x-axis' },
      { embedding: [0, 1, 0], data: 'y-axis' },
      { embedding: [0, 0, 1], data: 'z-axis' },
      { embedding: [0.7, 0.7, 0], data: 'xy-diagonal' },
      { embedding: [0.7, 0, 0.7], data: 'xz-diagonal' },
    ];

    it('should find most similar item', () => {
      const query = [1, 0.1, 0]; // close to x-axis
      const results = findSimilar(query, candidates, 1);

      assert.equal(results.length, 1);
      assert.equal(results[0].data, 'x-axis');
      assert.ok(results[0].score > 0.99);
    });

    it('should return top K results', () => {
      const query = [0.5, 0.5, 0]; // between x and y
      const results = findSimilar(query, candidates, 3);

      assert.equal(results.length, 3);
      // xy-diagonal should be most similar
      assert.equal(results[0].data, 'xy-diagonal');
    });

    it('should sort by descending score', () => {
      const query = [1, 0, 0];
      const results = findSimilar(query, candidates, 5);

      for (let i = 1; i < results.length; i++) {
        assert.ok(results[i - 1].score >= results[i].score);
      }
    });

    it('should handle topK greater than candidates', () => {
      const query = [1, 0, 0];
      const results = findSimilar(query, candidates, 100);

      assert.equal(results.length, candidates.length);
    });

    it('should handle empty candidates', () => {
      const query = [1, 0, 0];
      const results = findSimilar(query, [], 5);

      assert.equal(results.length, 0);
    });

    it('should default to top 5', () => {
      const query = [1, 0, 0];
      const results = findSimilar(query, candidates);

      assert.equal(results.length, 5);
    });
  });
});

// Note: Integration tests for embed(), embedOne(), and embedMany()
// require hitting the actual API or mocking fetch.
