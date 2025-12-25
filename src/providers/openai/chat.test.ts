/**
 * Tests for OpenAI chat completions.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { chat, chatSimple, chatStructured, chatWithTools } from './chat.js';
import type { ChatCompletion, Message } from './types.js';

describe('chat functions with mocked fetch', () => {
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

  const messages: Message[] = [{ role: 'user', content: 'Hello' }];

  describe('chat()', () => {
    it('should make POST request to /chat/completions', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      const result = await chat(messages, { apiKey: 'sk-test', model: 'gpt-4o' });

      assert.equal(result.id, 'chatcmpl-123');
      assert.equal(result.choices[0].message.content, 'Hello!');

      const [url, options] = mockFetch.mock.calls[0].arguments;
      assert.ok((url as string).endsWith('/chat/completions'));
      assert.equal(options?.method, 'POST');
    });

    it('should include model and messages in request body', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      await chat(messages, { apiKey: 'sk-test', model: 'gpt-4o' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.model, 'gpt-4o');
      assert.deepEqual(body.messages, messages);
      assert.equal(body.stream, false);
    });

    it('should include temperature when provided', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      await chat(messages, { apiKey: 'sk-test', model: 'gpt-4o', temperature: 0.7 });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.temperature, 0.7);
    });

    it('should include maxTokens when provided', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      await chat(messages, { apiKey: 'sk-test', model: 'gpt-4o', maxTokens: 1000 });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.max_tokens, 1000);
    });

    it('should include topP when provided', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      await chat(messages, { apiKey: 'sk-test', model: 'gpt-4o', topP: 0.9 });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.top_p, 0.9);
    });

    it('should include stop sequences when provided', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      await chat(messages, { apiKey: 'sk-test', model: 'gpt-4o', stop: ['\n\n'] });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.deepEqual(body.stop, ['\n\n']);
    });

    it('should include seed when provided', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      await chat(messages, { apiKey: 'sk-test', model: 'gpt-4o', seed: 42 });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.seed, 42);
    });

    it('should include user when provided', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      await chat(messages, { apiKey: 'sk-test', model: 'gpt-4o', user: 'user-123' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.user, 'user-123');
    });

    it('should include frequencyPenalty when provided', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      await chat(messages, { apiKey: 'sk-test', model: 'gpt-4o', frequencyPenalty: 0.5 });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.frequency_penalty, 0.5);
    });

    it('should include presencePenalty when provided', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      await chat(messages, { apiKey: 'sk-test', model: 'gpt-4o', presencePenalty: 0.3 });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.presence_penalty, 0.3);
    });

    it('should include logprobs when provided', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      await chat(messages, { apiKey: 'sk-test', model: 'gpt-4o', logprobs: true, topLogprobs: 5 });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.logprobs, true);
      assert.equal(body.top_logprobs, 5);
    });

    it('should include n when provided', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      await chat(messages, { apiKey: 'sk-test', model: 'gpt-4o', n: 3 });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.n, 3);
    });

    it('should include reasoningEffort when provided', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      await chat(messages, { apiKey: 'sk-test', model: 'gpt-5.1', reasoningEffort: 'none' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.reasoning_effort, 'none');
    });

    it('should merge requestOptions', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      await chat(messages, {
        apiKey: 'sk-test',
        model: 'gpt-4o',
        requestOptions: {
          top_p: 0.9,
          presence_penalty: 0.5,
        },
      });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.top_p, 0.9);
      assert.equal(body.presence_penalty, 0.5);
    });

    it('should return usage information', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      const result = await chat(messages, { apiKey: 'sk-test', model: 'gpt-4o' });

      assert.equal(result.usage.prompt_tokens, 10);
      assert.equal(result.usage.completion_tokens, 5);
      assert.equal(result.usage.total_tokens, 15);
    });
  });

  describe('chatSimple()', () => {
    it('should return just the content string', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      const content = await chatSimple(messages, { apiKey: 'sk-test', model: 'gpt-4o' });

      assert.equal(content, 'Hello!');
    });

    it('should return empty string when no content', async () => {
      const noContentCompletion = {
        ...mockCompletion,
        choices: [{ ...mockCompletion.choices[0], message: { role: 'assistant', content: null } }],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(noContentCompletion), { status: 200 });
      });

      const content = await chatSimple(messages, { apiKey: 'sk-test', model: 'gpt-4o' });

      assert.equal(content, '');
    });
  });

  describe('chatWithTools()', () => {
    it('should return content when no tool calls', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      const result = await chatWithTools(messages, { apiKey: 'sk-test', model: 'gpt-4o' });

      assert.equal(result.type, 'content');
      if (result.type === 'content') {
        assert.equal(result.content, 'Hello!');
      }
    });

    it('should return tool_calls when model calls tools', async () => {
      const toolCallCompletion: ChatCompletion = {
        ...mockCompletion,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: { name: 'get_weather', arguments: '{"location":"NYC"}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(toolCallCompletion), { status: 200 });
      });

      const result = await chatWithTools(messages, { apiKey: 'sk-test', model: 'gpt-4o' });

      assert.equal(result.type, 'tool_calls');
      if (result.type === 'tool_calls') {
        assert.equal(result.toolCalls.length, 1);
        assert.equal(result.toolCalls[0].function.name, 'get_weather');
      }
    });

    it('should include usage in both result types', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      const result = await chatWithTools(messages, { apiKey: 'sk-test', model: 'gpt-4o' });

      assert.equal(result.usage.total_tokens, 15);
    });
  });

  describe('chatStructured()', () => {
    it('should parse JSON response', async () => {
      const structuredCompletion: ChatCompletion = {
        ...mockCompletion,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '{"name":"John","age":25}' },
            finish_reason: 'stop',
          },
        ],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(structuredCompletion), { status: 200 });
      });

      const result = await chatStructured<{ name: string; age: number }>(
        messages,
        { name: 'person', schema: { type: 'object' } },
        { apiKey: 'sk-test', model: 'gpt-4o' },
      );

      assert.equal(result.name, 'John');
      assert.equal(result.age, 25);
    });

    it('should include json_schema in response_format', async () => {
      const structuredCompletion: ChatCompletion = {
        ...mockCompletion,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '{}' },
            finish_reason: 'stop',
          },
        ],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(structuredCompletion), { status: 200 });
      });

      await chatStructured(
        messages,
        {
          name: 'test',
          description: 'A test schema',
          schema: { type: 'object', properties: { x: { type: 'number' } } },
          strict: true,
        },
        { apiKey: 'sk-test', model: 'gpt-4o' },
      );

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.response_format.type, 'json_schema');
      assert.equal(body.response_format.json_schema.name, 'test');
      assert.equal(body.response_format.json_schema.strict, true);
    });

    it('should throw when no content', async () => {
      const emptyCompletion: ChatCompletion = {
        ...mockCompletion,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: null },
            finish_reason: 'stop',
          },
        ],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(emptyCompletion), { status: 200 });
      });

      await assert.rejects(
        async () =>
          chatStructured(
            messages,
            { name: 'test', schema: {} },
            { apiKey: 'sk-test', model: 'gpt-4o' },
          ),
        /No content in response/,
      );
    });
  });
});
