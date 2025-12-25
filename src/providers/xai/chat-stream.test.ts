/**
 * Tests for xAI streaming chat completions.
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

  function createChunks(content: string): ChatCompletionChunk[] {
    const chars = content.split('');
    return [
      {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'grok-3',
        choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
      },
      ...chars.map((char) => ({
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk' as const,
        created: 1234567890,
        model: 'grok-3',
        choices: [{ index: 0, delta: { content: char }, finish_reason: null }],
      })),
      {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'grok-3',
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      },
    ];
  }

  describe('chatStream()', () => {
    it('should stream chunks', async () => {
      const chunks = createChunks('Hi');
      mockFetch.mock.mockImplementation(async () => createSSEResponse(chunks));

      const received: ChatCompletionChunk[] = [];
      for await (const chunk of chatStream(messages, { apiKey: 'xai-test', model: 'grok-3' })) {
        received.push(chunk);
      }

      assert.equal(received.length, chunks.length);
    });

    it('should include stream: true in request', async () => {
      mockFetch.mock.mockImplementation(async () => createSSEResponse(createChunks('Hi')));

      const gen = chatStream(messages, { apiKey: 'xai-test', model: 'grok-3' });
      for await (const _ of gen) {
        // consume
      }

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.stream, true);
    });
  });

  describe('chatStreamContent()', () => {
    it('should yield content deltas', async () => {
      mockFetch.mock.mockImplementation(async () => createSSEResponse(createChunks('Hello')));

      const contents: string[] = [];
      for await (const delta of chatStreamContent(messages, {
        apiKey: 'xai-test',
        model: 'grok-3',
      })) {
        if (delta.content) contents.push(delta.content);
      }

      assert.deepEqual(contents.join(''), 'Hello');
    });

    it('should indicate done on final delta', async () => {
      mockFetch.mock.mockImplementation(async () => createSSEResponse(createChunks('Hi')));

      let lastDelta: { done: boolean; finishReason: string | null } | undefined;
      for await (const delta of chatStreamContent(messages, {
        apiKey: 'xai-test',
        model: 'grok-3',
      })) {
        lastDelta = delta;
      }

      assert.equal(lastDelta?.done, true);
      assert.equal(lastDelta?.finishReason, 'stop');
    });

    it('should include usage in final delta', async () => {
      mockFetch.mock.mockImplementation(async () => createSSEResponse(createChunks('Hi')));

      let lastDelta: { usage: unknown } | undefined;
      for await (const delta of chatStreamContent(messages, {
        apiKey: 'xai-test',
        model: 'grok-3',
      })) {
        lastDelta = delta;
      }

      assert.ok(lastDelta?.usage);
    });
  });

  describe('chatStreamAccumulate()', () => {
    it('should accumulate full content', async () => {
      mockFetch.mock.mockImplementation(async () => createSSEResponse(createChunks('Hello World')));

      const result = await chatStreamAccumulate(messages, { apiKey: 'xai-test', model: 'grok-3' });

      assert.equal(result.content, 'Hello World');
      assert.equal(result.finishReason, 'stop');
    });

    it('should call onDelta callback', async () => {
      mockFetch.mock.mockImplementation(async () => createSSEResponse(createChunks('Hi')));

      const received: string[] = [];
      await chatStreamAccumulate(messages, { apiKey: 'xai-test', model: 'grok-3' }, (delta) =>
        received.push(delta),
      );

      assert.equal(received.join(''), 'Hi');
    });

    it('should return usage', async () => {
      mockFetch.mock.mockImplementation(async () => createSSEResponse(createChunks('Hi')));

      const result = await chatStreamAccumulate(messages, { apiKey: 'xai-test', model: 'grok-3' });

      assert.equal(result.usage?.prompt_tokens, 10);
      assert.equal(result.usage?.completion_tokens, 5);
    });

    it('should accumulate tool calls', async () => {
      const toolCallChunks: ChatCompletionChunk[] = [
        {
          id: 'chatcmpl-123',
          object: 'chat.completion.chunk',
          created: 1234567890,
          model: 'grok-3',
          choices: [
            {
              index: 0,
              delta: {
                role: 'assistant',
                tool_calls: [
                  { index: 0, id: 'call_123', type: 'function', function: { name: 'get_weather' } },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          id: 'chatcmpl-123',
          object: 'chat.completion.chunk',
          created: 1234567890,
          model: 'grok-3',
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [{ index: 0, function: { arguments: '{"location":"NYC"}' } }],
              },
              finish_reason: null,
            },
          ],
        },
        {
          id: 'chatcmpl-123',
          object: 'chat.completion.chunk',
          created: 1234567890,
          model: 'grok-3',
          choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        },
      ];

      mockFetch.mock.mockImplementation(async () => createSSEResponse(toolCallChunks));

      const result = await chatStreamAccumulate(messages, { apiKey: 'xai-test', model: 'grok-3' });

      assert.equal(result.toolCalls.length, 1);
      assert.equal(result.toolCalls[0].function.name, 'get_weather');
      assert.equal(result.toolCalls[0].function.arguments, '{"location":"NYC"}');
    });
  });

  describe('chatStreamReadable()', () => {
    it('should return a ReadableStream', () => {
      mockFetch.mock.mockImplementation(async () => createSSEResponse(createChunks('Hi')));

      const stream = chatStreamReadable(messages, { apiKey: 'xai-test', model: 'grok-3' });

      assert.ok(stream instanceof ReadableStream);
    });

    it('should stream content strings', async () => {
      mockFetch.mock.mockImplementation(async () => createSSEResponse(createChunks('Hello')));

      const stream = chatStreamReadable(messages, { apiKey: 'xai-test', model: 'grok-3' });
      const reader = stream.getReader();

      const contents: string[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        contents.push(value);
      }

      assert.equal(contents.join(''), 'Hello');
    });
  });
});
