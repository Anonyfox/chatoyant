/**
 * xAI Models API.
 *
 * xAI extends the standard OpenAI /models endpoint with additional
 * endpoints for detailed language and image model information.
 *
 * @module providers/xai/models
 */

import { type RequestOptions, requestGet } from './request.js';
import type {
  ImageGenerationModel,
  ImageGenerationModelsResponse,
  LanguageModel,
  LanguageModelsResponse,
  Model,
  ModelsResponse,
} from './types.js';

/**
 * List all available models (OpenAI-compatible).
 *
 * @param options - Request options
 * @returns Models response
 */
export async function listModels(options: RequestOptions): Promise<ModelsResponse> {
  return requestGet<ModelsResponse>('/models', options);
}

/**
 * Get a specific model (OpenAI-compatible).
 *
 * @param modelId - Model ID
 * @param options - Request options
 * @returns Model information
 */
export async function getModel(modelId: string, options: RequestOptions): Promise<Model> {
  return requestGet<Model>(`/models/${modelId}`, options);
}

/**
 * Check if a model exists.
 *
 * @param modelId - Model ID
 * @param options - Request options
 * @returns True if model exists
 */
export async function modelExists(modelId: string, options: RequestOptions): Promise<boolean> {
  try {
    await getModel(modelId, options);
    return true;
  } catch {
    return false;
  }
}

/**
 * List language models with detailed information.
 * xAI-specific endpoint.
 *
 * Note: Returns wrapper object with `models` array. Use `getLanguageModelList()` for just the array.
 *
 * @param options - Request options
 * @returns Language models response (contains `models` array)
 *
 * @example
 * ```typescript
 * const response = await listLanguageModels({ apiKey: 'xai-...' });
 * for (const model of response.models) {
 *   console.log(`${model.id}: ${model.context_length} tokens`);
 * }
 * ```
 */
export async function listLanguageModels(options: RequestOptions): Promise<LanguageModelsResponse> {
  return requestGet<LanguageModelsResponse>('/language-models', options);
}

/**
 * Get language models as a simple array (convenience helper).
 * xAI-specific endpoint.
 *
 * @param options - Request options
 * @returns Array of language models with pricing, context length, and modalities
 *
 * @example
 * ```typescript
 * const models = await getLanguageModelList({ apiKey: 'xai-...' });
 * for (const model of models) {
 *   console.log(`${model.id}: ${model.context_length} tokens, $${model.pricing.input}/M input`);
 * }
 * ```
 */
export async function getLanguageModelList(options: RequestOptions): Promise<LanguageModel[]> {
  const response = await listLanguageModels(options);
  return response.models;
}

/**
 * Get a specific language model with detailed information.
 * xAI-specific endpoint.
 *
 * @param modelId - Model ID
 * @param options - Request options
 * @returns Language model with pricing, context length, and modalities
 */
export async function getLanguageModel(
  modelId: string,
  options: RequestOptions,
): Promise<LanguageModel> {
  return requestGet<LanguageModel>(`/language-models/${modelId}`, options);
}

/**
 * List image generation models with detailed information.
 * xAI-specific endpoint.
 *
 * Note: Returns wrapper object with `models` array. Use `getImageGenerationModelList()` for just the array.
 *
 * @param options - Request options
 * @returns Image generation models response (contains `models` array)
 */
export async function listImageGenerationModels(
  options: RequestOptions,
): Promise<ImageGenerationModelsResponse> {
  return requestGet<ImageGenerationModelsResponse>('/image-generation-models', options);
}

/**
 * Get image generation models as a simple array (convenience helper).
 * xAI-specific endpoint.
 *
 * @param options - Request options
 * @returns Array of image generation models with pricing
 *
 * @example
 * ```typescript
 * const models = await getImageGenerationModelList({ apiKey: 'xai-...' });
 * console.log(`Available: ${models.map(m => m.id).join(', ')}`);
 * ```
 */
export async function getImageGenerationModelList(
  options: RequestOptions,
): Promise<ImageGenerationModel[]> {
  const response = await listImageGenerationModels(options);
  return response.models;
}

/**
 * Get a specific image generation model.
 * xAI-specific endpoint.
 *
 * @param modelId - Model ID
 * @param options - Request options
 * @returns Image generation model with pricing
 */
export async function getImageGenerationModel(
  modelId: string,
  options: RequestOptions,
): Promise<ImageGenerationModel> {
  return requestGet<ImageGenerationModel>(`/image-generation-models/${modelId}`, options);
}
