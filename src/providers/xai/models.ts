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
 * @param options - Request options
 * @returns Language models with pricing, context length, and modalities
 *
 * @example
 * ```typescript
 * const models = await listLanguageModels({ apiKey: 'xai-...' });
 * for (const model of models.models) {
 *   console.log(`${model.id}: ${model.context_length} tokens, $${model.pricing.input}/M input`);
 * }
 * ```
 */
export async function listLanguageModels(options: RequestOptions): Promise<LanguageModelsResponse> {
  return requestGet<LanguageModelsResponse>('/language-models', options);
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
 * @param options - Request options
 * @returns Image generation models with pricing
 */
export async function listImageGenerationModels(
  options: RequestOptions,
): Promise<ImageGenerationModelsResponse> {
  return requestGet<ImageGenerationModelsResponse>('/image-generation-models', options);
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
