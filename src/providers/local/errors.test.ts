/**
 * Tests for local provider error handling.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OpenAIError } from '../openai/errors.js';
import { isLocalError, LocalError } from './errors.js';

describe('providers/local/errors', () => {
  describe('LocalError', () => {
    it('should be an instance of OpenAIError', () => {
      const error = new LocalError('test', 500, 'server_error');
      assert.ok(error instanceof OpenAIError);
      assert.ok(error instanceof LocalError);
    });

    it('should have name "LocalError"', () => {
      const error = new LocalError('test', 500, 'server_error');
      assert.equal(error.name, 'LocalError');
    });

    it('should preserve status and type', () => {
      const error = new LocalError('bad request', 400, 'invalid_request_error', 'param', 'code');
      assert.equal(error.status, 400);
      assert.equal(error.type, 'invalid_request_error');
      assert.equal(error.param, 'param');
      assert.equal(error.code, 'code');
    });

    it('networkError() factory should return LocalError', () => {
      const cause = new Error('ECONNREFUSED');
      const error = LocalError.networkError(cause);
      assert.ok(error instanceof LocalError);
      assert.ok(error.message.includes('ECONNREFUSED'));
      assert.equal(error.code, 'network_error');
    });

    it('timeout() factory should return LocalError', () => {
      const error = LocalError.timeout(5000);
      assert.ok(error instanceof LocalError);
      assert.ok(error.message.includes('5000'));
      assert.equal(error.code, 'timeout');
    });

    it('invalidResponse() factory should return LocalError', () => {
      const error = LocalError.invalidResponse('bad json');
      assert.ok(error instanceof LocalError);
      assert.ok(error.message.includes('bad json'));
      assert.equal(error.code, 'invalid_response');
    });

    it('fromResponse() should create LocalError from HTTP response', async () => {
      const body = JSON.stringify({
        error: { message: 'Not found', type: 'not_found_error' },
      });
      const response = new Response(body, { status: 404 });
      const error = await LocalError.fromResponse(response);
      assert.ok(error instanceof LocalError);
      assert.equal(error.status, 404);
      assert.equal(error.message, 'Not found');
    });

    it('isRetryable should work for rate limit errors', () => {
      const error = new LocalError('rate limited', 429, 'rate_limit_error');
      assert.equal(error.isRateLimited, true);
      assert.equal(error.isRetryable, true);
    });

    it('isAuthError should work for 401', () => {
      const error = new LocalError('unauthorized', 401, 'authentication_error');
      assert.equal(error.isAuthError, true);
    });
  });

  describe('isLocalError', () => {
    it('should return true for LocalError', () => {
      assert.equal(isLocalError(new LocalError('test', 0, 'server_error')), true);
    });

    it('should return true for LocalError (also instanceof OpenAIError)', () => {
      const e = new LocalError('test', 0, 'server_error');
      assert.equal(isLocalError(e), true);
    });

    it('should return false for plain OpenAIError', () => {
      assert.equal(isLocalError(new OpenAIError('test', 0, 'server_error')), false);
    });

    it('should return false for generic errors', () => {
      assert.equal(isLocalError(new Error('test')), false);
      assert.equal(isLocalError(null), false);
      assert.equal(isLocalError('string'), false);
    });
  });
});
