/**
 * Tests for OpenAI error handling.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isOpenAIError, OpenAIError } from './errors.js';

describe('OpenAIError', () => {
  describe('constructor', () => {
    it('should create error with all properties', () => {
      const error = new OpenAIError(
        'Test error',
        400,
        'invalid_request_error',
        'model',
        'invalid_model',
      );

      assert.equal(error.message, 'Test error');
      assert.equal(error.status, 400);
      assert.equal(error.type, 'invalid_request_error');
      assert.equal(error.param, 'model');
      assert.equal(error.code, 'invalid_model');
      assert.equal(error.name, 'OpenAIError');
    });

    it('should create error with minimal properties', () => {
      const error = new OpenAIError('Minimal error', 500, 'server_error');

      assert.equal(error.message, 'Minimal error');
      assert.equal(error.status, 500);
      assert.equal(error.type, 'server_error');
      assert.equal(error.param, undefined);
      assert.equal(error.code, undefined);
    });
  });

  describe('isRateLimited', () => {
    it('should return true for rate_limit_error type', () => {
      const error = new OpenAIError('Rate limited', 429, 'rate_limit_error');
      assert.equal(error.isRateLimited, true);
    });

    it('should return true for 429 status', () => {
      const error = new OpenAIError('Rate limited', 429, 'server_error');
      assert.equal(error.isRateLimited, true);
    });

    it('should return false for other errors', () => {
      const error = new OpenAIError('Bad request', 400, 'invalid_request_error');
      assert.equal(error.isRateLimited, false);
    });
  });

  describe('isAuthError', () => {
    it('should return true for authentication_error type', () => {
      const error = new OpenAIError('Unauthorized', 401, 'authentication_error');
      assert.equal(error.isAuthError, true);
    });

    it('should return true for 401 status', () => {
      const error = new OpenAIError('Unauthorized', 401, 'invalid_request_error');
      assert.equal(error.isAuthError, true);
    });

    it('should return false for other errors', () => {
      const error = new OpenAIError('Bad request', 400, 'invalid_request_error');
      assert.equal(error.isAuthError, false);
    });
  });

  describe('isServerError', () => {
    it('should return true for 500+ status', () => {
      const error = new OpenAIError('Server error', 500, 'invalid_request_error');
      assert.equal(error.isServerError, true);
    });

    it('should return true for server_error type', () => {
      const error = new OpenAIError('Server error', 200, 'server_error');
      assert.equal(error.isServerError, true);
    });

    it('should return true for engine_overloaded_error type', () => {
      const error = new OpenAIError('Overloaded', 503, 'engine_overloaded_error');
      assert.equal(error.isServerError, true);
    });

    it('should return false for client errors', () => {
      const error = new OpenAIError('Bad request', 400, 'invalid_request_error');
      assert.equal(error.isServerError, false);
    });
  });

  describe('isRetryable', () => {
    it('should return true for rate limited errors', () => {
      const error = new OpenAIError('Rate limited', 429, 'rate_limit_error');
      assert.equal(error.isRetryable, true);
    });

    it('should return true for server errors', () => {
      const error = new OpenAIError('Server error', 500, 'server_error');
      assert.equal(error.isRetryable, true);
    });

    it('should return false for client errors', () => {
      const error = new OpenAIError('Bad request', 400, 'invalid_request_error');
      assert.equal(error.isRetryable, false);
    });
  });

  describe('retryAfter', () => {
    it('should return seconds from retry-after header', () => {
      const headers = new Headers({ 'retry-after': '30' });
      const error = new OpenAIError(
        'Rate limited',
        429,
        'rate_limit_error',
        undefined,
        undefined,
        headers,
      );
      assert.equal(error.retryAfter, 30);
    });

    it('should return undefined when no header', () => {
      const error = new OpenAIError('Rate limited', 429, 'rate_limit_error');
      assert.equal(error.retryAfter, undefined);
    });

    it('should return undefined for invalid header', () => {
      const headers = new Headers({ 'retry-after': 'invalid' });
      const error = new OpenAIError(
        'Rate limited',
        429,
        'rate_limit_error',
        undefined,
        undefined,
        headers,
      );
      assert.equal(error.retryAfter, undefined);
    });
  });

  describe('fromResponse', () => {
    it('should parse standard API error response', async () => {
      const response = new Response(
        JSON.stringify({
          error: {
            message: 'Invalid model',
            type: 'invalid_request_error',
            param: 'model',
            code: 'invalid_model',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );

      const error = await OpenAIError.fromResponse(response);

      assert.equal(error.message, 'Invalid model');
      assert.equal(error.status, 400);
      assert.equal(error.type, 'invalid_request_error');
      assert.equal(error.param, 'model');
      assert.equal(error.code, 'invalid_model');
    });

    it('should handle non-JSON response', async () => {
      const response = new Response('Internal Server Error', { status: 500 });

      const error = await OpenAIError.fromResponse(response);

      assert.equal(error.message, 'Request failed with status 500');
      assert.equal(error.status, 500);
      assert.equal(error.type, 'server_error');
    });

    it('should handle empty response', async () => {
      const response = new Response('', { status: 404 });

      const error = await OpenAIError.fromResponse(response);

      assert.equal(error.status, 404);
      assert.equal(error.type, 'not_found_error');
    });
  });

  describe('typeFromStatus', () => {
    const cases: Array<[number, string]> = [
      [400, 'invalid_request_error'],
      [401, 'authentication_error'],
      [403, 'permission_error'],
      [404, 'not_found_error'],
      [429, 'rate_limit_error'],
      [500, 'server_error'],
      [502, 'server_error'],
      [503, 'server_error'],
      [422, 'invalid_request_error'], // Unknown 4xx
    ];

    for (const [status, expected] of cases) {
      it(`should return ${expected} for status ${status}`, () => {
        assert.equal(OpenAIError.typeFromStatus(status), expected);
      });
    }
  });

  describe('factory methods', () => {
    it('networkError should create error with network details', () => {
      const cause = new Error('Connection refused');
      const error = OpenAIError.networkError(cause);

      assert.equal(error.message, 'Network error: Connection refused');
      assert.equal(error.status, 0);
      assert.equal(error.code, 'network_error');
      assert.equal(error.cause, cause);
    });

    it('timeout should create error with timeout message', () => {
      const error = OpenAIError.timeout(30000);

      assert.equal(error.message, 'Request timed out after 30000ms');
      assert.equal(error.status, 0);
      assert.equal(error.code, 'timeout');
    });

    it('invalidResponse should create error with response details', () => {
      const error = OpenAIError.invalidResponse('Unexpected JSON');

      assert.equal(error.message, 'Unexpected JSON');
      assert.equal(error.code, 'invalid_response');
    });
  });
});

describe('isOpenAIError', () => {
  it('should return true for OpenAIError instances', () => {
    const error = new OpenAIError('Test', 400, 'invalid_request_error');
    assert.equal(isOpenAIError(error), true);
  });

  it('should return false for regular Error', () => {
    const error = new Error('Regular error');
    assert.equal(isOpenAIError(error), false);
  });

  it('should return false for non-errors', () => {
    assert.equal(isOpenAIError(null), false);
    assert.equal(isOpenAIError(undefined), false);
    assert.equal(isOpenAIError('string'), false);
    assert.equal(isOpenAIError({}), false);
  });
});
