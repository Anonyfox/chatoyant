/**
 * Tests for OpenAI client.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { createOpenAIClient, OpenAIClient } from './client.js';
import type {
  ChatCompletion,
  EmbeddingResponse,
  ImageGenerationResponse,
  ModelsResponse,
} from './types.js';

describe('OpenAIClient with mocked fetch', () => {
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
    model: 'gpt-4o',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'Hello!' },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  };

  const mockEmbeddingResponse: EmbeddingResponse = {
    object: 'list',
    data: [{ object: 'embedding', index: 0, embedding: [0.1, 0.2, 0.3] }],
    model: 'text-embedding-3-small',
    usage: { prompt_tokens: 5, total_tokens: 5 },
  };

  const mockImageResponse: ImageGenerationResponse = {
    created: 1234567890,
    data: [{ url: 'https://example.com/image.png' }],
  };

  const mockModelsResponse: ModelsResponse = {
    object: 'list',
    data: [{ id: 'gpt-4o', object: 'model', created: 1234567890, owned_by: 'openai' }],
  };

  describe('constructor', () => {
    it('should create client with minimal config', () => {
      const client = new OpenAIClient({ apiKey: 'sk-test' });
      assert.ok(client instanceof OpenAIClient);
    });

    it('should create client with full config', () => {
      const client = new OpenAIClient({
        apiKey: 'sk-test',
        baseUrl: 'https://custom.api.com',
        timeout: 30000,
        defaultModel: 'gpt-4',
        defaultEmbeddingModel: 'text-embedding-3-large',
        defaultImageModel: 'dall-e-3',
        headers: { 'X-Custom': 'value' },
      });
      assert.ok(client instanceof OpenAIClient);
    });
  });

  describe('createOpenAIClient()', () => {
    it('should create client instance', () => {
      const client = createOpenAIClient({ apiKey: 'sk-test' });
      assert.ok(client instanceof OpenAIClient);
    });
  });

  describe('chat methods', () => {
    it('chat() should use default model', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      const client = new OpenAIClient({ apiKey: 'sk-test', defaultModel: 'gpt-4-turbo' });
      await client.chat([{ role: 'user', content: 'Hello' }]);

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.model, 'gpt-4-turbo');
    });

    it('chat() should allow model override', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      const client = new OpenAIClient({ apiKey: 'sk-test', defaultModel: 'gpt-4-turbo' });
      await client.chat([{ role: 'user', content: 'Hello' }], { model: 'gpt-4o' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.model, 'gpt-4o');
    });

    it('chatSimple() should return content', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      const client = new OpenAIClient({ apiKey: 'sk-test' });
      const content = await client.chatSimple([{ role: 'user', content: 'Hello' }]);

      assert.equal(content, 'Hello!');
    });

    it('chatWithTools() should include tools in request', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      const client = new OpenAIClient({ apiKey: 'sk-test' });
      const tools = [{ type: 'function' as const, function: { name: 'test', parameters: {} } }];
      await client.chatWithTools([{ role: 'user', content: 'Hello' }], tools);

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.deepEqual(body.tools, tools);
    });

    it('chatStructured() should include json_schema in request', async () => {
      const structuredCompletion = {
        ...mockCompletion,
        choices: [
          {
            ...mockCompletion.choices[0],
            message: { role: 'assistant', content: '{"name":"test"}' },
          },
        ],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(structuredCompletion), { status: 200 });
      });

      const client = new OpenAIClient({ apiKey: 'sk-test' });
      const result = await client.chatStructured<{ name: string }>(
        [{ role: 'user', content: 'Extract name' }],
        { name: 'result', schema: { type: 'object' } },
      );

      assert.equal(result.name, 'test');
    });
  });

  describe('streaming methods', () => {
    function createSSEResponse(content: string): Response {
      const encoder = new TextEncoder();
      const chunk = {
        id: 'test',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [{ index: 0, delta: { content }, finish_reason: 'stop' }],
      };
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      return new Response(stream, { status: 200 });
    }

    it('stream() should return async generator', async () => {
      mockFetch.mock.mockImplementation(async () => createSSEResponse('Hello'));

      const client = new OpenAIClient({ apiKey: 'sk-test' });
      const chunks = [];
      for await (const chunk of client.stream([{ role: 'user', content: 'Hi' }])) {
        chunks.push(chunk);
      }

      assert.equal(chunks.length, 1);
    });

    it('streamContent() should yield deltas', async () => {
      mockFetch.mock.mockImplementation(async () => createSSEResponse('Hello'));

      const client = new OpenAIClient({ apiKey: 'sk-test' });
      const contents = [];
      for await (const delta of client.streamContent([{ role: 'user', content: 'Hi' }])) {
        contents.push(delta.content);
      }

      assert.deepEqual(contents, ['Hello']);
    });

    it('streamAccumulate() should return full content', async () => {
      mockFetch.mock.mockImplementation(async () => createSSEResponse('Hello World'));

      const client = new OpenAIClient({ apiKey: 'sk-test' });
      const result = await client.streamAccumulate([{ role: 'user', content: 'Hi' }]);

      assert.equal(result.content, 'Hello World');
    });

    it('streamReadable() should return ReadableStream', () => {
      mockFetch.mock.mockImplementation(async () => createSSEResponse('Hi'));

      const client = new OpenAIClient({ apiKey: 'sk-test' });
      const stream = client.streamReadable([{ role: 'user', content: 'Hi' }]);

      assert.ok(stream instanceof ReadableStream);
    });
  });

  describe('embedding methods', () => {
    it('embed() should use default embedding model', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockEmbeddingResponse), { status: 200 });
      });

      const client = new OpenAIClient({
        apiKey: 'sk-test',
        defaultEmbeddingModel: 'text-embedding-3-large',
      });
      await client.embed('Hello');

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.model, 'text-embedding-3-large');
    });

    it('embedOne() should return vector', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockEmbeddingResponse), { status: 200 });
      });

      const client = new OpenAIClient({ apiKey: 'sk-test' });
      const vector = await client.embedOne('Hello');

      assert.deepEqual(vector, [0.1, 0.2, 0.3]);
    });

    it('embedMany() should return multiple vectors', async () => {
      const multiResponse = {
        ...mockEmbeddingResponse,
        data: [
          { object: 'embedding', index: 0, embedding: [0.1] },
          { object: 'embedding', index: 1, embedding: [0.2] },
        ],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(multiResponse), { status: 200 });
      });

      const client = new OpenAIClient({ apiKey: 'sk-test' });
      const vectors = await client.embedMany(['Hello', 'World']);

      assert.equal(vectors.length, 2);
    });
  });

  describe('image methods', () => {
    it('generateImage() should use default image model', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockImageResponse), { status: 200 });
      });

      const client = new OpenAIClient({ apiKey: 'sk-test', defaultImageModel: 'dall-e-3' });
      await client.generateImage('A sunset');

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.model, 'dall-e-3');
    });

    it('generateImageUrl() should return URL', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockImageResponse), { status: 200 });
      });

      const client = new OpenAIClient({ apiKey: 'sk-test' });
      const url = await client.generateImageUrl('A sunset');

      assert.equal(url, 'https://example.com/image.png');
    });

    it('generateImageBase64() should return base64', async () => {
      const base64Response = {
        created: 1234567890,
        data: [{ b64_json: 'base64data' }],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(base64Response), { status: 200 });
      });

      const client = new OpenAIClient({ apiKey: 'sk-test' });
      const data = await client.generateImageBase64('A sunset');

      assert.equal(data, 'base64data');
    });

    it('generateImages() should return multiple images', async () => {
      const multiResponse = {
        created: 1234567890,
        data: [{ url: 'https://example.com/1.png' }, { url: 'https://example.com/2.png' }],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(multiResponse), { status: 200 });
      });

      const client = new OpenAIClient({ apiKey: 'sk-test' });
      const images = await client.generateImages('A sunset', 2);

      assert.equal(images.length, 2);
    });
  });

  describe('model methods', () => {
    it('listModels() should return models', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockModelsResponse), { status: 200 });
      });

      const client = new OpenAIClient({ apiKey: 'sk-test' });
      const result = await client.listModels();

      assert.equal(result.data.length, 1);
    });

    it('getModel() should return model details', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockModelsResponse.data[0]), { status: 200 });
      });

      const client = new OpenAIClient({ apiKey: 'sk-test' });
      const model = await client.getModel('gpt-4o');

      assert.equal(model.id, 'gpt-4o');
    });

    it('listModelIds() should return IDs', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockModelsResponse), { status: 200 });
      });

      const client = new OpenAIClient({ apiKey: 'sk-test' });
      const ids = await client.listModelIds();

      assert.deepEqual(ids, ['gpt-4o']);
    });

    it('modelExists() should check existence', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockModelsResponse.data[0]), { status: 200 });
      });

      const client = new OpenAIClient({ apiKey: 'sk-test' });
      const exists = await client.modelExists('gpt-4o');

      assert.equal(exists, true);
    });
  });

  describe('custom baseUrl', () => {
    it('should use custom baseUrl', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      const client = new OpenAIClient({
        apiKey: 'sk-test',
        baseUrl: 'https://custom.openai.com/v1',
      });
      await client.chat([{ role: 'user', content: 'Hello' }]);

      const [url] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).startsWith('https://custom.openai.com/v1'));
    });
  });

  describe('custom headers', () => {
    it('should include custom headers', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      const client = new OpenAIClient({
        apiKey: 'sk-test',
        headers: { 'X-Custom-Header': 'custom-value' },
      });
      await client.chat([{ role: 'user', content: 'Hello' }]);

      const [, options] = mockFetch.mock.calls[0].arguments;
      const headers = options?.headers as Headers;
      assert.equal(headers.get('X-Custom-Header'), 'custom-value');
    });
  });
});
