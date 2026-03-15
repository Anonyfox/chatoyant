/**
 * xAI Video Generation API.
 *
 * Video generation is asynchronous: a request returns a `request_id`,
 * which must be polled until the video is ready. The high-level
 * `generateVideo` function handles polling automatically.
 *
 * @module providers/xai/videos
 */

import { type RequestOptions, request, requestGet } from './request.js';
import type {
  VideoAspectRatio,
  VideoGenerationRequest,
  VideoGenerationStartResponse,
  VideoGenerationStatus,
  VideoGenerationStatusResponse,
  VideoResolution,
} from './types.js';

/**
 * Options for video generation requests.
 */
export interface VideoGenerationOptions extends RequestOptions {
  /** Model ID */
  model?: string;
  /** Video duration in seconds (1-15). Not supported for video editing. */
  duration?: number;
  /** Aspect ratio. Not supported for video editing. */
  aspectRatio?: VideoAspectRatio;
  /** Resolution (480p or 720p). Not supported for video editing. */
  resolution?: VideoResolution;
  /** Source image URL for image-to-video (URL or base64 data URI) */
  imageUrl?: string;
  /** Source video URL for video editing */
  videoUrl?: string;
}

/**
 * Options controlling the polling behavior.
 */
export interface VideoPollingOptions {
  /** Maximum time to wait in ms (default: 600_000 = 10 minutes) */
  pollTimeoutMs?: number;
  /** Interval between status checks in ms (default: 5_000 = 5 seconds) */
  pollIntervalMs?: number;
  /** AbortSignal to cancel polling */
  signal?: AbortSignal;
  /** Callback invoked on each poll with the current status */
  onPoll?: (status: VideoGenerationStatus) => void;
}

/**
 * Result of a completed video generation.
 */
export interface VideoGenerationResult {
  /** Temporary URL to the generated video (download promptly) */
  url: string;
  /** Actual video duration in seconds */
  duration: number;
  /** Whether the video passed content moderation */
  respectModeration: boolean;
  /** Model that generated the video */
  model: string;
  /** The request ID used for polling */
  requestId: string;
}

const DEFAULT_VIDEO_MODEL = 'grok-imagine-video';
const DEFAULT_POLL_TIMEOUT_MS = 600_000;
const DEFAULT_POLL_INTERVAL_MS = 5_000;

/**
 * Start a video generation request (non-blocking).
 *
 * Returns a `request_id` that must be polled with `getVideoStatus`
 * until the video is ready. For automatic polling, use `generateVideo` instead.
 *
 * @param prompt - Text prompt describing the video
 * @param options - Request options
 * @returns The request_id for polling
 *
 * @example
 * ```typescript
 * const { requestId } = await startVideoGeneration(
 *   'A rocket launching from Mars',
 *   { apiKey: 'xai-...', model: 'grok-imagine-video', duration: 10 }
 * );
 * // Poll with getVideoStatus(requestId, ...)
 * ```
 */
export async function startVideoGeneration(
  prompt: string,
  options: VideoGenerationOptions,
): Promise<{ requestId: string }> {
  const { model, duration, aspectRatio, resolution, imageUrl, videoUrl, ...reqOpts } = options;

  const body: VideoGenerationRequest = {
    model: model ?? DEFAULT_VIDEO_MODEL,
    prompt,
  };

  if (duration !== undefined) body.duration = duration;
  if (aspectRatio !== undefined) body.aspect_ratio = aspectRatio;
  if (resolution !== undefined) body.resolution = resolution;
  if (imageUrl !== undefined) body.image_url = imageUrl;
  if (videoUrl !== undefined) body.video_url = videoUrl;

  const response = await request<VideoGenerationStartResponse>(
    '/videos/generations',
    body,
    reqOpts,
  );

  return { requestId: response.request_id };
}

/**
 * Check the status of a video generation request.
 *
 * @param requestId - The request_id from `startVideoGeneration`
 * @param options - Request options (apiKey required)
 * @returns Current status and video data if complete
 */
export async function getVideoStatus(
  requestId: string,
  options: RequestOptions,
): Promise<VideoGenerationStatusResponse> {
  return requestGet<VideoGenerationStatusResponse>(`/videos/${requestId}`, options);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('Aborted'));
      return;
    }

    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new Error('Aborted'));
      },
      { once: true },
    );
  });
}

/**
 * Generate a video and wait for completion (handles polling automatically).
 *
 * @param prompt - Text prompt describing the video
 * @param options - Video generation options
 * @param pollingOptions - Polling behavior configuration
 * @returns Completed video generation result
 * @throws {XAIError} On API errors
 * @throws {Error} On timeout or if the request expires
 *
 * @example
 * ```typescript
 * const result = await generateVideo(
 *   'A crystal-powered rocket launching from Mars',
 *   { apiKey: 'xai-...', duration: 10, aspectRatio: '16:9', resolution: '720p' }
 * );
 * console.log(result.url);
 * ```
 */
export async function generateVideo(
  prompt: string,
  options: VideoGenerationOptions,
  pollingOptions?: VideoPollingOptions,
): Promise<VideoGenerationResult> {
  const { requestId } = await startVideoGeneration(prompt, options);
  return pollVideoUntilDone(requestId, options, pollingOptions);
}

/**
 * Generate a video and return just the URL.
 *
 * @param prompt - Text prompt describing the video
 * @param options - Video generation options
 * @param pollingOptions - Polling behavior configuration
 * @returns Temporary URL to the generated video
 */
export async function generateVideoUrl(
  prompt: string,
  options: VideoGenerationOptions,
  pollingOptions?: VideoPollingOptions,
): Promise<string> {
  const result = await generateVideo(prompt, options, pollingOptions);
  return result.url;
}

/**
 * Generate a video from a still image (image-to-video).
 *
 * @param prompt - Text prompt describing the desired animation
 * @param imageUrl - Source image URL or base64 data URI
 * @param options - Video generation options
 * @param pollingOptions - Polling behavior configuration
 * @returns Completed video generation result
 *
 * @example
 * ```typescript
 * const result = await generateVideoFromImage(
 *   'Animate this landscape with flowing clouds',
 *   'https://example.com/landscape.jpg',
 *   { apiKey: 'xai-...' }
 * );
 * ```
 */
export async function generateVideoFromImage(
  prompt: string,
  imageUrl: string,
  options: VideoGenerationOptions,
  pollingOptions?: VideoPollingOptions,
): Promise<VideoGenerationResult> {
  return generateVideo(prompt, { ...options, imageUrl }, pollingOptions);
}

/**
 * Edit an existing video with natural language instructions.
 *
 * Duration, aspect ratio, and resolution are inherited from the source video
 * and cannot be overridden.
 *
 * @param prompt - Edit instructions
 * @param videoUrl - Source video URL
 * @param options - Video generation options
 * @param pollingOptions - Polling behavior configuration
 * @returns Completed video generation result
 */
export async function editVideo(
  prompt: string,
  videoUrl: string,
  options: VideoGenerationOptions,
  pollingOptions?: VideoPollingOptions,
): Promise<VideoGenerationResult> {
  return generateVideo(prompt, { ...options, videoUrl }, pollingOptions);
}

/**
 * Poll a video generation request until completion.
 *
 * @internal
 */
async function pollVideoUntilDone(
  requestId: string,
  requestOptions: RequestOptions,
  pollingOptions?: VideoPollingOptions,
): Promise<VideoGenerationResult> {
  const timeoutMs = pollingOptions?.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  const intervalMs = pollingOptions?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const { signal, onPoll } = pollingOptions ?? {};

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw signal.reason ?? new Error('Video generation aborted');
    }

    const status = await getVideoStatus(requestId, requestOptions);
    onPoll?.(status.status);

    if (status.status === 'done' && status.video) {
      return {
        url: status.video.url,
        duration: status.video.duration,
        respectModeration: status.video.respect_moderation,
        model: status.model ?? DEFAULT_VIDEO_MODEL,
        requestId,
      };
    }

    if (status.status === 'expired') {
      throw new Error(`Video generation request expired (request_id: ${requestId})`);
    }

    await sleep(intervalMs, signal);
  }

  throw new Error(`Video generation timed out after ${timeoutMs}ms (request_id: ${requestId})`);
}
