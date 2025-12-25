/**
 * OpenAI Embeddings API.
 *
 * @module providers/openai/embeddings
 */

import { type RequestOptions, request } from './request.js';
import type { EmbeddingRequest, EmbeddingResponse } from './types.js';

/**
 * Options for embedding requests.
 */
export interface EmbeddingOptions extends RequestOptions {
  /** Model ID */
  model: string;
  /** Output dimensions (model-specific) */
  dimensions?: number;
  /** Encoding format */
  encodingFormat?: 'float' | 'base64';
}

/**
 * Create embeddings for text input(s).
 *
 * @param input - Text or array of texts to embed
 * @param options - Request options
 * @returns Embedding response with vectors
 *
 * @example
 * ```typescript
 * const response = await embed(
 *   'Hello, world!',
 *   { apiKey: 'sk-...', model: 'text-embedding-3-small' }
 * );
 * console.log(response.data[0].embedding);
 * ```
 */
export async function embed(
  input: string | string[],
  options: EmbeddingOptions,
): Promise<EmbeddingResponse> {
  const { model, dimensions, encodingFormat, ...reqOpts } = options;

  const body: EmbeddingRequest = {
    model,
    input,
  };

  if (dimensions !== undefined) {
    body.dimensions = dimensions;
  }

  if (encodingFormat) {
    body.encoding_format = encodingFormat;
  }

  return request<EmbeddingResponse>('/embeddings', body, reqOpts);
}

/**
 * Create embedding for a single text (returns just the vector).
 *
 * @param input - Text to embed
 * @param options - Request options
 * @returns Embedding vector
 *
 * @example
 * ```typescript
 * const vector = await embedOne(
 *   'Hello, world!',
 *   { apiKey: 'sk-...', model: 'text-embedding-3-small' }
 * );
 * console.log(vector.length); // e.g., 1536
 * ```
 */
export async function embedOne(input: string, options: EmbeddingOptions): Promise<number[]> {
  const response = await embed(input, options);
  return response.data[0].embedding;
}

/**
 * Create embeddings for multiple texts (returns just the vectors).
 *
 * @param inputs - Array of texts to embed
 * @param options - Request options
 * @returns Array of embedding vectors (same order as input)
 *
 * @example
 * ```typescript
 * const vectors = await embedMany(
 *   ['Hello', 'World'],
 *   { apiKey: 'sk-...', model: 'text-embedding-3-small' }
 * );
 * console.log(vectors.length); // 2
 * ```
 */
export async function embedMany(inputs: string[], options: EmbeddingOptions): Promise<number[][]> {
  const response = await embed(inputs, options);
  // Sort by index to ensure order matches input
  return response.data.sort((a, b) => a.index - b.index).map((e) => e.embedding);
}

/**
 * Calculate cosine similarity between two vectors.
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine similarity (-1 to 1)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Find most similar items from a list of embeddings.
 *
 * @param query - Query embedding
 * @param candidates - Array of candidate embeddings with associated data
 * @param topK - Number of results to return
 * @returns Top K most similar items with scores
 */
export function findSimilar<T>(
  query: number[],
  candidates: Array<{ embedding: number[]; data: T }>,
  topK: number = 5,
): Array<{ data: T; score: number }> {
  const scored = candidates.map((c) => ({
    data: c.data,
    score: cosineSimilarity(query, c.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}
