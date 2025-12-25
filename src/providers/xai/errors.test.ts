/**
 * Tests for xAI error handling.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isXAIError, XAIError } from './errors.js';

describe('XAIError', () => {
  describe('constructor', () => {
    it('should create error with all properties', () => {
      const headers = new Headers();
      const error = new XAIError(
        'Test error',
        400,
        'invalid_request_error',
        'model',
        'invalid_model',
        headers,
      );

      assert.equal(error.message, 'Test error');
      assert.equal(error.status, 400);
      assert.equal(error.type, 'invalid_request_error');
      assert.equal(error.param, 'model');
      assert.equal(error.code, 'invalid_model');
      assert.equal(error.name, 'XAIError');
      assert.equal(error.headers, headers);
    });

    it('should create error without optional properties', () => {
      const error = new XAIError('Minimal error', 500, 'server_error');

      assert.equal(error.message, 'Minimal error');
      assert.equal(error.status, 500);
      assert.equal(error.type, 'server_error');
      assert.equal(error.param, undefined);
      assert.equal(error.code, undefined);
    });
  });

  describe('isRateLimited', () => {
    it('should return true for rate_limit_error type', () => {
      const error = new XAIError('Rate limited', 429, 'rate_limit_error');
      assert.equal(error.isRateLimited, true);
    });

    it('should return true for 429 status', () => {
      const error = new XAIError('Rate limited', 429, 'server_error');
      assert.equal(error.isRateLimited, true);
    });

    it('should return false for other errors', () => {
      const error = new XAIError('Bad request', 400, 'invalid_request_error');
      assert.equal(error.isRateLimited, false);
    });
  });

  describe('isAuthError', () => {
    it('should return true for authentication_error type', () => {
      const error = new XAIError('Unauthorized', 401, 'authentication_error');
      assert.equal(error.isAuthError, true);
    });

    it('should return true for 401 status', () => {
      const error = new XAIError('Unauthorized', 401, 'invalid_request_error');
      assert.equal(error.isAuthError, true);
    });

    it('should return false for other errors', () => {
      const error = new XAIError('Bad request', 400, 'invalid_request_error');
      assert.equal(error.isAuthError, false);
    });
  });

  describe('isServerError', () => {
    it('should return true for 500+ status', () => {
      const error = new XAIError('Server error', 500, 'invalid_request_error');
      assert.equal(error.isServerError, true);
    });

    it('should return true for server_error type', () => {
      const error = new XAIError('Server error', 200, 'server_error');
      assert.equal(error.isServerError, true);
    });

    it('should return false for client errors', () => {
      const error = new XAIError('Bad request', 400, 'invalid_request_error');
      assert.equal(error.isServerError, false);
    });
  });

  describe('isRetryable', () => {
    it('should return true for rate limited errors', () => {
      const error = new XAIError('Rate limited', 429, 'rate_limit_error');
      assert.equal(error.isRetryable, true);
    });

    it('should return true for server errors', () => {
      const error = new XAIError('Server error', 500, 'server_error');
      assert.equal(error.isRetryable, true);
    });

    it('should return false for client errors', () => {
      const error = new XAIError('Bad request', 400, 'invalid_request_error');
      assert.equal(error.isRetryable, false);
    });
  });

  describe('rate limit headers', () => {
    it('should parse retry-after header', () => {
      const headers = new Headers({ 'retry-after': '30' });
      const error = new XAIError(
        'Rate limited',
        429,
        'rate_limit_error',
        undefined,
        undefined,
        headers,
      );
      assert.equal(error.retryAfter, 30);
    });

    it('should parse remaining-requests header', () => {
      const headers = new Headers({ 'x-ratelimit-remaining-requests': '100' });
      const error = new XAIError(
        'Rate limited',
        429,
        'rate_limit_error',
        undefined,
        undefined,
        headers,
      );
      assert.equal(error.remainingRequests, 100);
    });

    it('should parse remaining-tokens header', () => {
      const headers = new Headers({ 'x-ratelimit-remaining-tokens': '50000' });
      const error = new XAIError(
        'Rate limited',
        429,
        'rate_limit_error',
        undefined,
        undefined,
        headers,
      );
      assert.equal(error.remainingTokens, 50000);
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

      const error = await XAIError.fromResponse(response);

      assert.equal(error.message, 'Invalid model');
      assert.equal(error.status, 400);
      assert.equal(error.type, 'invalid_request_error');
      assert.equal(error.param, 'model');
      assert.equal(error.code, 'invalid_model');
    });

    it('should handle non-JSON response', async () => {
      const response = new Response('Internal Server Error', { status: 500 });

      const error = await XAIError.fromResponse(response);

      assert.equal(error.message, 'Request failed with status 500');
      assert.equal(error.status, 500);
      assert.equal(error.type, 'server_error');
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
      [503, 'server_error'],
    ];

    for (const [status, expected] of cases) {
      it(`should return ${expected} for status ${status}`, () => {
        assert.equal(XAIError.typeFromStatus(status), expected);
      });
    }
  });

  describe('factory methods', () => {
    it('networkError should create error with network details', () => {
      const cause = new Error('Connection refused');
      const error = XAIError.networkError(cause);

      assert.equal(error.message, 'Network error: Connection refused');
      assert.equal(error.status, 0);
      assert.equal(error.cause, cause);
    });

    it('timeout should create error with timeout message', () => {
      const error = XAIError.timeout(30000);

      assert.equal(error.message, 'Request timed out after 30000ms');
      assert.equal(error.status, 0);
    });

    it('invalidResponse should create error with response details', () => {
      const error = XAIError.invalidResponse('Unexpected JSON');

      assert.equal(error.message, 'Unexpected JSON');
      assert.equal(error.type, 'server_error');
    });
  });
});

describe('isXAIError', () => {
  it('should return true for XAIError instances', () => {
    const error = new XAIError('Test', 400, 'invalid_request_error');
    assert.equal(isXAIError(error), true);
  });

  it('should return false for regular Error', () => {
    const error = new Error('Regular error');
    assert.equal(isXAIError(error), false);
  });

  it('should return false for non-errors', () => {
    assert.equal(isXAIError(null), false);
    assert.equal(isXAIError(undefined), false);
    assert.equal(isXAIError('string'), false);
    assert.equal(isXAIError({}), false);
  });
});
