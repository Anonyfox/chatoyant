/**
 * OpenAI Images API.
 *
 * @module providers/openai/images
 */

import { type RequestOptions, request } from './request.js';
import type { ImageData, ImageGenerationRequest, ImageGenerationResponse } from './types.js';

/**
 * Options for image generation requests.
 */
export interface ImageGenerationOptions extends RequestOptions {
  /** Model ID */
  model?: string;
  /** Number of images to generate */
  n?: number;
  /** Image size */
  size?: '1024x1024' | '1024x1792' | '1792x1024' | 'auto';
  /** Quality level */
  quality?: 'low' | 'medium' | 'high' | 'auto';
  /** Style */
  style?: 'vivid' | 'natural';
  /** Response format */
  responseFormat?: 'url' | 'b64_json';
}

/**
 * Generate images from a text prompt.
 *
 * @param prompt - Image description
 * @param options - Request options
 * @returns Image generation response
 *
 * @example
 * ```typescript
 * const response = await generateImage(
 *   'A serene mountain landscape at sunset',
 *   { apiKey: 'sk-...', model: 'dall-e-3' }
 * );
 * console.log(response.data[0].url);
 * ```
 */
export async function generateImage(
  prompt: string,
  options: ImageGenerationOptions,
): Promise<ImageGenerationResponse> {
  const { model, n, size, quality, style, responseFormat, ...reqOpts } = options;

  const body: ImageGenerationRequest = {
    prompt,
  };

  if (model) body.model = model;
  if (n !== undefined) body.n = n;
  if (size) body.size = size;
  if (quality) body.quality = quality;
  if (style) body.style = style;
  if (responseFormat) body.response_format = responseFormat;

  return request<ImageGenerationResponse>('/images/generations', body, reqOpts);
}

/**
 * Generate a single image and return just the URL.
 *
 * @param prompt - Image description
 * @param options - Request options
 * @returns Image URL
 *
 * @example
 * ```typescript
 * const url = await generateImageUrl(
 *   'A cat wearing a hat',
 *   { apiKey: 'sk-...', model: 'dall-e-3' }
 * );
 * console.log(url);
 * ```
 */
export async function generateImageUrl(
  prompt: string,
  options: ImageGenerationOptions,
): Promise<string> {
  const response = await generateImage(prompt, { ...options, n: 1, responseFormat: 'url' });
  const url = response.data[0]?.url;
  if (!url) {
    throw new Error('No URL in response');
  }
  return url;
}

/**
 * Generate a single image and return base64 data.
 *
 * @param prompt - Image description
 * @param options - Request options
 * @returns Base64-encoded image data
 *
 * @example
 * ```typescript
 * const base64 = await generateImageBase64(
 *   'A futuristic city',
 *   { apiKey: 'sk-...' }
 * );
 * // Use in HTML: <img src="data:image/png;base64,${base64}" />
 * ```
 */
export async function generateImageBase64(
  prompt: string,
  options: ImageGenerationOptions,
): Promise<string> {
  const response = await generateImage(prompt, { ...options, n: 1, responseFormat: 'b64_json' });
  const data = response.data[0]?.b64_json;
  if (!data) {
    throw new Error('No base64 data in response');
  }
  return data;
}

/**
 * Generate multiple images.
 *
 * @param prompt - Image description
 * @param count - Number of images to generate
 * @param options - Request options
 * @returns Array of image data
 *
 * @example
 * ```typescript
 * const images = await generateImages(
 *   'Abstract art',
 *   4,
 *   { apiKey: 'sk-...' }
 * );
 * images.forEach((img, i) => console.log(`Image ${i}: ${img.url}`));
 * ```
 */
export async function generateImages(
  prompt: string,
  count: number,
  options: ImageGenerationOptions,
): Promise<ImageData[]> {
  const response = await generateImage(prompt, { ...options, n: count });
  return response.data;
}

/**
 * Generate image with revised prompt (returns both).
 *
 * DALL-E 3 may revise the prompt for better results.
 * This function returns both the image and the revised prompt.
 *
 * @param prompt - Image description
 * @param options - Request options
 * @returns Image data and revised prompt
 */
export async function generateImageWithPrompt(
  prompt: string,
  options: ImageGenerationOptions,
): Promise<{ url: string; revisedPrompt: string }> {
  const response = await generateImage(prompt, { ...options, n: 1, responseFormat: 'url' });
  const data = response.data[0];
  if (!data?.url) {
    throw new Error('No URL in response');
  }
  return {
    url: data.url,
    revisedPrompt: data.revised_prompt ?? prompt,
  };
}
