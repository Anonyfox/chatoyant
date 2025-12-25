/**
 * xAI API error handling.
 *
 * xAI uses OpenAI-compatible error format.
 *
 * @module providers/xai/errors
 */

import type { APIErrorResponse, ErrorType } from './types.js';

/**
 * Error thrown when an xAI API request fails.
 */
export class XAIError extends Error {
  /** HTTP status code */
  readonly status: number;
  /** Error type */
  readonly type: ErrorType;
  /** Optional parameter that caused the error */
  readonly param?: string;
  /** Optional error code */
  readonly code?: string;
  /** Original response headers */
  readonly headers?: Headers;

  constructor(
    message: string,
    status: number,
    type: ErrorType,
    param?: string,
    code?: string,
    headers?: Headers,
  ) {
    super(message);
    this.name = 'XAIError';
    this.status = status;
    this.type = type;
    this.param = param;
    this.code = code;
    this.headers = headers;
  }

  /**
   * Check if this is a rate limit error.
   */
  get isRateLimited(): boolean {
    return this.type === 'rate_limit_error' || this.status === 429;
  }

  /**
   * Check if this is an authentication error.
   */
  get isAuthError(): boolean {
    return this.type === 'authentication_error' || this.status === 401;
  }

  /**
   * Check if this is a server error (retryable).
   */
  get isServerError(): boolean {
    return this.status >= 500 || this.type === 'server_error';
  }

  /**
   * Check if this error is potentially retryable.
   */
  get isRetryable(): boolean {
    return this.isRateLimited || this.isServerError;
  }

  /**
   * Get retry-after value from headers (in seconds).
   */
  get retryAfter(): number | undefined {
    const value = this.headers?.get('retry-after');
    if (value) {
      const seconds = Number.parseInt(value, 10);
      if (!Number.isNaN(seconds)) {
        return seconds;
      }
    }
    return undefined;
  }

  /**
   * Get remaining requests from rate limit headers.
   */
  get remainingRequests(): number | undefined {
    const value = this.headers?.get('x-ratelimit-remaining-requests');
    if (value) {
      const num = Number.parseInt(value, 10);
      if (!Number.isNaN(num)) {
        return num;
      }
    }
    return undefined;
  }

  /**
   * Get remaining tokens from rate limit headers.
   */
  get remainingTokens(): number | undefined {
    const value = this.headers?.get('x-ratelimit-remaining-tokens');
    if (value) {
      const num = Number.parseInt(value, 10);
      if (!Number.isNaN(num)) {
        return num;
      }
    }
    return undefined;
  }

  /**
   * Create error from API response.
   */
  static async fromResponse(response: Response): Promise<XAIError> {
    let errorData: APIErrorResponse | null = null;

    try {
      errorData = (await response.json()) as APIErrorResponse;
    } catch {
      // Response body wasn't valid JSON
    }

    if (errorData?.error) {
      return new XAIError(
        errorData.error.message,
        response.status,
        errorData.error.type,
        errorData.error.param,
        errorData.error.code,
        response.headers,
      );
    }

    // Fallback for non-standard error responses
    return new XAIError(
      `Request failed with status ${response.status}`,
      response.status,
      XAIError.typeFromStatus(response.status),
      undefined,
      undefined,
      response.headers,
    );
  }

  /**
   * Infer error type from HTTP status code.
   */
  static typeFromStatus(status: number): ErrorType {
    switch (status) {
      case 400:
        return 'invalid_request_error';
      case 401:
        return 'authentication_error';
      case 403:
        return 'permission_error';
      case 404:
        return 'not_found_error';
      case 429:
        return 'rate_limit_error';
      default:
        return status >= 500 ? 'server_error' : 'invalid_request_error';
    }
  }

  /**
   * Create error for network failures.
   */
  static networkError(cause: Error): XAIError {
    const error = new XAIError(`Network error: ${cause.message}`, 0, 'server_error');
    error.cause = cause;
    return error;
  }

  /**
   * Create error for timeout.
   */
  static timeout(ms: number): XAIError {
    return new XAIError(`Request timed out after ${ms}ms`, 0, 'server_error');
  }

  /**
   * Create error for invalid response format.
   */
  static invalidResponse(message: string): XAIError {
    return new XAIError(message, 0, 'server_error');
  }
}

/**
 * Check if a value is an XAIError.
 */
export function isXAIError(error: unknown): error is XAIError {
  return error instanceof XAIError;
}
