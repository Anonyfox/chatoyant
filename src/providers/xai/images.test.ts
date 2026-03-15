/**
 * Tests for xAI image generation and editing API.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import {
  editImage,
  editImageBase64,
  editImageUrl,
  editMultipleImages,
  generateImage,
  generateImageBase64,
  generateImages,
  generateImageUrl,
  generateImageWithPrompt,
} from './images.js';
import type { ImageGenerationResponse } from './types.js';

describe('image generation functions with mocked fetch', () => {
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

      const result = await generateImage('A sunset', { apiKey: 'xai-test' });

      assert.equal(result.created, 1234567890);
      assert.equal(result.data.length, 1);

      const [url, options] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).endsWith('/images/generations'));
      assert.equal(options?.method, 'POST');
    });

    it('should include prompt in request', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockImageResponse), { status: 200 });
      });

      await generateImage('A beautiful sunset', { apiKey: 'xai-test' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.prompt, 'A beautiful sunset');
    });

    it('should include optional parameters', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockImageResponse), { status: 200 });
      });

      await generateImage('A sunset', {
        apiKey: 'xai-test',
        model: 'grok-2-image-1212',
        size: '1024x1024',
        quality: 'hd',
        style: 'vivid',
        n: 2,
      });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.model, 'grok-2-image-1212');
      assert.equal(body.size, '1024x1024');
      assert.equal(body.quality, 'hd');
      assert.equal(body.style, 'vivid');
      assert.equal(body.n, 2);
    });

    it('should include new grok-imagine-image parameters', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockImageResponse), { status: 200 });
      });

      await generateImage('A sunset', {
        apiKey: 'xai-test',
        model: 'grok-imagine-image',
        aspectRatio: '16:9',
        resolution: '2k',
      });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.model, 'grok-imagine-image');
      assert.equal(body.aspect_ratio, '16:9');
      assert.equal(body.resolution, '2k');
    });
  });

  describe('generateImageUrl()', () => {
    it('should return just the URL', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockImageResponse), { status: 200 });
      });

      const url = await generateImageUrl('A sunset', { apiKey: 'xai-test' });

      assert.equal(url, 'https://example.com/image.png');
    });

    it('should force response_format to url', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockImageResponse), { status: 200 });
      });

      await generateImageUrl('A sunset', { apiKey: 'xai-test' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.response_format, 'url');
      assert.equal(body.n, 1);
    });

    it('should throw if no URL in response', async () => {
      const noUrlResponse: ImageGenerationResponse = {
        created: 1234567890,
        data: [{ b64_json: 'base64data' }],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(noUrlResponse), { status: 200 });
      });

      await assert.rejects(
        async () => generateImageUrl('A sunset', { apiKey: 'xai-test' }),
        /No URL in response/,
      );
    });
  });

  describe('generateImageBase64()', () => {
    it('should return base64 data', async () => {
      const base64Response: ImageGenerationResponse = {
        created: 1234567890,
        data: [{ b64_json: 'base64encodeddata' }],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(base64Response), { status: 200 });
      });

      const b64 = await generateImageBase64('A sunset', { apiKey: 'xai-test' });

      assert.equal(b64, 'base64encodeddata');
    });

    it('should force response_format to b64_json', async () => {
      const base64Response: ImageGenerationResponse = {
        created: 1234567890,
        data: [{ b64_json: 'data' }],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(base64Response), { status: 200 });
      });

      await generateImageBase64('A sunset', { apiKey: 'xai-test' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.response_format, 'b64_json');
    });

    it('should throw if no base64 in response', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockImageResponse), { status: 200 });
      });

      await assert.rejects(
        async () => generateImageBase64('A sunset', { apiKey: 'xai-test' }),
        /No base64 data in response/,
      );
    });
  });

  describe('generateImages()', () => {
    it('should return array of image data', async () => {
      const multiResponse: ImageGenerationResponse = {
        created: 1234567890,
        data: [
          { url: 'https://example.com/image1.png' },
          { url: 'https://example.com/image2.png' },
        ],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(multiResponse), { status: 200 });
      });

      const images = await generateImages('A sunset', 2, { apiKey: 'xai-test' });

      assert.equal(images.length, 2);
      assert.equal(images[0].url, 'https://example.com/image1.png');
      assert.equal(images[1].url, 'https://example.com/image2.png');
    });

    it('should set n parameter', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockImageResponse), { status: 200 });
      });

      await generateImages('A sunset', 3, { apiKey: 'xai-test' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.n, 3);
    });
  });

  describe('generateImageWithPrompt()', () => {
    it('should return URL and revised prompt', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockImageResponse), { status: 200 });
      });

      const result = await generateImageWithPrompt('A sunset', { apiKey: 'xai-test' });

      assert.equal(result.url, 'https://example.com/image.png');
      assert.equal(result.revisedPrompt, 'A beautiful sunset');
    });

    it('should fall back to original prompt if no revised_prompt', async () => {
      const noRevisedResponse: ImageGenerationResponse = {
        created: 1234567890,
        data: [{ url: 'https://example.com/image.png' }],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(noRevisedResponse), { status: 200 });
      });

      const result = await generateImageWithPrompt('A sunset', { apiKey: 'xai-test' });

      assert.equal(result.revisedPrompt, 'A sunset');
    });

    it('should throw if no URL in response', async () => {
      const noUrlResponse: ImageGenerationResponse = {
        created: 1234567890,
        data: [{ b64_json: 'data' }],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(noUrlResponse), { status: 200 });
      });

      await assert.rejects(
        async () => generateImageWithPrompt('A sunset', { apiKey: 'xai-test' }),
        /No URL in response/,
      );
    });
  });
});

describe('image editing functions with mocked fetch', () => {
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

  const mockEditResponse: ImageGenerationResponse = {
    created: 1234567890,
    data: [{ url: 'https://example.com/edited.png' }],
  };

  describe('editImage()', () => {
    it('should POST to /images/edits with image source', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockEditResponse), { status: 200 });
      });

      const result = await editImage('Make it a sketch', 'https://example.com/photo.jpg', {
        apiKey: 'xai-test',
        model: 'grok-imagine-image',
      });

      assert.equal(result.data[0].url, 'https://example.com/edited.png');

      const [url, options] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).endsWith('/images/edits'));

      const body = JSON.parse(options?.body as string);
      assert.equal(body.prompt, 'Make it a sketch');
      assert.equal(body.model, 'grok-imagine-image');
      assert.deepEqual(body.image, {
        url: 'https://example.com/photo.jpg',
        type: 'image_url',
      });
    });

    it('should include optional parameters', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockEditResponse), { status: 200 });
      });

      await editImage('Edit this', 'https://example.com/photo.jpg', {
        apiKey: 'xai-test',
        resolution: '2k',
        n: 2,
      });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.resolution, '2k');
      assert.equal(body.n, 2);
    });
  });

  describe('editImageUrl()', () => {
    it('should return just the URL', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockEditResponse), { status: 200 });
      });

      const url = await editImageUrl('Make it a sketch', 'https://example.com/photo.jpg', {
        apiKey: 'xai-test',
      });

      assert.equal(url, 'https://example.com/edited.png');
    });
  });

  describe('editImageBase64()', () => {
    it('should return base64 data', async () => {
      const base64Response: ImageGenerationResponse = {
        created: 1234567890,
        data: [{ b64_json: 'editedbase64' }],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(base64Response), { status: 200 });
      });

      const b64 = await editImageBase64('Make it a sketch', 'https://example.com/photo.jpg', {
        apiKey: 'xai-test',
      });

      assert.equal(b64, 'editedbase64');
    });
  });

  describe('editMultipleImages()', () => {
    it('should POST with images array', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockEditResponse), { status: 200 });
      });

      await editMultipleImages(
        'Combine these images',
        ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
        { apiKey: 'xai-test', model: 'grok-imagine-image' },
      );

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.prompt, 'Combine these images');
      assert.equal(body.images.length, 2);
      assert.deepEqual(body.images[0], {
        url: 'https://example.com/a.jpg',
        type: 'image_url',
      });
      assert.deepEqual(body.images[1], {
        url: 'https://example.com/b.jpg',
        type: 'image_url',
      });
      assert.equal(body.image, undefined);
    });
  });
});
