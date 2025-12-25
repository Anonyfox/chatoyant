/**
 * Tests for Anthropic request utilities.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import type { AnthropicError } from './errors.js';
import {
  API_VERSION,
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
    it('should be the Anthropic API URL', () => {
      assert.equal(BASE_URL, 'https://api.anthropic.com/v1');
    });
  });

  describe('DEFAULT_TIMEOUT', () => {
    it('should be 60 seconds', () => {
      assert.equal(DEFAULT_TIMEOUT, 60_000);
    });
  });

  describe('API_VERSION', () => {
    it('should be the current API version', () => {
      assert.equal(API_VERSION, '2023-06-01');
    });
  });

  describe('buildHeaders', () => {
    it('should include x-api-key header', () => {
      const headers = buildHeaders('sk-ant-test-key');
      assert.equal(headers.get('x-api-key'), 'sk-ant-test-key');
    });

    it('should include anthropic-version header', () => {
      const headers = buildHeaders('sk-ant-test-key');
      assert.equal(headers.get('anthropic-version'), '2023-06-01');
    });

    it('should include content-type header', () => {
      const headers = buildHeaders('sk-ant-test-key');
      assert.equal(headers.get('Content-Type'), 'application/json');
    });

    it('should include anthropic-beta header when betas provided', () => {
      const headers = buildHeaders('sk-ant-test-key', [
        'prompt-caching-2024-07-31',
        'pdfs-2024-09-25',
      ]);
      assert.equal(headers.get('anthropic-beta'), 'prompt-caching-2024-07-31,pdfs-2024-09-25');
    });

    it('should not include anthropic-beta when no betas', () => {
      const headers = buildHeaders('sk-ant-test-key');
      assert.equal(headers.get('anthropic-beta'), null);
    });

    it('should merge extra headers', () => {
      const headers = buildHeaders('sk-ant-test-key', undefined, { 'X-Custom': 'value' });
      assert.equal(headers.get('X-Custom'), 'value');
    });
  });

  describe('buildUrl', () => {
    it('should build URL with default base', () => {
      const url = buildUrl('/messages');
      assert.equal(url, 'https://api.anthropic.com/v1/messages');
    });

    it('should build URL with custom base', () => {
      const url = buildUrl('/messages', 'https://custom.api.com');
      assert.equal(url, 'https://custom.api.com/messages');
    });

    it('should handle base with trailing slash', () => {
      const url = buildUrl('/messages', 'https://custom.api.com/');
      assert.equal(url, 'https://custom.api.com/messages');
    });

    it('should handle endpoint without leading slash', () => {
      const url = buildUrl('messages');
      assert.equal(url, 'https://api.anthropic.com/v1/messages');
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
        return new Response(JSON.stringify({ id: 'msg_123' }), { status: 200 });
      });

      const result = await request<{ id: string }>(
        '/messages',
        { data: 'value' },
        { apiKey: 'sk-test' },
      );

      assert.equal(result.id, 'msg_123');
      assert.equal(mockFetch.mock.callCount(), 1);

      const [url, options] = mockFetch.mock.calls[0].arguments;
      assert.equal(url, 'https://api.anthropic.com/v1/messages');
      assert.equal(options?.method, 'POST');

      const headers = options?.headers as Headers;
      assert.equal(headers.get('x-api-key'), 'sk-test');
      assert.equal(headers.get('anthropic-version'), '2023-06-01');
    });

    it('should include beta headers when provided', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify({}), { status: 200 });
      });

      await request('/messages', {}, { apiKey: 'sk-test', betas: ['pdfs-2024-09-25'] });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const headers = options?.headers as Headers;
      assert.equal(headers.get('anthropic-beta'), 'pdfs-2024-09-25');
    });

    it('should throw AnthropicError on non-ok response', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            type: 'error',
            error: { type: 'invalid_request_error', message: 'Invalid' },
          }),
          { status: 400 },
        );
      });

      await assert.rejects(
        async () => request('/messages', {}, { apiKey: 'sk-test' }),
        (error: AnthropicError) => {
          assert.equal(error.status, 400);
          assert.equal(error.message, 'Invalid');
          return true;
        },
      );
    });

    it('should throw AnthropicError on network error', async () => {
      mockFetch.mock.mockImplementation(async () => {
        throw new Error('Connection refused');
      });

      await assert.rejects(
        async () => request('/messages', {}, { apiKey: 'sk-test' }),
        (error: AnthropicError) => {
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

      const response = await requestRaw('/messages', {}, { apiKey: 'sk-test' });

      assert.ok(response instanceof Response);
      assert.equal(await response.text(), 'raw data');
    });
  });

  describe('requestGet()', () => {
    it('should make GET request without body', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      });

      const result = await requestGet<{ data: unknown[] }>('/models', { apiKey: 'sk-test' });

      assert.deepEqual(result, { data: [] });

      const [, options] = mockFetch.mock.calls[0].arguments;
      assert.equal(options?.method, 'GET');
      assert.equal(options?.body, undefined);
    });

    it('should not include Content-Type header', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify({}), { status: 200 });
      });

      await requestGet('/models', { apiKey: 'sk-test' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const headers = options?.headers as Headers;
      assert.equal(headers.get('Content-Type'), null);
    });
  });
});
