/**
 * Tests for OpenAI request utilities.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import type { OpenAIError } from './errors.js';
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
    it('should be the OpenAI API URL', () => {
      assert.equal(BASE_URL, 'https://api.openai.com/v1');
    });
  });

  describe('DEFAULT_TIMEOUT', () => {
    it('should be 60 seconds', () => {
      assert.equal(DEFAULT_TIMEOUT, 60_000);
    });
  });

  describe('buildHeaders', () => {
    it('should include authorization header', () => {
      const headers = buildHeaders('sk-test-key');
      assert.equal(headers.get('Authorization'), 'Bearer sk-test-key');
    });

    it('should include content-type header', () => {
      const headers = buildHeaders('sk-test-key');
      assert.equal(headers.get('Content-Type'), 'application/json');
    });

    it('should merge extra headers', () => {
      const headers = buildHeaders('sk-test-key', {
        'X-Custom-Header': 'custom-value',
      });
      assert.equal(headers.get('X-Custom-Header'), 'custom-value');
      assert.equal(headers.get('Authorization'), 'Bearer sk-test-key');
    });

    it('should allow overriding default headers', () => {
      const headers = buildHeaders('sk-test-key', {
        'Content-Type': 'text/plain',
      });
      assert.equal(headers.get('Content-Type'), 'text/plain');
    });
  });

  describe('buildUrl', () => {
    it('should build URL with default base', () => {
      const url = buildUrl('/chat/completions');
      assert.equal(url, 'https://api.openai.com/v1/chat/completions');
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
      assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    });

    it('should handle both trailing and no leading slash', () => {
      const url = buildUrl('chat/completions', 'https://custom.api.com/');
      assert.equal(url, 'https://custom.api.com/chat/completions');
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
    it('should make POST request with correct headers and body', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify({ result: 'success' }), { status: 200 });
      });

      const result = await request<{ result: string }>(
        '/test',
        { data: 'value' },
        { apiKey: 'sk-test' },
      );

      assert.equal(result.result, 'success');
      assert.equal(mockFetch.mock.callCount(), 1);

      const [url, options] = mockFetch.mock.calls[0].arguments;
      assert.equal(url, 'https://api.openai.com/v1/test');
      assert.equal(options?.method, 'POST');
      assert.equal(options?.body, JSON.stringify({ data: 'value' }));
    });

    it('should use custom baseUrl', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify({}), { status: 200 });
      });

      await request('/test', {}, { apiKey: 'sk-test', baseUrl: 'https://custom.api.com' });

      const [url] = mockFetch.mock.calls[0].arguments;
      assert.equal(url, 'https://custom.api.com/test');
    });

    it('should throw OpenAIError on non-ok response', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            error: { message: 'Invalid model', type: 'invalid_request_error' },
          }),
          { status: 400 },
        );
      });

      await assert.rejects(
        async () => request('/test', {}, { apiKey: 'sk-test' }),
        (error: OpenAIError) => {
          assert.equal(error.status, 400);
          assert.equal(error.message, 'Invalid model');
          return true;
        },
      );
    });

    it('should throw OpenAIError on invalid JSON response', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response('not json', { status: 200 });
      });

      await assert.rejects(
        async () => request('/test', {}, { apiKey: 'sk-test' }),
        (error: OpenAIError) => {
          assert.equal(error.code, 'invalid_response');
          return true;
        },
      );
    });

    it('should throw OpenAIError on network error', async () => {
      mockFetch.mock.mockImplementation(async () => {
        throw new Error('Connection refused');
      });

      await assert.rejects(
        async () => request('/test', {}, { apiKey: 'sk-test' }),
        (error: OpenAIError) => {
          assert.equal(error.code, 'network_error');
          assert.ok(error.message.includes('Connection refused'));
          return true;
        },
      );
    });

    it('should include extra headers', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify({}), { status: 200 });
      });

      await request('/test', {}, { apiKey: 'sk-test', headers: { 'X-Custom': 'value' } });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const headers = options?.headers as Headers;
      assert.equal(headers.get('X-Custom'), 'value');
    });
  });

  describe('requestRaw()', () => {
    it('should return raw Response object', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response('raw data', { status: 200 });
      });

      const response = await requestRaw('/test', {}, { apiKey: 'sk-test' });

      assert.ok(response instanceof Response);
      assert.equal(await response.text(), 'raw data');
    });

    it('should throw OpenAIError on non-ok response', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify({ error: { message: 'Error', type: 'server_error' } }), {
          status: 500,
        });
      });

      await assert.rejects(
        async () => requestRaw('/test', {}, { apiKey: 'sk-test' }),
        (error: OpenAIError) => {
          assert.equal(error.status, 500);
          return true;
        },
      );
    });
  });

  describe('requestGet()', () => {
    it('should make GET request without body', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify({ models: [] }), { status: 200 });
      });

      const result = await requestGet<{ models: unknown[] }>('/models', { apiKey: 'sk-test' });

      assert.deepEqual(result, { models: [] });

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
