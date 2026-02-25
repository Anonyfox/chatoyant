/**
 * Anthropic Models API.
 *
 * List and retrieve model information from the Anthropic API.
 *
 * @module providers/anthropic/models
 */

import { type RequestOptions, requestGet } from './request.js';
import type { Model, ModelsResponse } from './types.js';

/**
 * Pagination parameters for listing models.
 */
export interface ListModelsParams {
  /** Number of items to return per page (1-1000, default 20). */
  limit?: number;
  /** Return the page of results immediately before this object ID. */
  before_id?: string;
  /** Return the page of results immediately after this object ID. */
  after_id?: string;
}

/**
 * Build query string from pagination parameters.
 */
function buildQueryString(params?: ListModelsParams): string {
  if (!params) return '';

  const parts: string[] = [];
  if (params.limit !== undefined) parts.push(`limit=${params.limit}`);
  if (params.before_id) parts.push(`before_id=${encodeURIComponent(params.before_id)}`);
  if (params.after_id) parts.push(`after_id=${encodeURIComponent(params.after_id)}`);

  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

/**
 * List available models (single page).
 *
 * The Anthropic Models API returns paginated results. Use {@link listAllModels}
 * to automatically fetch all pages.
 *
 * @param options - Request options
 * @param params - Optional pagination parameters
 * @returns Paginated models response
 *
 * @example
 * ```typescript
 * const response = await listModels({ apiKey: 'sk-ant-...' });
 * for (const model of response.data) {
 *   console.log(`${model.id}: ${model.display_name}`);
 * }
 *
 * // With pagination
 * const page = await listModels({ apiKey: 'sk-ant-...' }, { limit: 5 });
 * if (page.has_more) {
 *   const next = await listModels({ apiKey: 'sk-ant-...' }, { after_id: page.last_id! });
 * }
 * ```
 */
export async function listModels(
  options: RequestOptions,
  params?: ListModelsParams,
): Promise<ModelsResponse> {
  const query = buildQueryString(params);
  return requestGet<ModelsResponse>(`/models${query}`, options);
}

/**
 * Get details for a specific model.
 *
 * Also resolves model aliases to their canonical model ID.
 *
 * @param modelId - Model ID or alias
 * @param options - Request options
 * @returns Model details
 *
 * @example
 * ```typescript
 * const model = await getModel('claude-sonnet-4-20250514', { apiKey: 'sk-ant-...' });
 * console.log(model.display_name); // "Claude Sonnet 4"
 * ```
 */
export async function getModel(modelId: string, options: RequestOptions): Promise<Model> {
  return requestGet<Model>(`/models/${encodeURIComponent(modelId)}`, options);
}

/**
 * List all available models, automatically paginating through all pages.
 *
 * @param options - Request options
 * @returns Array of all models
 *
 * @example
 * ```typescript
 * const models = await listAllModels({ apiKey: 'sk-ant-...' });
 * console.log(`Found ${models.length} models`);
 * ```
 */
export async function listAllModels(options: RequestOptions): Promise<Model[]> {
  const allModels: Model[] = [];
  let hasMore = true;
  let afterId: string | undefined;

  while (hasMore) {
    const response = await listModels(options, {
      limit: 1000,
      after_id: afterId,
    });

    allModels.push(...response.data);
    hasMore = response.has_more && !!response.last_id;
    afterId = response.last_id ?? undefined;
  }

  return allModels;
}

/**
 * List model IDs only.
 *
 * Fetches all pages and returns just the ID strings.
 *
 * @param options - Request options
 * @returns Array of model IDs
 *
 * @example
 * ```typescript
 * const ids = await listModelIds({ apiKey: 'sk-ant-...' });
 * console.log(ids); // ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', ...]
 * ```
 */
export async function listModelIds(options: RequestOptions): Promise<string[]> {
  const models = await listAllModels(options);
  return models.map((m) => m.id);
}

/**
 * Check if a model exists.
 *
 * @param modelId - Model ID to check
 * @param options - Request options
 * @returns true if model exists
 *
 * @example
 * ```typescript
 * const exists = await modelExists('claude-sonnet-4-20250514', { apiKey: 'sk-ant-...' });
 * ```
 */
export async function modelExists(modelId: string, options: RequestOptions): Promise<boolean> {
  try {
    await getModel(modelId, options);
    return true;
  } catch {
    return false;
  }
}
