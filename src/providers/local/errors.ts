/**
 * Local provider error handling.
 *
 * Thin subclass of OpenAIError with a distinct name so callers can
 * differentiate local-server errors from OpenAI API errors.
 *
 * @module providers/local/errors
 */

import { OpenAIError } from '../openai/errors.js';
import type { ErrorType } from '../openai/types.js';

/**
 * Error thrown when a local provider request fails.
 */
export class LocalError extends OpenAIError {
  constructor(
    message: string,
    status: number,
    type: ErrorType,
    param?: string,
    code?: string,
    headers?: Headers,
  ) {
    super(message, status, type, param, code, headers);
    this.name = 'LocalError';
  }

  static override async fromResponse(response: Response): Promise<LocalError> {
    const base = await OpenAIError.fromResponse(response);
    return new LocalError(
      base.message,
      base.status,
      base.type,
      base.param,
      base.code,
      base.headers,
    );
  }

  static override networkError(cause: Error): LocalError {
    const error = new LocalError(
      `Network error: ${cause.message}`,
      0,
      'server_error',
      undefined,
      'network_error',
    );
    error.cause = cause;
    return error;
  }

  static override timeout(ms: number): LocalError {
    return new LocalError(
      `Request timed out after ${ms}ms`,
      0,
      'server_error',
      undefined,
      'timeout',
    );
  }

  static override invalidResponse(message: string): LocalError {
    return new LocalError(message, 0, 'server_error', undefined, 'invalid_response');
  }
}

/**
 * Check if a value is a LocalError.
 */
export function isLocalError(error: unknown): error is LocalError {
  return error instanceof LocalError;
}
