/**
 * xAI Embeddings API.
 *
 * @module providers/xai/embeddings
 */

import { type RequestOptions, request } from './request.js';
import type { Embedding, EmbeddingRequest, EmbeddingResponse, EncodingFormat } from './types.js';

/**
 * Options for embedding requests.
 */
export interface EmbeddingOptions extends RequestOptions {
  /** Model ID (required) */
  model: string;
  /** Encoding format */
  encodingFormat?: EncodingFormat;
  /** Output dimensions */
  dimensions?: number;
  /** End-user identifier */
  user?: string;
}

/**
 * Generate embeddings for text input.
 *
 * @param input - Text(s) to embed
 * @param options - Request options
 * @returns Embedding response with vectors
 *
 * @example
 * ```typescript
 * const response = await embed(
 *   ['Hello world', 'Goodbye world'],
 *   { apiKey: 'xai-...', model: 'grok-embedding-1' }
 * );
 * console.log(response.data[0].embedding);
 * ```
 */
export async function embed(
  input: string | string[],
  options: EmbeddingOptions,
): Promise<EmbeddingResponse> {
  const { model, encodingFormat, dimensions, user, ...reqOpts } = options;

  const body: EmbeddingRequest = {
    model,
    input,
  };

  if (encodingFormat !== undefined) body.encoding_format = encodingFormat;
  if (dimensions !== undefined) body.dimensions = dimensions;
  if (user !== undefined) body.user = user;

  return request<EmbeddingResponse>('/embeddings', body, reqOpts);
}

/**
 * Generate embedding for a single text.
 *
 * @param text - Text to embed
 * @param options - Request options
 * @returns Embedding vector
 */
export async function embedOne(text: string, options: EmbeddingOptions): Promise<number[]> {
  const response = await embed(text, options);
  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts.
 *
 * @param texts - Texts to embed
 * @param options - Request options
 * @returns Array of embedding vectors
 */
export async function embedMany(texts: string[], options: EmbeddingOptions): Promise<number[][]> {
  const response = await embed(texts, options);
  return response.data.map((e: Embedding) => e.embedding);
}

/**
 * Calculate cosine similarity between two vectors.
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Similarity score between -1 and 1
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
 * Find the most similar items from a corpus.
 *
 * @param query - Query embedding
 * @param corpus - Array of items with embeddings
 * @param topK - Number of results to return
 * @returns Top K most similar items with scores
 */
export function findSimilar<T>(
  query: number[],
  corpus: Array<{ embedding: number[]; item: T }>,
  topK = 5,
): Array<{ item: T; score: number }> {
  const scored = corpus.map(({ embedding, item }) => ({
    item,
    score: cosineSimilarity(query, embedding),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}
