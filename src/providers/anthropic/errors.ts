/**
 * Anthropic API error handling.
 *
 * @module providers/anthropic/errors
 */

import type { APIErrorResponse, ErrorType } from './types.js';

/**
 * Error thrown when an Anthropic API request fails.
 */
export class AnthropicError extends Error {
  /** HTTP status code */
  readonly status: number;
  /** Anthropic error type */
  readonly type: ErrorType;
  /** Original response headers */
  readonly headers?: Headers;

  constructor(message: string, status: number, type: ErrorType, headers?: Headers) {
    super(message);
    this.name = 'AnthropicError';
    this.status = status;
    this.type = type;
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
    return this.status >= 500 || this.type === 'api_error' || this.type === 'overloaded_error';
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
   * Create error from API response.
   */
  static async fromResponse(response: Response): Promise<AnthropicError> {
    let errorData: APIErrorResponse | null = null;

    try {
      errorData = (await response.json()) as APIErrorResponse;
    } catch {
      // Response body wasn't valid JSON
    }

    if (errorData?.error) {
      return new AnthropicError(
        errorData.error.message,
        response.status,
        errorData.error.type,
        response.headers,
      );
    }

    // Fallback for non-standard error responses
    return new AnthropicError(
      `Request failed with status ${response.status}`,
      response.status,
      AnthropicError.typeFromStatus(response.status),
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
      case 413:
        return 'request_too_large';
      case 429:
        return 'rate_limit_error';
      case 529:
        return 'overloaded_error';
      default:
        return status >= 500 ? 'api_error' : 'invalid_request_error';
    }
  }

  /**
   * Create error for network failures.
   */
  static networkError(cause: Error): AnthropicError {
    const error = new AnthropicError(`Network error: ${cause.message}`, 0, 'api_error');
    error.cause = cause;
    return error;
  }

  /**
   * Create error for timeout.
   */
  static timeout(ms: number): AnthropicError {
    return new AnthropicError(`Request timed out after ${ms}ms`, 0, 'api_error');
  }

  /**
   * Create error for invalid response format.
   */
  static invalidResponse(message: string): AnthropicError {
    return new AnthropicError(message, 0, 'api_error');
  }
}

/**
 * Check if a value is an AnthropicError.
 */
export function isAnthropicError(error: unknown): error is AnthropicError {
  return error instanceof AnthropicError;
}
