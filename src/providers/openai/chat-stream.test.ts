/**
 * Tests for OpenAI streaming chat completions.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import {
  chatStream,
  chatStreamAccumulate,
  chatStreamContent,
  chatStreamReadable,
} from './chat-stream.js';
import type { ChatCompletionChunk, Message } from './types.js';

describe('chat streaming functions with mocked fetch', () => {
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

  const messages: Message[] = [{ role: 'user', content: 'Hello' }];

  function createSSEResponse(chunks: ChatCompletionChunk[]): Response {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  function createChunk(content: string, finishReason: string | null = null): ChatCompletionChunk {
    return {
      id: 'chatcmpl-123',
      object: 'chat.completion.chunk',
      created: 1234567890,
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          delta: { content },
          finish_reason: finishReason as ChatCompletionChunk['choices'][0]['finish_reason'],
        },
      ],
    };
  }

  describe('chatStream()', () => {
    it('should stream chunks', async () => {
      const chunks = [createChunk('Hello'), createChunk(' World'), createChunk('!', 'stop')];

      mockFetch.mock.mockImplementation(async () => createSSEResponse(chunks));

      const received: ChatCompletionChunk[] = [];
      for await (const chunk of chatStream(messages, { apiKey: 'sk-test', model: 'gpt-4o' })) {
        received.push(chunk);
      }

      assert.equal(received.length, 3);
      assert.equal(received[0].choices[0].delta.content, 'Hello');
      assert.equal(received[1].choices[0].delta.content, ' World');
      assert.equal(received[2].choices[0].delta.content, '!');
    });

    it('should include stream: true in request', async () => {
      mockFetch.mock.mockImplementation(async () => createSSEResponse([createChunk('Hi', 'stop')]));

      const received = [];
      for await (const chunk of chatStream(messages, { apiKey: 'sk-test', model: 'gpt-4o' })) {
        received.push(chunk);
      }

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.stream, true);
    });

    it('should include stream_options when includeUsage is true', async () => {
      mockFetch.mock.mockImplementation(async () => createSSEResponse([createChunk('Hi', 'stop')]));

      const received = [];
      for await (const chunk of chatStream(messages, {
        apiKey: 'sk-test',
        model: 'gpt-4o',
        includeUsage: true,
      })) {
        received.push(chunk);
      }

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.deepEqual(body.stream_options, { include_usage: true });
    });
  });

  describe('chatStreamContent()', () => {
    it('should yield content deltas', async () => {
      const chunks = [createChunk('Hello'), createChunk(' World'), createChunk('!', 'stop')];

      mockFetch.mock.mockImplementation(async () => createSSEResponse(chunks));

      const contents: string[] = [];
      for await (const delta of chatStreamContent(messages, {
        apiKey: 'sk-test',
        model: 'gpt-4o',
      })) {
        contents.push(delta.content);
      }

      assert.deepEqual(contents, ['Hello', ' World', '!']);
    });

    it('should indicate done on final chunk', async () => {
      const chunks = [createChunk('Hi', 'stop')];

      mockFetch.mock.mockImplementation(async () => createSSEResponse(chunks));

      let lastDelta:
        | { content: string; done: boolean; finishReason: string | null; usage: unknown }
        | undefined;
      for await (const delta of chatStreamContent(messages, {
        apiKey: 'sk-test',
        model: 'gpt-4o',
      })) {
        lastDelta = delta;
      }

      assert.equal(lastDelta?.done, true);
      assert.equal(lastDelta?.finishReason, 'stop');
    });

    it('should include usage in final chunk when available', async () => {
      const chunks: ChatCompletionChunk[] = [
        createChunk('Hi'),
        {
          ...createChunk('', 'stop'),
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        },
      ];

      mockFetch.mock.mockImplementation(async () => createSSEResponse(chunks));

      let lastDelta:
        | { content: string; done: boolean; finishReason: string | null; usage: unknown }
        | undefined;
      for await (const delta of chatStreamContent(messages, {
        apiKey: 'sk-test',
        model: 'gpt-4o',
      })) {
        lastDelta = delta;
      }

      assert.equal(lastDelta?.usage?.total_tokens, 15);
    });
  });

  describe('chatStreamAccumulate()', () => {
    it('should accumulate full content', async () => {
      const chunks = [createChunk('Hello'), createChunk(' World'), createChunk('!', 'stop')];

      mockFetch.mock.mockImplementation(async () => createSSEResponse(chunks));

      const result = await chatStreamAccumulate(messages, { apiKey: 'sk-test', model: 'gpt-4o' });

      assert.equal(result.content, 'Hello World!');
      assert.equal(result.finishReason, 'stop');
    });

    it('should call onChunk callback', async () => {
      const chunks = [createChunk('Hello'), createChunk(' World'), createChunk('!', 'stop')];

      mockFetch.mock.mockImplementation(async () => createSSEResponse(chunks));

      const received: string[] = [];
      await chatStreamAccumulate(
        messages,
        { apiKey: 'sk-test', model: 'gpt-4o' },
        ({ content }) => {
          received.push(content);
        },
      );

      assert.deepEqual(received, ['Hello', ' World', '!']);
    });

    it('should return usage when available', async () => {
      const chunks: ChatCompletionChunk[] = [
        createChunk('Hi'),
        {
          ...createChunk('', 'stop'),
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        },
      ];

      mockFetch.mock.mockImplementation(async () => createSSEResponse(chunks));

      const result = await chatStreamAccumulate(messages, { apiKey: 'sk-test', model: 'gpt-4o' });

      assert.equal(result.usage?.total_tokens, 15);
    });

    it('should accumulate tool calls', async () => {
      const chunks: ChatCompletionChunk[] = [
        {
          ...createChunk(''),
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: 'call_123',
                    type: 'function',
                    function: { name: 'get_weather', arguments: '{"loc' },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          ...createChunk(''),
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [{ index: 0, function: { arguments: 'ation":"NYC"}' } }],
              },
              finish_reason: 'tool_calls',
            },
          ],
        },
      ];

      mockFetch.mock.mockImplementation(async () => createSSEResponse(chunks));

      const result = await chatStreamAccumulate(messages, { apiKey: 'sk-test', model: 'gpt-4o' });

      assert.equal(result.toolCalls.length, 1);
      assert.equal(result.toolCalls[0].function.name, 'get_weather');
      assert.equal(result.toolCalls[0].function.arguments, '{"location":"NYC"}');
    });
  });

  describe('chatStreamReadable()', () => {
    it('should return a ReadableStream', () => {
      mockFetch.mock.mockImplementation(async () => createSSEResponse([createChunk('Hi', 'stop')]));

      const stream = chatStreamReadable(messages, { apiKey: 'sk-test', model: 'gpt-4o' });

      assert.ok(stream instanceof ReadableStream);
    });

    it('should stream content strings', async () => {
      const chunks = [createChunk('Hello'), createChunk(' World'), createChunk('!', 'stop')];

      mockFetch.mock.mockImplementation(async () => createSSEResponse(chunks));

      const stream = chatStreamReadable(messages, { apiKey: 'sk-test', model: 'gpt-4o' });
      const reader = stream.getReader();

      const contents: string[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        contents.push(value);
      }

      assert.deepEqual(contents, ['Hello', ' World', '!']);
    });
  });
});
