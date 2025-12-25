/**
 * Tests for Anthropic messages API.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import {
  createMessage,
  extractText,
  extractToolUses,
  messageSimple,
  messageStructured,
  messageWithTools,
} from './messages.js';
import type { Message, MessagesResponse, ResponseContentBlock } from './types.js';

describe('messages functions with mocked fetch', () => {
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

  const messages: Message[] = [{ role: 'user', content: 'Hello' }];

  describe('createMessage()', () => {
    it('should make POST request to /messages', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      const result = await createMessage(messages, {
        apiKey: 'sk-test',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1024,
      });

      assert.equal(result.id, 'msg_123');
      assert.equal(result.content[0].type, 'text');

      const [url, options] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).endsWith('/messages'));
      assert.equal(options?.method, 'POST');
    });

    it('should include model, messages, and max_tokens in request body', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      await createMessage(messages, {
        apiKey: 'sk-test',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1024,
      });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.model, 'claude-sonnet-4-20250514');
      assert.deepEqual(body.messages, messages);
      assert.equal(body.max_tokens, 1024);
      assert.equal(body.stream, false);
    });

    it('should include system prompt when provided', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      await createMessage(messages, {
        apiKey: 'sk-test',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1024,
        system: 'You are a helpful assistant.',
      });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.system, 'You are a helpful assistant.');
    });

    it('should include temperature when provided', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      await createMessage(messages, {
        apiKey: 'sk-test',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1024,
        temperature: 0.7,
      });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.temperature, 0.7);
    });

    it('should map topP to top_p for API consistency', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      await createMessage(messages, {
        apiKey: 'sk-test',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1024,
        topP: 0.9,
      });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.top_p, 0.9);
    });

    it('should map topK to top_k (Anthropic-specific)', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      await createMessage(messages, {
        apiKey: 'sk-test',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1024,
        topK: 40,
      });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.top_k, 40);
    });

    it('should map stop to stop_sequences for API consistency', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      await createMessage(messages, {
        apiKey: 'sk-test',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1024,
        stop: ['END', 'STOP'],
      });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.deepEqual(body.stop_sequences, ['END', 'STOP']);
    });

    it('should not include stop_sequences when stop is empty', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      await createMessage(messages, {
        apiKey: 'sk-test',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1024,
        stop: [],
      });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.stop_sequences, undefined);
    });

    it('should map user to metadata.user_id for API consistency', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      await createMessage(messages, {
        apiKey: 'sk-test',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1024,
        user: 'user-123',
      });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.deepEqual(body.metadata, { user_id: 'user-123' });
    });

    it('should throw when max_tokens <= budget_tokens with thinking', async () => {
      await assert.rejects(
        async () => {
          await createMessage(messages, {
            apiKey: 'sk-test',
            model: 'claude-sonnet-4-20250514',
            maxTokens: 1024,
            requestOptions: {
              thinking: { type: 'enabled', budget_tokens: 1024 },
            },
          });
        },
        {
          message: /max_tokens.*must be greater than thinking\.budget_tokens/,
        },
      );
    });

    it('should throw when max_tokens < budget_tokens with thinking', async () => {
      await assert.rejects(
        async () => {
          await createMessage(messages, {
            apiKey: 'sk-test',
            model: 'claude-sonnet-4-20250514',
            maxTokens: 512,
            requestOptions: {
              thinking: { type: 'enabled', budget_tokens: 1024 },
            },
          });
        },
        {
          message: /Increase maxTokens to at least 1025/,
        },
      );
    });

    it('should allow max_tokens > budget_tokens with thinking', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      // Should not throw
      await createMessage(messages, {
        apiKey: 'sk-test',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 2048,
        requestOptions: {
          thinking: { type: 'enabled', budget_tokens: 1024 },
        },
      });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.max_tokens, 2048);
      assert.deepEqual(body.thinking, { type: 'enabled', budget_tokens: 1024 });
    });

    it('should return usage information', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      const result = await createMessage(messages, {
        apiKey: 'sk-test',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1024,
      });

      assert.equal(result.usage.input_tokens, 10);
      assert.equal(result.usage.output_tokens, 5);
    });
  });

  describe('messageSimple()', () => {
    it('should return just the text content', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      const text = await messageSimple(messages, {
        apiKey: 'sk-test',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1024,
      });

      assert.equal(text, 'Hello!');
    });

    it('should concatenate multiple text blocks', async () => {
      const multiTextResponse: MessagesResponse = {
        ...mockResponse,
        content: [
          { type: 'text', text: 'Hello' },
          { type: 'text', text: ' World' },
        ],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(multiTextResponse), { status: 200 });
      });

      const text = await messageSimple(messages, {
        apiKey: 'sk-test',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1024,
      });

      assert.equal(text, 'Hello World');
    });
  });

  describe('messageWithTools()', () => {
    it('should return text when no tool uses', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      const result = await messageWithTools(messages, {
        apiKey: 'sk-test',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1024,
      });

      assert.equal(result.type, 'text');
      if (result.type === 'text') {
        assert.equal(result.text, 'Hello!');
      }
    });

    it('should return tool_use when model calls tools', async () => {
      const toolUseResponse: MessagesResponse = {
        ...mockResponse,
        content: [
          { type: 'tool_use', id: 'call_123', name: 'get_weather', input: { location: 'NYC' } },
        ],
        stop_reason: 'tool_use',
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(toolUseResponse), { status: 200 });
      });

      const result = await messageWithTools(messages, {
        apiKey: 'sk-test',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1024,
      });

      assert.equal(result.type, 'tool_use');
      if (result.type === 'tool_use') {
        assert.equal(result.toolUses.length, 1);
        assert.equal(result.toolUses[0].name, 'get_weather');
      }
    });

    it('should include usage in both result types', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      const result = await messageWithTools(messages, {
        apiKey: 'sk-test',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1024,
      });

      assert.equal(result.usage.input_tokens, 10);
    });
  });

  describe('messageStructured()', () => {
    it('should return tool input as structured data', async () => {
      const structuredResponse: MessagesResponse = {
        ...mockResponse,
        content: [
          {
            type: 'tool_use',
            id: 'call_123',
            name: 'extract_person',
            input: { name: 'John', age: 25 },
          },
        ],
        stop_reason: 'tool_use',
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(structuredResponse), { status: 200 });
      });

      const result = await messageStructured<{ name: string; age: number }>(
        messages,
        { name: 'extract_person', schema: { type: 'object' } },
        { apiKey: 'sk-test', model: 'claude-sonnet-4-20250514', maxTokens: 1024 },
      );

      assert.equal(result.name, 'John');
      assert.equal(result.age, 25);
    });

    it('should include tool_choice forcing the schema tool', async () => {
      const structuredResponse: MessagesResponse = {
        ...mockResponse,
        content: [{ type: 'tool_use', id: 'call_123', name: 'test', input: {} }],
        stop_reason: 'tool_use',
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(structuredResponse), { status: 200 });
      });

      await messageStructured(
        messages,
        { name: 'test', description: 'Test schema', schema: { properties: {} } },
        { apiKey: 'sk-test', model: 'claude-sonnet-4-20250514', maxTokens: 1024 },
      );

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.deepEqual(body.tool_choice, { type: 'tool', name: 'test' });
      assert.equal(body.tools[0].name, 'test');
    });

    it('should throw when no tool use in response', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      await assert.rejects(
        async () =>
          messageStructured(
            messages,
            { name: 'test', schema: {} },
            { apiKey: 'sk-test', model: 'claude-sonnet-4-20250514', maxTokens: 1024 },
          ),
        /No tool use in response/,
      );
    });
  });
});

describe('extract utilities', () => {
  describe('extractText', () => {
    it('should extract text from text blocks', () => {
      const content: ResponseContentBlock[] = [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: ' World' },
      ];

      assert.equal(extractText(content), 'Hello World');
    });

    it('should skip non-text blocks', () => {
      const content: ResponseContentBlock[] = [
        { type: 'text', text: 'Hello' },
        { type: 'tool_use', id: 'call_1', name: 'test', input: {} },
        { type: 'text', text: ' World' },
      ];

      assert.equal(extractText(content), 'Hello World');
    });

    it('should return empty string for no text blocks', () => {
      const content: ResponseContentBlock[] = [
        { type: 'tool_use', id: 'call_1', name: 'test', input: {} },
      ];

      assert.equal(extractText(content), '');
    });
  });

  describe('extractToolUses', () => {
    it('should extract tool uses', () => {
      const content: ResponseContentBlock[] = [
        { type: 'text', text: 'Hello' },
        { type: 'tool_use', id: 'call_1', name: 'func1', input: { a: 1 } },
        { type: 'tool_use', id: 'call_2', name: 'func2', input: { b: 2 } },
      ];

      const toolUses = extractToolUses(content);

      assert.equal(toolUses.length, 2);
      assert.equal(toolUses[0].name, 'func1');
      assert.equal(toolUses[1].name, 'func2');
    });

    it('should return empty array for no tool uses', () => {
      const content: ResponseContentBlock[] = [{ type: 'text', text: 'Hello' }];

      assert.deepEqual(extractToolUses(content), []);
    });
  });
});
