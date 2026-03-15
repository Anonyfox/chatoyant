/**
 * xAI Image Generation and Editing API.
 *
 * Supports both legacy grok-2-image-1212 (OpenAI-compatible params)
 * and the newer grok-imagine-image models (aspect_ratio, resolution).
 *
 * @module providers/xai/images
 */

import { type RequestOptions, request } from './request.js';
import type {
  ImageAspectRatio,
  ImageData,
  ImageEditRequest,
  ImageEditSource,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageQuality,
  ImageResolution,
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
  /** Legacy image size (for grok-2-image-1212) */
  size?: ImageSize;
  /** Legacy image quality (for grok-2-image-1212) */
  quality?: ImageQuality;
  /** Legacy image style (for grok-2-image-1212) */
  style?: ImageStyle;
  /** Response format */
  responseFormat?: ImageResponseFormat;
  /** Aspect ratio (for grok-imagine-image) */
  aspectRatio?: ImageAspectRatio;
  /** Resolution (for grok-imagine-image) */
  resolution?: ImageResolution;
  /** End-user identifier */
  user?: string;
}

/**
 * Options for image editing requests.
 */
export interface ImageEditOptions extends RequestOptions {
  /** Model ID */
  model?: string;
  /** Number of images to generate (1-10) */
  n?: number;
  /** Response format */
  responseFormat?: ImageResponseFormat;
  /** Aspect ratio override (only for multi-image edits) */
  aspectRatio?: ImageAspectRatio;
  /** Resolution */
  resolution?: ImageResolution;
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
 *   { apiKey: 'xai-...', model: 'grok-imagine-image' }
 * );
 * console.log(response.data[0].url);
 * ```
 */
export async function generateImage(
  prompt: string,
  options: ImageGenerationOptions,
): Promise<ImageGenerationResponse> {
  const {
    model,
    n,
    size,
    quality,
    style,
    responseFormat,
    aspectRatio,
    resolution,
    user,
    ...reqOpts
  } = options;

  const body: ImageGenerationRequest = {
    prompt,
  };

  if (model !== undefined) body.model = model;
  if (n !== undefined) body.n = n;
  if (size !== undefined) body.size = size;
  if (quality !== undefined) body.quality = quality;
  if (style !== undefined) body.style = style;
  if (responseFormat !== undefined) body.response_format = responseFormat;
  if (aspectRatio !== undefined) body.aspect_ratio = aspectRatio;
  if (resolution !== undefined) body.resolution = resolution;
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

/**
 * Generate image with revised prompt (returns both).
 *
 * The model may revise the prompt for better results.
 * Returns both the image URL and the revised prompt.
 *
 * @param prompt - Image description
 * @param options - Request options
 * @returns Image URL and revised prompt
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

/**
 * Edit an existing image with natural language instructions.
 *
 * @param prompt - Edit instructions
 * @param imageUrl - Source image URL or base64 data URI
 * @param options - Request options
 * @returns Image generation response
 *
 * @example
 * ```typescript
 * const response = await editImage(
 *   'Render this as a pencil sketch with detailed shading',
 *   'https://example.com/photo.png',
 *   { apiKey: 'xai-...', model: 'grok-imagine-image' }
 * );
 * console.log(response.data[0].url);
 * ```
 */
export async function editImage(
  prompt: string,
  imageUrl: string,
  options: ImageEditOptions,
): Promise<ImageGenerationResponse> {
  const { model, n, responseFormat, aspectRatio, resolution, ...reqOpts } = options;

  const body: ImageEditRequest = {
    prompt,
    image: { url: imageUrl, type: 'image_url' },
  };

  if (model !== undefined) body.model = model;
  if (n !== undefined) body.n = n;
  if (responseFormat !== undefined) body.response_format = responseFormat;
  if (aspectRatio !== undefined) body.aspect_ratio = aspectRatio;
  if (resolution !== undefined) body.resolution = resolution;

  return request<ImageGenerationResponse>('/images/edits', body, reqOpts);
}

/**
 * Edit an image and return just the URL.
 *
 * @param prompt - Edit instructions
 * @param imageUrl - Source image URL or base64 data URI
 * @param options - Request options
 * @returns Edited image URL
 */
export async function editImageUrl(
  prompt: string,
  imageUrl: string,
  options: ImageEditOptions,
): Promise<string> {
  const response = await editImage(prompt, imageUrl, {
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
 * Edit an image and return base64 data.
 *
 * @param prompt - Edit instructions
 * @param imageUrl - Source image URL or base64 data URI
 * @param options - Request options
 * @returns Edited image as base64 string
 */
export async function editImageBase64(
  prompt: string,
  imageUrl: string,
  options: ImageEditOptions,
): Promise<string> {
  const response = await editImage(prompt, imageUrl, {
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
 * Edit with multiple source images (up to 3).
 *
 * @param prompt - Edit instructions referencing the source images
 * @param imageUrls - Array of source image URLs or base64 data URIs (up to 3)
 * @param options - Request options
 * @returns Image generation response
 *
 * @example
 * ```typescript
 * const response = await editMultipleImages(
 *   'Add the cat from the first image to the second one',
 *   ['https://example.com/cat.jpg', 'https://example.com/scene.jpg'],
 *   { apiKey: 'xai-...', model: 'grok-imagine-image' }
 * );
 * ```
 */
export async function editMultipleImages(
  prompt: string,
  imageUrls: string[],
  options: ImageEditOptions,
): Promise<ImageGenerationResponse> {
  const { model, n, responseFormat, aspectRatio, resolution, ...reqOpts } = options;

  const images: ImageEditSource[] = imageUrls.map((url) => ({ url, type: 'image_url' }));

  const body: ImageEditRequest = {
    prompt,
    images,
  };

  if (model !== undefined) body.model = model;
  if (n !== undefined) body.n = n;
  if (responseFormat !== undefined) body.response_format = responseFormat;
  if (aspectRatio !== undefined) body.aspect_ratio = aspectRatio;
  if (resolution !== undefined) body.resolution = resolution;

  return request<ImageGenerationResponse>('/images/edits', body, reqOpts);
}
