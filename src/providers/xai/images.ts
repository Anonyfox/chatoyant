/**
 * xAI Image Generation API.
 *
 * @module providers/xai/images
 */

import { type RequestOptions, request } from './request.js';
import type {
  ImageData,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageQuality,
  ImageResponseFormat,
  ImageSize,
  ImageStyle,
} from './types.js';

/**
 * Options for image generation requests.
 */
export interface ImageGenerationOptions extends RequestOptions {
  /** Model ID */
  model?: string;
  /** Number of images to generate (1-10) */
  n?: number;
  /** Image size */
  size?: ImageSize;
  /** Image quality */
  quality?: ImageQuality;
  /** Image style */
  style?: ImageStyle;
  /** Response format */
  responseFormat?: ImageResponseFormat;
  /** End-user identifier */
  user?: string;
}

/**
 * Generate images from a text prompt.
 *
 * @param prompt - Description of the image to generate
 * @param options - Request options
 * @returns Image generation response
 *
 * @example
 * ```typescript
 * const response = await generateImage(
 *   'A futuristic cityscape at sunset',
 *   { apiKey: 'xai-...', model: 'grok-2-image-1212' }
 * );
 * console.log(response.data[0].url);
 * ```
 */
export async function generateImage(
  prompt: string,
  options: ImageGenerationOptions,
): Promise<ImageGenerationResponse> {
  const { model, n, size, quality, style, responseFormat, user, ...reqOpts } = options;

  const body: ImageGenerationRequest = {
    prompt,
  };

  if (model !== undefined) body.model = model;
  if (n !== undefined) body.n = n;
  if (size !== undefined) body.size = size;
  if (quality !== undefined) body.quality = quality;
  if (style !== undefined) body.style = style;
  if (responseFormat !== undefined) body.response_format = responseFormat;
  if (user !== undefined) body.user = user;

  return request<ImageGenerationResponse>('/images/generations', body, reqOpts);
}

/**
 * Generate a single image and return its URL.
 *
 * @param prompt - Description of the image to generate
 * @param options - Request options
 * @returns Generated image URL
 */
export async function generateImageUrl(
  prompt: string,
  options: ImageGenerationOptions,
): Promise<string> {
  const response = await generateImage(prompt, {
    ...options,
    responseFormat: 'url',
    n: 1,
  });

  const url = response.data[0]?.url;
  if (!url) {
    throw new Error('No URL in response');
  }

  return url;
}

/**
 * Generate a single image and return its base64 data.
 *
 * @param prompt - Description of the image to generate
 * @param options - Request options
 * @returns Generated image as base64 string
 */
export async function generateImageBase64(
  prompt: string,
  options: ImageGenerationOptions,
): Promise<string> {
  const response = await generateImage(prompt, {
    ...options,
    responseFormat: 'b64_json',
    n: 1,
  });

  const b64 = response.data[0]?.b64_json;
  if (!b64) {
    throw new Error('No base64 data in response');
  }

  return b64;
}

/**
 * Generate multiple images.
 *
 * @param prompt - Description of the images to generate
 * @param count - Number of images (1-10)
 * @param options - Request options
 * @returns Array of image data
 */
export async function generateImages(
  prompt: string,
  count: number,
  options: ImageGenerationOptions,
): Promise<ImageData[]> {
  const response = await generateImage(prompt, {
    ...options,
    n: count,
  });

  return response.data;
}
