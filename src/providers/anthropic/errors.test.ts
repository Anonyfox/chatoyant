/**
 * Tests for Anthropic error handling.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AnthropicError, isAnthropicError } from './errors.js';

describe('AnthropicError', () => {
  describe('constructor', () => {
    it('should create error with all properties', () => {
      const headers = new Headers();
      const error = new AnthropicError('Test error', 400, 'invalid_request_error', headers);

      assert.equal(error.message, 'Test error');
      assert.equal(error.status, 400);
      assert.equal(error.type, 'invalid_request_error');
      assert.equal(error.name, 'AnthropicError');
      assert.equal(error.headers, headers);
    });

    it('should create error without headers', () => {
      const error = new AnthropicError('Minimal error', 500, 'api_error');

      assert.equal(error.message, 'Minimal error');
      assert.equal(error.status, 500);
      assert.equal(error.type, 'api_error');
      assert.equal(error.headers, undefined);
    });
  });

  describe('isRateLimited', () => {
    it('should return true for rate_limit_error type', () => {
      const error = new AnthropicError('Rate limited', 429, 'rate_limit_error');
      assert.equal(error.isRateLimited, true);
    });

    it('should return true for 429 status', () => {
      const error = new AnthropicError('Rate limited', 429, 'api_error');
      assert.equal(error.isRateLimited, true);
    });

    it('should return false for other errors', () => {
      const error = new AnthropicError('Bad request', 400, 'invalid_request_error');
      assert.equal(error.isRateLimited, false);
    });
  });

  describe('isAuthError', () => {
    it('should return true for authentication_error type', () => {
      const error = new AnthropicError('Unauthorized', 401, 'authentication_error');
      assert.equal(error.isAuthError, true);
    });

    it('should return true for 401 status', () => {
      const error = new AnthropicError('Unauthorized', 401, 'invalid_request_error');
      assert.equal(error.isAuthError, true);
    });

    it('should return false for other errors', () => {
      const error = new AnthropicError('Bad request', 400, 'invalid_request_error');
      assert.equal(error.isAuthError, false);
    });
  });

  describe('isServerError', () => {
    it('should return true for 500+ status', () => {
      const error = new AnthropicError('Server error', 500, 'invalid_request_error');
      assert.equal(error.isServerError, true);
    });

    it('should return true for api_error type', () => {
      const error = new AnthropicError('API error', 200, 'api_error');
      assert.equal(error.isServerError, true);
    });

    it('should return true for overloaded_error type', () => {
      const error = new AnthropicError('Overloaded', 529, 'overloaded_error');
      assert.equal(error.isServerError, true);
    });

    it('should return false for client errors', () => {
      const error = new AnthropicError('Bad request', 400, 'invalid_request_error');
      assert.equal(error.isServerError, false);
    });
  });

  describe('isRetryable', () => {
    it('should return true for rate limited errors', () => {
      const error = new AnthropicError('Rate limited', 429, 'rate_limit_error');
      assert.equal(error.isRetryable, true);
    });

    it('should return true for server errors', () => {
      const error = new AnthropicError('Server error', 500, 'api_error');
      assert.equal(error.isRetryable, true);
    });

    it('should return false for client errors', () => {
      const error = new AnthropicError('Bad request', 400, 'invalid_request_error');
      assert.equal(error.isRetryable, false);
    });
  });

  describe('retryAfter', () => {
    it('should return seconds from retry-after header', () => {
      const headers = new Headers({ 'retry-after': '30' });
      const error = new AnthropicError('Rate limited', 429, 'rate_limit_error', headers);
      assert.equal(error.retryAfter, 30);
    });

    it('should return undefined when no header', () => {
      const error = new AnthropicError('Rate limited', 429, 'rate_limit_error');
      assert.equal(error.retryAfter, undefined);
    });

    it('should return undefined for invalid header', () => {
      const headers = new Headers({ 'retry-after': 'invalid' });
      const error = new AnthropicError('Rate limited', 429, 'rate_limit_error', headers);
      assert.equal(error.retryAfter, undefined);
    });
  });

  describe('fromResponse', () => {
    it('should parse standard API error response', async () => {
      const response = new Response(
        JSON.stringify({
          type: 'error',
          error: { type: 'invalid_request_error', message: 'Invalid model' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );

      const error = await AnthropicError.fromResponse(response);

      assert.equal(error.message, 'Invalid model');
      assert.equal(error.status, 400);
      assert.equal(error.type, 'invalid_request_error');
    });

    it('should handle non-JSON response', async () => {
      const response = new Response('Internal Server Error', { status: 500 });

      const error = await AnthropicError.fromResponse(response);

      assert.equal(error.message, 'Request failed with status 500');
      assert.equal(error.status, 500);
      assert.equal(error.type, 'api_error');
    });
  });

  describe('typeFromStatus', () => {
    const cases: Array<[number, string]> = [
      [400, 'invalid_request_error'],
      [401, 'authentication_error'],
      [403, 'permission_error'],
      [404, 'not_found_error'],
      [413, 'request_too_large'],
      [429, 'rate_limit_error'],
      [529, 'overloaded_error'],
      [500, 'api_error'],
      [502, 'api_error'],
    ];

    for (const [status, expected] of cases) {
      it(`should return ${expected} for status ${status}`, () => {
        assert.equal(AnthropicError.typeFromStatus(status), expected);
      });
    }
  });

  describe('factory methods', () => {
    it('networkError should create error with network details', () => {
      const cause = new Error('Connection refused');
      const error = AnthropicError.networkError(cause);

      assert.equal(error.message, 'Network error: Connection refused');
      assert.equal(error.status, 0);
      assert.equal(error.cause, cause);
    });

    it('timeout should create error with timeout message', () => {
      const error = AnthropicError.timeout(30000);

      assert.equal(error.message, 'Request timed out after 30000ms');
      assert.equal(error.status, 0);
    });

    it('invalidResponse should create error with response details', () => {
      const error = AnthropicError.invalidResponse('Unexpected JSON');

      assert.equal(error.message, 'Unexpected JSON');
      assert.equal(error.type, 'api_error');
    });
  });
});

describe('isAnthropicError', () => {
  it('should return true for AnthropicError instances', () => {
    const error = new AnthropicError('Test', 400, 'invalid_request_error');
    assert.equal(isAnthropicError(error), true);
  });

  it('should return false for regular Error', () => {
    const error = new Error('Regular error');
    assert.equal(isAnthropicError(error), false);
  });

  it('should return false for non-errors', () => {
    assert.equal(isAnthropicError(null), false);
    assert.equal(isAnthropicError(undefined), false);
    assert.equal(isAnthropicError('string'), false);
    assert.equal(isAnthropicError({}), false);
  });
});
