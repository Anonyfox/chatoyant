/**
 * Tests for local provider client.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { OpenAIClient } from '../openai/client.js';
import type { ChatCompletion, ModelsResponse } from '../openai/types.js';
import { createLocalClient, LocalClient } from './client.js';

const mockCompletion: ChatCompletion = {
  id: 'chatcmpl-local-1',
  object: 'chat.completion',
  created: 1234567890,
  model: 'Qwen3.5-9B-MLX-4bit',
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content: 'Hello from local!' },
      finish_reason: 'stop',
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

const mockModelsResponse: ModelsResponse = {
  object: 'list',
  data: [
    { id: 'Qwen3.5-9B-MLX-4bit', object: 'model', created: 1234567890, owned_by: 'omlx' },
    { id: 'Llama-3.2-1B-Instruct-4bit', object: 'model', created: 1234567890, owned_by: 'omlx' },
  ],
};

describe('providers/local/client', () => {
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

  describe('LocalClient', () => {
    it('should be an instance of OpenAIClient', () => {
      const client = new LocalClient({ baseUrl: 'http://localhost:8765/v1' });
      assert.ok(client instanceof OpenAIClient);
      assert.ok(client instanceof LocalClient);
    });

    it('should default apiKey to "local" when not provided', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      const client = new LocalClient({ baseUrl: 'http://localhost:8765/v1' });
      await client.chat([{ role: 'user', content: 'Hello' }]);

      const [, options] = mockFetch.mock.calls[0].arguments;
      const headers = options?.headers as Headers;
      assert.equal(headers.get('Authorization'), 'Bearer local');
    });

    it('should use provided apiKey when specified', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      const client = new LocalClient({ baseUrl: 'http://localhost:8765/v1', apiKey: 'Razer88fox' });
      await client.chat([{ role: 'user', content: 'Hello' }]);

      const [, options] = mockFetch.mock.calls[0].arguments;
      const headers = options?.headers as Headers;
      assert.equal(headers.get('Authorization'), 'Bearer Razer88fox');
    });

    it('should send requests to the configured baseUrl', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      const client = new LocalClient({ baseUrl: 'http://127.0.0.1:8765/v1' });
      await client.chat([{ role: 'user', content: 'Hello' }]);

      const [url] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).startsWith('http://127.0.0.1:8765/v1'));
    });

    it('chatSimple() should return content', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      const client = new LocalClient({ baseUrl: 'http://localhost:8765/v1' });
      const content = await client.chatSimple([{ role: 'user', content: 'Hi' }]);
      assert.equal(content, 'Hello from local!');
    });

    it('chatWithTools() should include tools in request body', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      const client = new LocalClient({ baseUrl: 'http://localhost:8765/v1' });
      const tools = [{ type: 'function' as const, function: { name: 'calc', parameters: {} } }];
      await client.chatWithTools([{ role: 'user', content: 'Hi' }], tools);

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.deepEqual(body.tools, tools);
    });

    it('stream() should yield chunks from the local server', async () => {
      const encoder = new TextEncoder();
      const chunk = {
        id: 'test',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'Qwen3.5-9B-MLX-4bit',
        choices: [{ index: 0, delta: { content: 'Hello' }, finish_reason: 'stop' }],
      };
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      mockFetch.mock.mockImplementation(async () => new Response(stream, { status: 200 }));

      const client = new LocalClient({ baseUrl: 'http://localhost:8765/v1' });
      const chunks = [];
      for await (const c of client.stream([{ role: 'user', content: 'Hi' }])) {
        chunks.push(c);
      }
      assert.equal(chunks.length, 1);
    });

    it('listModelIds() should return model IDs from local server', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockModelsResponse), { status: 200 });
      });

      const client = new LocalClient({ baseUrl: 'http://localhost:8765/v1' });
      const ids = await client.listModelIds();
      assert.ok(ids.includes('Qwen3.5-9B-MLX-4bit'));
      assert.ok(ids.includes('Llama-3.2-1B-Instruct-4bit'));
    });

    it('should use defaultModel when specified', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      const client = new LocalClient({
        baseUrl: 'http://localhost:8765/v1',
        defaultModel: 'Qwen3.5-9B-MLX-4bit',
      });
      await client.chat([{ role: 'user', content: 'Hi' }]);

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.model, 'Qwen3.5-9B-MLX-4bit');
    });
  });

  describe('createLocalClient()', () => {
    it('should return a LocalClient instance', () => {
      const client = createLocalClient({ baseUrl: 'http://localhost:8765/v1' });
      assert.ok(client instanceof LocalClient);
    });

    it('should forward all config options', () => {
      const client = createLocalClient({
        baseUrl: 'http://localhost:8765/v1',
        apiKey: 'test-key',
        timeout: 30000,
        defaultModel: 'my-model',
      });
      assert.ok(client instanceof LocalClient);
    });
  });
});
