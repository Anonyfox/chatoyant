/**
 * Tests for OpenAI images API.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import {
  generateImage,
  generateImageBase64,
  generateImages,
  generateImageUrl,
  generateImageWithPrompt,
} from './images.js';
import type { ImageGenerationResponse } from './types.js';

describe('images API with mocked fetch', () => {
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

  const mockImageResponse: ImageGenerationResponse = {
    created: 1234567890,
    data: [{ url: 'https://example.com/image.png', revised_prompt: 'A beautiful sunset' }],
  };

  describe('generateImage()', () => {
    it('should make POST request to /images/generations', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockImageResponse), { status: 200 });
      });

      const result = await generateImage('A sunset', { apiKey: 'sk-test' });

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].url, 'https://example.com/image.png');

      const [url, options] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).endsWith('/images/generations'));
      assert.equal(options?.method, 'POST');
    });

    it('should include prompt in request', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockImageResponse), { status: 200 });
      });

      await generateImage('A beautiful mountain landscape', { apiKey: 'sk-test' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.prompt, 'A beautiful mountain landscape');
    });

    it('should include model when provided', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockImageResponse), { status: 200 });
      });

      await generateImage('A sunset', { apiKey: 'sk-test', model: 'dall-e-3' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.model, 'dall-e-3');
    });

    it('should include size when provided', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockImageResponse), { status: 200 });
      });

      await generateImage('A sunset', { apiKey: 'sk-test', size: '1792x1024' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.size, '1792x1024');
    });

    it('should include quality when provided', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockImageResponse), { status: 200 });
      });

      await generateImage('A sunset', { apiKey: 'sk-test', quality: 'high' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.quality, 'high');
    });

    it('should include style when provided', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockImageResponse), { status: 200 });
      });

      await generateImage('A sunset', { apiKey: 'sk-test', style: 'natural' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.style, 'natural');
    });

    it('should include n when provided', async () => {
      const multiResponse: ImageGenerationResponse = {
        created: 1234567890,
        data: [{ url: 'https://example.com/1.png' }, { url: 'https://example.com/2.png' }],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(multiResponse), { status: 200 });
      });

      await generateImage('A sunset', { apiKey: 'sk-test', n: 2 });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.n, 2);
    });
  });

  describe('generateImageUrl()', () => {
    it('should return just the URL', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockImageResponse), { status: 200 });
      });

      const url = await generateImageUrl('A sunset', { apiKey: 'sk-test' });

      assert.equal(url, 'https://example.com/image.png');
    });

    it('should request url format', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockImageResponse), { status: 200 });
      });

      await generateImageUrl('A sunset', { apiKey: 'sk-test' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.response_format, 'url');
      assert.equal(body.n, 1);
    });

    it('should throw when no URL in response', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify({ created: 123, data: [{}] }), { status: 200 });
      });

      await assert.rejects(
        async () => generateImageUrl('A sunset', { apiKey: 'sk-test' }),
        /No URL in response/,
      );
    });
  });

  describe('generateImageBase64()', () => {
    it('should return base64 data', async () => {
      const base64Response: ImageGenerationResponse = {
        created: 1234567890,
        data: [{ b64_json: 'base64encodeddata==' }],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(base64Response), { status: 200 });
      });

      const data = await generateImageBase64('A sunset', { apiKey: 'sk-test' });

      assert.equal(data, 'base64encodeddata==');
    });

    it('should request b64_json format', async () => {
      const base64Response: ImageGenerationResponse = {
        created: 1234567890,
        data: [{ b64_json: 'data' }],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(base64Response), { status: 200 });
      });

      await generateImageBase64('A sunset', { apiKey: 'sk-test' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.response_format, 'b64_json');
    });

    it('should throw when no base64 data in response', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify({ created: 123, data: [{}] }), { status: 200 });
      });

      await assert.rejects(
        async () => generateImageBase64('A sunset', { apiKey: 'sk-test' }),
        /No base64 data in response/,
      );
    });
  });

  describe('generateImages()', () => {
    it('should return multiple images', async () => {
      const multiResponse: ImageGenerationResponse = {
        created: 1234567890,
        data: [
          { url: 'https://example.com/1.png' },
          { url: 'https://example.com/2.png' },
          { url: 'https://example.com/3.png' },
        ],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(multiResponse), { status: 200 });
      });

      const images = await generateImages('A sunset', 3, { apiKey: 'sk-test' });

      assert.equal(images.length, 3);
      assert.equal(images[0].url, 'https://example.com/1.png');
      assert.equal(images[2].url, 'https://example.com/3.png');
    });

    it('should set n in request', async () => {
      const multiResponse: ImageGenerationResponse = {
        created: 1234567890,
        data: [{ url: 'https://example.com/1.png' }],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(multiResponse), { status: 200 });
      });

      await generateImages('A sunset', 4, { apiKey: 'sk-test' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.n, 4);
    });
  });

  describe('generateImageWithPrompt()', () => {
    it('should return URL and revised prompt', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockImageResponse), { status: 200 });
      });

      const result = await generateImageWithPrompt('A sunset', { apiKey: 'sk-test' });

      assert.equal(result.url, 'https://example.com/image.png');
      assert.equal(result.revisedPrompt, 'A beautiful sunset');
    });

    it('should use original prompt when no revised prompt', async () => {
      const noRevisedResponse: ImageGenerationResponse = {
        created: 1234567890,
        data: [{ url: 'https://example.com/image.png' }],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(noRevisedResponse), { status: 200 });
      });

      const result = await generateImageWithPrompt('My original prompt', { apiKey: 'sk-test' });

      assert.equal(result.revisedPrompt, 'My original prompt');
    });
  });
});
