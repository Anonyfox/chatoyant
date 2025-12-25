/**
 * HTTP request utilities for Anthropic API.
 *
 * @module providers/anthropic/request
 */

import { AnthropicError } from './errors.js';

/**
 * Anthropic API base URL.
 */
export const BASE_URL = 'https://api.anthropic.com/v1';

/**
 * Default request timeout in milliseconds.
 */
export const DEFAULT_TIMEOUT = 60_000;

/**
 * Default API version.
 */
export const API_VERSION = '2023-06-01';

/**
 * Request options for Anthropic API calls.
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
  /** Beta features to enable */
  betas?: string[];
}

/**
 * Build headers for an Anthropic API request.
 */
export function buildHeaders(
  apiKey: string,
  betas?: string[],
  extra?: Record<string, string>,
): Headers {
  const headers = new Headers({
    'x-api-key': apiKey,
    'anthropic-version': API_VERSION,
    'Content-Type': 'application/json',
    ...extra,
  });

  if (betas && betas.length > 0) {
    headers.set('anthropic-beta', betas.join(','));
  }

  return headers;
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
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${ms}ms`));
  }, ms);

  // unref the timeout so it doesn't keep the process running
  if (typeof timeoutId === 'object' && 'unref' in timeoutId) {
    (timeoutId as NodeJS.Timeout).unref();
  }

  if (existingSignal) {
    if (existingSignal.aborted) {
      controller.abort(existingSignal.reason);
    } else {
      existingSignal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        controller.abort(existingSignal.reason);
      });
    }
  }

  controller.signal.addEventListener('abort', () => {
    clearTimeout(timeoutId);
  });

  return controller.signal;
}

/**
 * Execute an Anthropic API request.
 *
 * @param endpoint - API endpoint (e.g., "/messages")
 * @param body - Request body
 * @param options - Request options
 * @returns Parsed response
 * @throws AnthropicError on failure
 */
export async function request<T>(
  endpoint: string,
  body: unknown,
  options: RequestOptions,
): Promise<T> {
  const {
    apiKey,
    baseUrl,
    timeout = DEFAULT_TIMEOUT,
    headers: extraHeaders,
    signal,
    betas,
  } = options;

  const url = buildUrl(endpoint, baseUrl);
  const headers = buildHeaders(apiKey, betas, extraHeaders);
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
          throw AnthropicError.timeout(timeout);
        }
        throw error;
      }
      throw AnthropicError.networkError(error);
    }
    throw error;
  }

  if (!response.ok) {
    throw await AnthropicError.fromResponse(response);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw AnthropicError.invalidResponse('Failed to parse response JSON');
  }
}

/**
 * Execute an Anthropic API request and return raw response (for streaming).
 *
 * @param endpoint - API endpoint
 * @param body - Request body
 * @param options - Request options
 * @returns Raw Response object
 * @throws AnthropicError on failure
 */
export async function requestRaw(
  endpoint: string,
  body: unknown,
  options: RequestOptions,
): Promise<Response> {
  const {
    apiKey,
    baseUrl,
    timeout = DEFAULT_TIMEOUT,
    headers: extraHeaders,
    signal,
    betas,
  } = options;

  const url = buildUrl(endpoint, baseUrl);
  const headers = buildHeaders(apiKey, betas, extraHeaders);
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
          throw AnthropicError.timeout(timeout);
        }
        throw error;
      }
      throw AnthropicError.networkError(error);
    }
    throw error;
  }

  if (!response.ok) {
    throw await AnthropicError.fromResponse(response);
  }

  return response;
}

/**
 * Execute a GET request to Anthropic API.
 *
 * @param endpoint - API endpoint
 * @param options - Request options
 * @returns Parsed response
 * @throws AnthropicError on failure
 */
export async function requestGet<T>(endpoint: string, options: RequestOptions): Promise<T> {
  const {
    apiKey,
    baseUrl,
    timeout = DEFAULT_TIMEOUT,
    headers: extraHeaders,
    signal,
    betas,
  } = options;

  const url = buildUrl(endpoint, baseUrl);
  const headers = buildHeaders(apiKey, betas, extraHeaders);
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
          throw AnthropicError.timeout(timeout);
        }
        throw error;
      }
      throw AnthropicError.networkError(error);
    }
    throw error;
  }

  if (!response.ok) {
    throw await AnthropicError.fromResponse(response);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw AnthropicError.invalidResponse('Failed to parse response JSON');
  }
}
