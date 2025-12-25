/**
 * Tests for xAI request utilities.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import type { XAIError } from './errors.js';
import {
  BASE_URL,
  buildHeaders,
  buildUrl,
  DEFAULT_TIMEOUT,
  request,
  requestGet,
  requestRaw,
} from './request.js';

describe('request utilities', () => {
  describe('BASE_URL', () => {
    it('should be the xAI API URL', () => {
      assert.equal(BASE_URL, 'https://api.x.ai/v1');
    });
  });

  describe('DEFAULT_TIMEOUT', () => {
    it('should be 60 seconds', () => {
      assert.equal(DEFAULT_TIMEOUT, 60_000);
    });
  });

  describe('buildHeaders', () => {
    it('should include Authorization header with Bearer token', () => {
      const headers = buildHeaders('xai-test-key');
      assert.equal(headers.get('Authorization'), 'Bearer xai-test-key');
    });

    it('should include content-type header', () => {
      const headers = buildHeaders('xai-test-key');
      assert.equal(headers.get('Content-Type'), 'application/json');
    });

    it('should merge extra headers', () => {
      const headers = buildHeaders('xai-test-key', { 'X-Custom': 'value' });
      assert.equal(headers.get('X-Custom'), 'value');
    });
  });

  describe('buildUrl', () => {
    it('should build URL with default base', () => {
      const url = buildUrl('/chat/completions');
      assert.equal(url, 'https://api.x.ai/v1/chat/completions');
    });

    it('should build URL with custom base', () => {
      const url = buildUrl('/chat/completions', 'https://custom.api.com');
      assert.equal(url, 'https://custom.api.com/chat/completions');
    });

    it('should handle base with trailing slash', () => {
      const url = buildUrl('/chat/completions', 'https://custom.api.com/');
      assert.equal(url, 'https://custom.api.com/chat/completions');
    });

    it('should handle endpoint without leading slash', () => {
      const url = buildUrl('chat/completions');
      assert.equal(url, 'https://api.x.ai/v1/chat/completions');
    });
  });
});

describe('request functions with mocked fetch', () => {
  let originalFetch: typeof globalThis.fetch;
  let mockFetch: ReturnType<typeof mock.fn<typeof fetch>>;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockFetch = mock.fn<typeof fetch>();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('request()', () => {
    it('should make POST request with correct headers', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify({ id: 'chatcmpl-123' }), { status: 200 });
      });

      const result = await request<{ id: string }>(
        '/chat/completions',
        { data: 'value' },
        { apiKey: 'xai-test' },
      );

      assert.equal(result.id, 'chatcmpl-123');
      assert.equal(mockFetch.mock.callCount(), 1);

      const [url, options] = mockFetch.mock.calls[0].arguments;
      assert.equal(url, 'https://api.x.ai/v1/chat/completions');
      assert.equal(options?.method, 'POST');

      const headers = options?.headers as Headers;
      assert.equal(headers.get('Authorization'), 'Bearer xai-test');
    });

    it('should throw XAIError on non-ok response', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            error: { message: 'Invalid', type: 'invalid_request_error' },
          }),
          { status: 400 },
        );
      });

      await assert.rejects(
        async () => request('/chat/completions', {}, { apiKey: 'xai-test' }),
        (error: XAIError) => {
          assert.equal(error.status, 400);
          assert.equal(error.message, 'Invalid');
          return true;
        },
      );
    });

    it('should throw XAIError on network error', async () => {
      mockFetch.mock.mockImplementation(async () => {
        throw new Error('Connection refused');
      });

      await assert.rejects(
        async () => request('/chat/completions', {}, { apiKey: 'xai-test' }),
        (error: XAIError) => {
          assert.ok(error.message.includes('Connection refused'));
          return true;
        },
      );
    });
  });

  describe('requestRaw()', () => {
    it('should return raw Response object', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response('raw data', { status: 200 });
      });

      const response = await requestRaw('/chat/completions', {}, { apiKey: 'xai-test' });

      assert.ok(response instanceof Response);
      assert.equal(await response.text(), 'raw data');
    });
  });

  describe('requestGet()', () => {
    it('should make GET request without body', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      });

      const result = await requestGet<{ data: unknown[] }>('/models', { apiKey: 'xai-test' });

      assert.deepEqual(result, { data: [] });

      const [, options] = mockFetch.mock.calls[0].arguments;
      assert.equal(options?.method, 'GET');
      assert.equal(options?.body, undefined);
    });

    it('should not include Content-Type header', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify({}), { status: 200 });
      });

      await requestGet('/models', { apiKey: 'xai-test' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const headers = options?.headers as Headers;
      assert.equal(headers.get('Content-Type'), null);
    });
  });
});
