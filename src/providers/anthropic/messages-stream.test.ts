/**
 * Tests for Anthropic streaming messages API.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import {
  messageStream,
  messageStreamAccumulate,
  messageStreamContent,
  messageStreamReadable,
} from './messages-stream.js';
import type { Message, StreamEvent } from './types.js';

describe('messages streaming functions with mocked fetch', () => {
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

  function createSSEResponse(events: Array<{ event: string; data: object }>): Response {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const { event, data } of events) {
          controller.enqueue(encoder.encode(`event: ${event}\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  function createBasicStreamEvents(text: string): Array<{ event: string; data: object }> {
    return [
      {
        event: 'message_start',
        data: {
          message: {
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [],
            model: 'claude-3',
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 10, output_tokens: 0 },
          },
        },
      },
      {
        event: 'content_block_start',
        data: { index: 0, content_block: { type: 'text', text: '' } },
      },
      {
        event: 'content_block_delta',
        data: { index: 0, delta: { type: 'text_delta', text } },
      },
      {
        event: 'content_block_stop',
        data: { index: 0 },
      },
      {
        event: 'message_delta',
        data: {
          delta: { stop_reason: 'end_turn', stop_sequence: null },
          usage: { output_tokens: 5 },
        },
      },
      {
        event: 'message_stop',
        data: {},
      },
    ];
  }

  describe('messageStream()', () => {
    it('should stream events', async () => {
      mockFetch.mock.mockImplementation(async () =>
        createSSEResponse(createBasicStreamEvents('Hello!')),
      );

      const received: StreamEvent[] = [];
      for await (const event of messageStream(messages, {
        apiKey: 'sk-test',
        model: 'claude-3',
        maxTokens: 1024,
      })) {
        received.push(event);
      }

      assert.equal(received.length, 6);
      assert.equal(received[0].type, 'message_start');
      assert.equal(received[5].type, 'message_stop');
    });

    it('should include stream: true in request', async () => {
      mockFetch.mock.mockImplementation(async () =>
        createSSEResponse(createBasicStreamEvents('Hi')),
      );

      const events = [];
      for await (const event of messageStream(messages, {
        apiKey: 'sk-test',
        model: 'claude-3',
        maxTokens: 1024,
      })) {
        events.push(event);
      }

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.stream, true);
    });
  });

  describe('messageStreamContent()', () => {
    it('should yield content deltas', async () => {
      mockFetch.mock.mockImplementation(async () =>
        createSSEResponse(createBasicStreamEvents('Hello World')),
      );

      const contents: string[] = [];
      for await (const delta of messageStreamContent(messages, {
        apiKey: 'sk-test',
        model: 'claude-3',
        maxTokens: 1024,
      })) {
        if (delta.text) contents.push(delta.text);
      }

      assert.deepEqual(contents, ['Hello World']);
    });

    it('should indicate done on final event', async () => {
      mockFetch.mock.mockImplementation(async () =>
        createSSEResponse(createBasicStreamEvents('Hi')),
      );

      let lastDelta: { done: boolean; stopReason: string | null } | undefined;
      for await (const delta of messageStreamContent(messages, {
        apiKey: 'sk-test',
        model: 'claude-3',
        maxTokens: 1024,
      })) {
        lastDelta = delta;
      }

      assert.equal(lastDelta?.done, true);
      assert.equal(lastDelta?.stopReason, 'end_turn');
    });

    it('should include usage in final delta', async () => {
      mockFetch.mock.mockImplementation(async () =>
        createSSEResponse(createBasicStreamEvents('Hi')),
      );

      let lastDelta: { usage: unknown } | undefined;
      for await (const delta of messageStreamContent(messages, {
        apiKey: 'sk-test',
        model: 'claude-3',
        maxTokens: 1024,
      })) {
        lastDelta = delta;
      }

      assert.ok(lastDelta?.usage);
    });
  });

  describe('messageStreamAccumulate()', () => {
    it('should accumulate full content', async () => {
      const events = [...createBasicStreamEvents('Hello')];
      // Add another text delta
      events.splice(3, 0, {
        event: 'content_block_delta',
        data: { index: 0, delta: { type: 'text_delta', text: ' World' } },
      });

      mockFetch.mock.mockImplementation(async () => createSSEResponse(events));

      const result = await messageStreamAccumulate(messages, {
        apiKey: 'sk-test',
        model: 'claude-3',
        maxTokens: 1024,
      });

      assert.equal(result.content, 'Hello World');
      assert.equal(result.stopReason, 'end_turn');
    });

    it('should call onDelta callback', async () => {
      mockFetch.mock.mockImplementation(async () =>
        createSSEResponse(createBasicStreamEvents('Hello!')),
      );

      const received: string[] = [];
      await messageStreamAccumulate(
        messages,
        { apiKey: 'sk-test', model: 'claude-3', maxTokens: 1024 },
        (delta) => received.push(delta),
      );

      assert.deepEqual(received, ['Hello!']);
    });

    it('should return usage', async () => {
      mockFetch.mock.mockImplementation(async () =>
        createSSEResponse(createBasicStreamEvents('Hi')),
      );

      const result = await messageStreamAccumulate(messages, {
        apiKey: 'sk-test',
        model: 'claude-3',
        maxTokens: 1024,
      });

      assert.equal(result.usage?.input_tokens, 10);
      assert.equal(result.usage?.output_tokens, 5);
    });

    it('should accumulate tool uses', async () => {
      const events: Array<{ event: string; data: object }> = [
        {
          event: 'message_start',
          data: {
            message: {
              id: 'msg_123',
              type: 'message',
              role: 'assistant',
              content: [],
              model: 'claude-3',
              stop_reason: null,
              stop_sequence: null,
              usage: { input_tokens: 10, output_tokens: 0 },
            },
          },
        },
        {
          event: 'content_block_start',
          data: {
            index: 0,
            content_block: { type: 'tool_use', id: 'call_123', name: 'get_weather', input: {} },
          },
        },
        {
          event: 'content_block_delta',
          data: {
            index: 0,
            delta: { type: 'input_json_delta', partial_json: '{"location":"NYC"}' },
          },
        },
        { event: 'content_block_stop', data: { index: 0 } },
        {
          event: 'message_delta',
          data: {
            delta: { stop_reason: 'tool_use', stop_sequence: null },
            usage: { output_tokens: 20 },
          },
        },
        { event: 'message_stop', data: {} },
      ];

      mockFetch.mock.mockImplementation(async () => createSSEResponse(events));

      const result = await messageStreamAccumulate(messages, {
        apiKey: 'sk-test',
        model: 'claude-3',
        maxTokens: 1024,
      });

      assert.equal(result.toolUses.length, 1);
      assert.equal(result.toolUses[0].name, 'get_weather');
      assert.deepEqual(result.toolUses[0].input, { location: 'NYC' });
    });
  });

  describe('messageStreamReadable()', () => {
    it('should return a ReadableStream', () => {
      mockFetch.mock.mockImplementation(async () =>
        createSSEResponse(createBasicStreamEvents('Hi')),
      );

      const stream = messageStreamReadable(messages, {
        apiKey: 'sk-test',
        model: 'claude-3',
        maxTokens: 1024,
      });

      assert.ok(stream instanceof ReadableStream);
    });

    it('should stream content strings', async () => {
      mockFetch.mock.mockImplementation(async () =>
        createSSEResponse(createBasicStreamEvents('Hello!')),
      );

      const stream = messageStreamReadable(messages, {
        apiKey: 'sk-test',
        model: 'claude-3',
        maxTokens: 1024,
      });
      const reader = stream.getReader();

      const contents: string[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        contents.push(value);
      }

      assert.deepEqual(contents, ['Hello!']);
    });
  });
});
