/**
 * HTTP request utilities for xAI API.
 *
 * xAI uses OpenAI-compatible auth (Bearer token) but different base URL.
 *
 * @module providers/xai/request
 */

import { XAIError } from './errors.js';

/**
 * xAI API base URL.
 */
export const BASE_URL = 'https://api.x.ai/v1';

/**
 * Default request timeout in milliseconds.
 */
export const DEFAULT_TIMEOUT = 60_000;

/**
 * Request options for xAI API calls.
 */
export interface RequestOptions {
  /** API key (required) */
  apiKey: string;
  /** Base URL override */
  baseUrl?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Additional headers */
  headers?: Record<string, string>;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/**
 * Build headers for an xAI API request.
 * Uses Bearer token auth (OpenAI-compatible).
 */
export function buildHeaders(apiKey: string, extra?: Record<string, string>): Headers {
  return new Headers({
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    ...extra,
  });
}

/**
 * Build full URL for an endpoint.
 */
export function buildUrl(endpoint: string, baseUrl?: string): string {
  const base = baseUrl ?? BASE_URL;
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${cleanBase}${cleanEndpoint}`;
}

/**
 * Create an AbortSignal with timeout.
 */
export function createTimeoutSignal(ms: number, existingSignal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(ms);

  if (existingSignal) {
    // Combine timeout signal with existing signal
    return AbortSignal.any([timeoutSignal, existingSignal]);
  }

  return timeoutSignal;
}

/**
 * Execute an xAI API request.
 *
 * @param endpoint - API endpoint (e.g., "/chat/completions")
 * @param body - Request body
 * @param options - Request options
 * @returns Parsed response
 * @throws XAIError on failure
 */
export async function request<T>(
  endpoint: string,
  body: unknown,
  options: RequestOptions,
): Promise<T> {
  const { apiKey, baseUrl, timeout = DEFAULT_TIMEOUT, headers: extraHeaders, signal } = options;

  const url = buildUrl(endpoint, baseUrl);
  const headers = buildHeaders(apiKey, extraHeaders);
  const timeoutSignal = createTimeoutSignal(timeout, signal);

  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: timeoutSignal,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        if (error.message.includes('timed out')) {
          throw XAIError.timeout(timeout);
        }
        throw error;
      }
      throw XAIError.networkError(error);
    }
    throw error;
  }

  if (!response.ok) {
    throw await XAIError.fromResponse(response);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw XAIError.invalidResponse('Failed to parse response JSON');
  }
}

/**
 * Execute an xAI API request and return raw response (for streaming).
 *
 * @param endpoint - API endpoint
 * @param body - Request body
 * @param options - Request options
 * @returns Raw Response object
 * @throws XAIError on failure
 */
export async function requestRaw(
  endpoint: string,
  body: unknown,
  options: RequestOptions,
): Promise<Response> {
  const { apiKey, baseUrl, timeout = DEFAULT_TIMEOUT, headers: extraHeaders, signal } = options;

  const url = buildUrl(endpoint, baseUrl);
  const headers = buildHeaders(apiKey, extraHeaders);
  const timeoutSignal = createTimeoutSignal(timeout, signal);

  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: timeoutSignal,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        if (error.message.includes('timed out')) {
          throw XAIError.timeout(timeout);
        }
        throw error;
      }
      throw XAIError.networkError(error);
    }
    throw error;
  }

  if (!response.ok) {
    throw await XAIError.fromResponse(response);
  }

  return response;
}

/**
 * Execute a GET request to xAI API.
 *
 * @param endpoint - API endpoint
 * @param options - Request options
 * @returns Parsed response
 * @throws XAIError on failure
 */
export async function requestGet<T>(endpoint: string, options: RequestOptions): Promise<T> {
  const { apiKey, baseUrl, timeout = DEFAULT_TIMEOUT, headers: extraHeaders, signal } = options;

  const url = buildUrl(endpoint, baseUrl);
  const headers = buildHeaders(apiKey, extraHeaders);
  headers.delete('Content-Type');

  const timeoutSignal = createTimeoutSignal(timeout, signal);

  let response: Response;

  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
      signal: timeoutSignal,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        if (error.message.includes('timed out')) {
          throw XAIError.timeout(timeout);
        }
        throw error;
      }
      throw XAIError.networkError(error);
    }
    throw error;
  }

  if (!response.ok) {
    throw await XAIError.fromResponse(response);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw XAIError.invalidResponse('Failed to parse response JSON');
  }
}
