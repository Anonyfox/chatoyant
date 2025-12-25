/**
 * Tests for xAI client.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { createXAIClient, XAIClient } from './client.js';
import type {
  ChatCompletion,
  ChatCompletionChunk,
  EmbeddingResponse,
  ImageGenerationResponse,
  LanguageModelsResponse,
  ModelsResponse,
} from './types.js';

describe('XAIClient with mocked fetch', () => {
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

  const mockCompletion: ChatCompletion = {
    id: 'chatcmpl-123',
    object: 'chat.completion',
    created: 1234567890,
    model: 'grok-3',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'Hello!' },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  };

  describe('constructor', () => {
    it('should create client with minimal config', () => {
      const client = new XAIClient({ apiKey: 'xai-test' });
      assert.ok(client instanceof XAIClient);
    });

    it('should create client with full config', () => {
      const client = new XAIClient({
        apiKey: 'xai-test',
        baseUrl: 'https://custom.api.com',
        timeout: 30000,
        defaultModel: 'grok-4',
        defaultEmbeddingModel: 'grok-embed-1',
        defaultImageModel: 'grok-image-1',
        headers: { 'X-Custom': 'value' },
      });
      assert.ok(client instanceof XAIClient);
    });
  });

  describe('createXAIClient()', () => {
    it('should create client instance', () => {
      const client = createXAIClient({ apiKey: 'xai-test' });
      assert.ok(client instanceof XAIClient);
    });
  });

  describe('chat methods', () => {
    it('chatSimple() should return text content', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      const client = new XAIClient({ apiKey: 'xai-test' });
      const text = await client.chatSimple([{ role: 'user', content: 'Hello' }]);

      assert.equal(text, 'Hello!');
    });

    it('should use default model', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      const client = new XAIClient({ apiKey: 'xai-test', defaultModel: 'grok-4' });
      await client.chat([{ role: 'user', content: 'Hello' }]);

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.model, 'grok-4');
    });

    it('should allow model override', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      const client = new XAIClient({ apiKey: 'xai-test', defaultModel: 'grok-4' });
      await client.chat([{ role: 'user', content: 'Hello' }], { model: 'grok-3' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.model, 'grok-3');
    });

    it('chatWithWebSearch() should include web_search tool', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      const client = new XAIClient({ apiKey: 'xai-test' });
      await client.chatWithWebSearch([{ role: 'user', content: 'News today?' }]);

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.ok(body.tools.some((t: { type: string }) => t.type === 'web_search'));
    });

    it('chatStructured() should return parsed JSON', async () => {
      const structuredResponse = {
        ...mockCompletion,
        choices: [
          {
            ...mockCompletion.choices[0],
            message: { role: 'assistant', content: '{"name":"test"}' },
          },
        ],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(structuredResponse), { status: 200 });
      });

      const client = new XAIClient({ apiKey: 'xai-test' });
      const result = await client.chatStructured<{ name: string }>(
        [{ role: 'user', content: 'Extract' }],
        { name: 'result', schema: { type: 'object' } },
      );

      assert.equal(result.name, 'test');
    });
  });

  describe('streaming methods', () => {
    function createSSEResponse(content: string): Response {
      const encoder = new TextEncoder();
      const chunks = [
        `data: {"id":"123","object":"chat.completion.chunk","created":1234567890,"model":"grok-3","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n`,
        `data: {"id":"123","object":"chat.completion.chunk","created":1234567890,"model":"grok-3","choices":[{"index":0,"delta":{"content":"${content}"},"finish_reason":null}]}\n\n`,
        `data: {"id":"123","object":"chat.completion.chunk","created":1234567890,"model":"grok-3","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n`,
        'data: [DONE]\n\n',
      ];

      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        },
      });
      return new Response(stream, { status: 200 });
    }

    it('stream() should return async generator', async () => {
      mockFetch.mock.mockImplementation(async () => createSSEResponse('Hello'));

      const client = new XAIClient({ apiKey: 'xai-test' });
      const chunks: ChatCompletionChunk[] = [];
      for await (const chunk of client.stream([{ role: 'user', content: 'Hi' }])) {
        chunks.push(chunk);
      }

      assert.equal(chunks.length, 3);
    });

    it('streamContent() should yield deltas', async () => {
      mockFetch.mock.mockImplementation(async () => createSSEResponse('Hello'));

      const client = new XAIClient({ apiKey: 'xai-test' });
      const contents: string[] = [];
      for await (const delta of client.streamContent([{ role: 'user', content: 'Hi' }])) {
        if (delta.content) contents.push(delta.content);
      }

      assert.deepEqual(contents, ['Hello']);
    });

    it('streamAccumulate() should return full content', async () => {
      mockFetch.mock.mockImplementation(async () => createSSEResponse('Hello World'));

      const client = new XAIClient({ apiKey: 'xai-test' });
      const result = await client.streamAccumulate([{ role: 'user', content: 'Hi' }]);

      assert.equal(result.content, 'Hello World');
    });

    it('streamReadable() should return ReadableStream', () => {
      mockFetch.mock.mockImplementation(async () => createSSEResponse('Hi'));

      const client = new XAIClient({ apiKey: 'xai-test' });
      const stream = client.streamReadable([{ role: 'user', content: 'Hi' }]);

      assert.ok(stream instanceof ReadableStream);
    });
  });

  describe('embedding methods', () => {
    const mockEmbeddingResponse: EmbeddingResponse = {
      object: 'list',
      data: [{ object: 'embedding', index: 0, embedding: [0.1, 0.2, 0.3] }],
      model: 'grok-embedding-1',
      usage: { prompt_tokens: 5, total_tokens: 5 },
    };

    it('embed() should return embedding response', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockEmbeddingResponse), { status: 200 });
      });

      const client = new XAIClient({ apiKey: 'xai-test' });
      const result = await client.embed('Hello');

      assert.equal(result.data.length, 1);
    });

    it('embedOne() should return single vector', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockEmbeddingResponse), { status: 200 });
      });

      const client = new XAIClient({ apiKey: 'xai-test' });
      const vector = await client.embedOne('Hello');

      assert.deepEqual(vector, [0.1, 0.2, 0.3]);
    });
  });

  describe('image generation methods', () => {
    const mockImageResponse: ImageGenerationResponse = {
      created: 1234567890,
      data: [{ url: 'https://example.com/image.png' }],
    };

    it('generateImageUrl() should return URL', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockImageResponse), { status: 200 });
      });

      const client = new XAIClient({ apiKey: 'xai-test' });
      const url = await client.generateImageUrl('A sunset');

      assert.equal(url, 'https://example.com/image.png');
    });
  });

  describe('model methods', () => {
    it('listModels() should return models', async () => {
      const mockModelsResponse: ModelsResponse = {
        object: 'list',
        data: [{ id: 'grok-3', object: 'model', created: 1234567890, owned_by: 'xai' }],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockModelsResponse), { status: 200 });
      });

      const client = new XAIClient({ apiKey: 'xai-test' });
      const result = await client.listModels();

      assert.equal(result.data.length, 1);
    });

    it('listLanguageModels() should return detailed models (xAI-specific)', async () => {
      const mockLangModels: LanguageModelsResponse = {
        models: [
          {
            id: 'grok-3',
            fingerprint: 'abc',
            aliases: [],
            context_length: 131072,
            input_modalities: ['text'],
            output_modalities: ['text'],
            pricing: { input: 3.0, output: 15.0 },
          },
        ],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockLangModels), { status: 200 });
      });

      const client = new XAIClient({ apiKey: 'xai-test' });
      const result = await client.listLanguageModels();

      assert.equal(result.models.length, 1);
      assert.equal(result.models[0].context_length, 131072);
    });
  });

  describe('utility methods', () => {
    it('should have cosineSimilarity method', () => {
      const client = new XAIClient({ apiKey: 'xai-test' });
      const similarity = client.cosineSimilarity([1, 0, 0], [1, 0, 0]);
      assert.equal(similarity, 1);
    });

    it('should have findSimilar method', () => {
      const client = new XAIClient({ apiKey: 'xai-test' });
      const results = client.findSimilar([1, 0, 0], [{ embedding: [1, 0, 0], item: 'test' }], 1);
      assert.equal(results.length, 1);
    });
  });
});
