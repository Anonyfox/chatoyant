/**
 * Tests for xAI video generation API.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import {
  editVideo,
  generateVideo,
  generateVideoFromImage,
  generateVideoUrl,
  getVideoStatus,
  startVideoGeneration,
} from './videos.js';
import type { VideoGenerationStartResponse, VideoGenerationStatusResponse } from './types.js';

describe('video generation functions with mocked fetch', () => {
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

  const mockStartResponse: VideoGenerationStartResponse = {
    request_id: 'req-abc-123',
  };

  const mockPendingResponse: VideoGenerationStatusResponse = {
    status: 'pending',
  };

  const mockDoneResponse: VideoGenerationStatusResponse = {
    status: 'done',
    video: {
      url: 'https://vidgen.x.ai/video.mp4',
      duration: 8,
      respect_moderation: true,
    },
    model: 'grok-imagine-video',
  };

  describe('startVideoGeneration()', () => {
    it('should POST to /videos/generations and return request_id', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockStartResponse), { status: 200 });
      });

      const result = await startVideoGeneration('A rocket launching', {
        apiKey: 'xai-test',
        model: 'grok-imagine-video',
        duration: 10,
        aspectRatio: '16:9',
        resolution: '720p',
      });

      assert.equal(result.requestId, 'req-abc-123');

      const [url, options] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).endsWith('/videos/generations'));
      assert.equal(options?.method, 'POST');

      const body = JSON.parse(options?.body as string);
      assert.equal(body.model, 'grok-imagine-video');
      assert.equal(body.prompt, 'A rocket launching');
      assert.equal(body.duration, 10);
      assert.equal(body.aspect_ratio, '16:9');
      assert.equal(body.resolution, '720p');
    });

    it('should default to grok-imagine-video model', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockStartResponse), { status: 200 });
      });

      await startVideoGeneration('A sunset', { apiKey: 'xai-test' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.model, 'grok-imagine-video');
    });

    it('should include image_url for image-to-video', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockStartResponse), { status: 200 });
      });

      await startVideoGeneration('Animate this', {
        apiKey: 'xai-test',
        imageUrl: 'https://example.com/photo.jpg',
      });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.image_url, 'https://example.com/photo.jpg');
    });

    it('should include video_url for video editing', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockStartResponse), { status: 200 });
      });

      await startVideoGeneration('Add a hat', {
        apiKey: 'xai-test',
        videoUrl: 'https://example.com/video.mp4',
      });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.video_url, 'https://example.com/video.mp4');
    });
  });

  describe('getVideoStatus()', () => {
    it('should GET /videos/{request_id}', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockDoneResponse), { status: 200 });
      });

      const result = await getVideoStatus('req-abc-123', { apiKey: 'xai-test' });

      assert.equal(result.status, 'done');
      assert.equal(result.video?.url, 'https://vidgen.x.ai/video.mp4');
      assert.equal(result.video?.duration, 8);

      const [url, options] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).endsWith('/videos/req-abc-123'));
      assert.equal(options?.method, 'GET');
    });
  });

  describe('generateVideo()', () => {
    it('should start generation and poll until done', async () => {
      let callCount = 0;
      mockFetch.mock.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify(mockStartResponse), { status: 200 });
        }
        if (callCount === 2) {
          return new Response(JSON.stringify(mockPendingResponse), { status: 200 });
        }
        return new Response(JSON.stringify(mockDoneResponse), { status: 200 });
      });

      const result = await generateVideo(
        'A rocket launching',
        { apiKey: 'xai-test', duration: 10 },
        { pollIntervalMs: 10 },
      );

      assert.equal(result.url, 'https://vidgen.x.ai/video.mp4');
      assert.equal(result.duration, 8);
      assert.equal(result.respectModeration, true);
      assert.equal(result.model, 'grok-imagine-video');
      assert.equal(result.requestId, 'req-abc-123');
      assert.equal(callCount, 3);
    });

    it('should throw on expired request', async () => {
      const expiredResponse: VideoGenerationStatusResponse = { status: 'expired' };
      let callCount = 0;

      mockFetch.mock.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify(mockStartResponse), { status: 200 });
        }
        return new Response(JSON.stringify(expiredResponse), { status: 200 });
      });

      await assert.rejects(
        async () =>
          generateVideo('A sunset', { apiKey: 'xai-test' }, { pollIntervalMs: 10 }),
        /expired/,
      );
    });

    it('should throw on timeout', async () => {
      let callCount = 0;
      mockFetch.mock.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify(mockStartResponse), { status: 200 });
        }
        return new Response(JSON.stringify(mockPendingResponse), { status: 200 });
      });

      await assert.rejects(
        async () =>
          generateVideo(
            'A sunset',
            { apiKey: 'xai-test' },
            { pollIntervalMs: 10, pollTimeoutMs: 50 },
          ),
        /timed out/,
      );
    });

    it('should invoke onPoll callback', async () => {
      let callCount = 0;
      mockFetch.mock.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify(mockStartResponse), { status: 200 });
        }
        if (callCount === 2) {
          return new Response(JSON.stringify(mockPendingResponse), { status: 200 });
        }
        return new Response(JSON.stringify(mockDoneResponse), { status: 200 });
      });

      const statuses: string[] = [];
      await generateVideo(
        'A rocket',
        { apiKey: 'xai-test' },
        { pollIntervalMs: 10, onPoll: (s) => statuses.push(s) },
      );

      assert.deepEqual(statuses, ['pending', 'done']);
    });
  });

  describe('generateVideoUrl()', () => {
    it('should return just the video URL', async () => {
      let callCount = 0;
      mockFetch.mock.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify(mockStartResponse), { status: 200 });
        }
        return new Response(JSON.stringify(mockDoneResponse), { status: 200 });
      });

      const url = await generateVideoUrl(
        'A sunset',
        { apiKey: 'xai-test' },
        { pollIntervalMs: 10 },
      );

      assert.equal(url, 'https://vidgen.x.ai/video.mp4');
    });
  });

  describe('generateVideoFromImage()', () => {
    it('should include image_url in the request', async () => {
      let callCount = 0;
      mockFetch.mock.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify(mockStartResponse), { status: 200 });
        }
        return new Response(JSON.stringify(mockDoneResponse), { status: 200 });
      });

      await generateVideoFromImage(
        'Animate this landscape',
        'https://example.com/landscape.jpg',
        { apiKey: 'xai-test' },
        { pollIntervalMs: 10 },
      );

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.image_url, 'https://example.com/landscape.jpg');
    });
  });

  describe('editVideo()', () => {
    it('should include video_url in the request', async () => {
      let callCount = 0;
      mockFetch.mock.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify(mockStartResponse), { status: 200 });
        }
        return new Response(JSON.stringify(mockDoneResponse), { status: 200 });
      });

      await editVideo(
        'Add a silver necklace',
        'https://example.com/portrait.mp4',
        { apiKey: 'xai-test' },
        { pollIntervalMs: 10 },
      );

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.video_url, 'https://example.com/portrait.mp4');
      assert.equal(body.prompt, 'Add a silver necklace');
    });
  });
});
