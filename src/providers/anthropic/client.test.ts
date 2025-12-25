/**
 * Tests for Anthropic client.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { AnthropicClient, createAnthropicClient } from './client.js';
import type { MessagesResponse, StreamEvent } from './types.js';

describe('AnthropicClient with mocked fetch', () => {
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

  const mockResponse: MessagesResponse = {
    id: 'msg_123',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: 'Hello!' }],
    model: 'claude-sonnet-4-20250514',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
  };

  describe('constructor', () => {
    it('should create client with minimal config', () => {
      const client = new AnthropicClient({ apiKey: 'sk-test' });
      assert.ok(client instanceof AnthropicClient);
    });

    it('should create client with full config', () => {
      const client = new AnthropicClient({
        apiKey: 'sk-test',
        baseUrl: 'https://custom.api.com',
        timeout: 30000,
        defaultModel: 'claude-3-opus',
        defaultMaxTokens: 2048,
        headers: { 'X-Custom': 'value' },
        betas: ['pdfs-2024-09-25'],
      });
      assert.ok(client instanceof AnthropicClient);
    });
  });

  describe('createAnthropicClient()', () => {
    it('should create client instance', () => {
      const client = createAnthropicClient({ apiKey: 'sk-test' });
      assert.ok(client instanceof AnthropicClient);
    });
  });

  describe('message methods', () => {
    it('message() should use default model', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      const client = new AnthropicClient({ apiKey: 'sk-test', defaultModel: 'claude-3-opus' });
      await client.message([{ role: 'user', content: 'Hello' }]);

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.model, 'claude-3-opus');
    });

    it('message() should allow model override', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      const client = new AnthropicClient({ apiKey: 'sk-test', defaultModel: 'claude-3-opus' });
      await client.message([{ role: 'user', content: 'Hello' }], {
        model: 'claude-sonnet-4-20250514',
      });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.model, 'claude-sonnet-4-20250514');
    });

    it('messageSimple() should return text content', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      const client = new AnthropicClient({ apiKey: 'sk-test' });
      const text = await client.messageSimple([{ role: 'user', content: 'Hello' }]);

      assert.equal(text, 'Hello!');
    });

    it('messageWithTools() should include tools in request', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      const client = new AnthropicClient({ apiKey: 'sk-test' });
      const tools = [{ name: 'test', input_schema: { type: 'object' as const, properties: {} } }];
      await client.messageWithTools([{ role: 'user', content: 'Hello' }], tools);

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.deepEqual(body.tools, tools);
    });

    it('messageStructured() should return parsed data', async () => {
      const structuredResponse: MessagesResponse = {
        ...mockResponse,
        content: [{ type: 'tool_use', id: 'call_123', name: 'result', input: { name: 'test' } }],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(structuredResponse), { status: 200 });
      });

      const client = new AnthropicClient({ apiKey: 'sk-test' });
      const result = await client.messageStructured<{ name: string }>(
        [{ role: 'user', content: 'Extract name' }],
        { name: 'result', schema: { type: 'object' } },
      );

      assert.equal(result.name, 'test');
    });
  });

  describe('streaming methods', () => {
    function createSSEResponse(text: string): Response {
      const encoder = new TextEncoder();
      const events = [
        `event: message_start\ndata: {"message":{"id":"msg_123","type":"message","role":"assistant","content":[],"model":"claude-3","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":0}}}\n\n`,
        `event: content_block_start\ndata: {"index":0,"content_block":{"type":"text","text":""}}\n\n`,
        `event: content_block_delta\ndata: {"index":0,"delta":{"type":"text_delta","text":"${text}"}}\n\n`,
        `event: content_block_stop\ndata: {"index":0}\n\n`,
        `event: message_delta\ndata: {"delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":5}}\n\n`,
        `event: message_stop\ndata: {}\n\n`,
      ];

      const stream = new ReadableStream({
        start(controller) {
          for (const event of events) {
            controller.enqueue(encoder.encode(event));
          }
          controller.close();
        },
      });
      return new Response(stream, { status: 200 });
    }

    it('stream() should return async generator', async () => {
      mockFetch.mock.mockImplementation(async () => createSSEResponse('Hello'));

      const client = new AnthropicClient({ apiKey: 'sk-test' });
      const events: StreamEvent[] = [];
      for await (const event of client.stream([{ role: 'user', content: 'Hi' }])) {
        events.push(event);
      }

      assert.equal(events.length, 6);
    });

    it('streamContent() should yield deltas', async () => {
      mockFetch.mock.mockImplementation(async () => createSSEResponse('Hello'));

      const client = new AnthropicClient({ apiKey: 'sk-test' });
      const contents: string[] = [];
      for await (const delta of client.streamContent([{ role: 'user', content: 'Hi' }])) {
        if (delta.text) contents.push(delta.text);
      }

      assert.deepEqual(contents, ['Hello']);
    });

    it('streamAccumulate() should return full content', async () => {
      mockFetch.mock.mockImplementation(async () => createSSEResponse('Hello World'));

      const client = new AnthropicClient({ apiKey: 'sk-test' });
      const result = await client.streamAccumulate([{ role: 'user', content: 'Hi' }]);

      assert.equal(result.content, 'Hello World');
    });

    it('streamReadable() should return ReadableStream', () => {
      mockFetch.mock.mockImplementation(async () => createSSEResponse('Hi'));

      const client = new AnthropicClient({ apiKey: 'sk-test' });
      const stream = client.streamReadable([{ role: 'user', content: 'Hi' }]);

      assert.ok(stream instanceof ReadableStream);
    });
  });

  describe('utility methods', () => {
    it('should have extractText method', () => {
      const client = new AnthropicClient({ apiKey: 'sk-test' });
      const text = client.extractText([{ type: 'text', text: 'Hello' }]);
      assert.equal(text, 'Hello');
    });

    it('should have extractToolUses method', () => {
      const client = new AnthropicClient({ apiKey: 'sk-test' });
      const toolUses = client.extractToolUses([
        { type: 'tool_use', id: 'call_1', name: 'test', input: {} },
      ]);
      assert.equal(toolUses.length, 1);
    });
  });

  describe('custom configuration', () => {
    it('should use custom baseUrl', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      const client = new AnthropicClient({
        apiKey: 'sk-test',
        baseUrl: 'https://custom.anthropic.com/v1',
      });
      await client.message([{ role: 'user', content: 'Hello' }]);

      const [url] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).startsWith('https://custom.anthropic.com/v1'));
    });

    it('should include custom headers', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      const client = new AnthropicClient({
        apiKey: 'sk-test',
        headers: { 'X-Custom-Header': 'custom-value' },
      });
      await client.message([{ role: 'user', content: 'Hello' }]);

      const [, options] = mockFetch.mock.calls[0].arguments;
      const headers = options?.headers as Headers;
      assert.equal(headers.get('X-Custom-Header'), 'custom-value');
    });

    it('should include beta features', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      const client = new AnthropicClient({
        apiKey: 'sk-test',
        betas: ['pdfs-2024-09-25'],
      });
      await client.message([{ role: 'user', content: 'Hello' }]);

      const [, options] = mockFetch.mock.calls[0].arguments;
      const headers = options?.headers as Headers;
      assert.equal(headers.get('anthropic-beta'), 'pdfs-2024-09-25');
    });
  });
});
