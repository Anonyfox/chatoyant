/**
 * HTTP request utilities for OpenAI API.
 *
 * @module providers/openai/request
 */

import { OpenAIError } from './errors.js';

/**
 * OpenAI API base URL.
 */
export const BASE_URL = 'https://api.openai.com/v1';

/**
 * Default request timeout in milliseconds.
 */
export const DEFAULT_TIMEOUT = 60_000;

/**
 * Request options for OpenAI API calls.
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
 * Build headers for an OpenAI API request.
 */
export function buildHeaders(apiKey: string, extra?: Record<string, string>): Headers {
  const headers = new Headers({
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    ...extra,
  });
  return headers;
}

/**
 * Build full URL for an endpoint.
 */
export function buildUrl(endpoint: string, baseUrl?: string): string {
  const base = baseUrl ?? BASE_URL;
  // Ensure no double slashes
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${cleanBase}${cleanEndpoint}`;
}

/**
 * Create an AbortSignal with timeout.
 */
export function createTimeoutSignal(ms: number, existingSignal?: AbortSignal): AbortSignal {
  const controller = new AbortController();

  // Set timeout
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${ms}ms`));
  }, ms);

  // If there's an existing signal, abort when it aborts
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

  // Clean up timeout when aborted
  controller.signal.addEventListener('abort', () => {
    clearTimeout(timeoutId);
  });

  return controller.signal;
}

/**
 * Execute an OpenAI API request.
 *
 * @param endpoint - API endpoint (e.g., "/chat/completions")
 * @param body - Request body
 * @param options - Request options
 * @returns Response object
 * @throws OpenAIError on failure
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
          throw OpenAIError.timeout(timeout);
        }
        // Re-throw user-initiated abort
        throw error;
      }
      throw OpenAIError.networkError(error);
    }
    throw error;
  }

  if (!response.ok) {
    throw await OpenAIError.fromResponse(response);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw OpenAIError.invalidResponse('Failed to parse response JSON');
  }
}

/**
 * Execute an OpenAI API request and return raw response (for streaming).
 *
 * @param endpoint - API endpoint
 * @param body - Request body
 * @param options - Request options
 * @returns Raw Response object
 * @throws OpenAIError on failure
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
          throw OpenAIError.timeout(timeout);
        }
        throw error;
      }
      throw OpenAIError.networkError(error);
    }
    throw error;
  }

  if (!response.ok) {
    throw await OpenAIError.fromResponse(response);
  }

  return response;
}

/**
 * Execute a GET request to OpenAI API.
 *
 * @param endpoint - API endpoint
 * @param options - Request options
 * @returns Parsed response
 * @throws OpenAIError on failure
 */
export async function requestGet<T>(endpoint: string, options: RequestOptions): Promise<T> {
  const { apiKey, baseUrl, timeout = DEFAULT_TIMEOUT, headers: extraHeaders, signal } = options;

  const url = buildUrl(endpoint, baseUrl);
  const headers = buildHeaders(apiKey, extraHeaders);
  // Remove Content-Type for GET requests
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
          throw OpenAIError.timeout(timeout);
        }
        throw error;
      }
      throw OpenAIError.networkError(error);
    }
    throw error;
  }

  if (!response.ok) {
    throw await OpenAIError.fromResponse(response);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw OpenAIError.invalidResponse('Failed to parse response JSON');
  }
}
