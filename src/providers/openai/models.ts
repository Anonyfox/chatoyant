/**
 * OpenAI Models API.
 *
 * @module providers/openai/models
 */

import { type RequestOptions, requestGet } from './request.js';
import type { Model, ModelsResponse } from './types.js';

/**
 * List all available models.
 *
 * @param options - Request options
 * @returns List of available models
 *
 * @example
 * ```typescript
 * const models = await listModels({ apiKey: 'sk-...' });
 * for (const model of models.data) {
 *   console.log(model.id);
 * }
 * ```
 */
export async function listModels(options: RequestOptions): Promise<ModelsResponse> {
  return requestGet<ModelsResponse>('/models', options);
}

/**
 * Get details for a specific model.
 *
 * @param modelId - Model ID
 * @param options - Request options
 * @returns Model details
 *
 * @example
 * ```typescript
 * const model = await getModel('gpt-4o', { apiKey: 'sk-...' });
 * console.log(model.owned_by);
 * ```
 */
export async function getModel(modelId: string, options: RequestOptions): Promise<Model> {
  return requestGet<Model>(`/models/${encodeURIComponent(modelId)}`, options);
}

/**
 * List model IDs only.
 *
 * @param options - Request options
 * @returns Array of model IDs
 */
export async function listModelIds(options: RequestOptions): Promise<string[]> {
  const response = await listModels(options);
  return response.data.map((m) => m.id);
}

/**
 * Check if a model exists.
 *
 * @param modelId - Model ID to check
 * @param options - Request options
 * @returns true if model exists
 */
export async function modelExists(modelId: string, options: RequestOptions): Promise<boolean> {
  try {
    await getModel(modelId, options);
    return true;
  } catch {
    return false;
  }
}
