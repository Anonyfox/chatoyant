/**
 * Tests for xAI chat completions API.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { chat, chatSimple, chatStructured, chatWithTools, chatWithWebSearch, modelSupportsPenalty } from './chat.js';
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

  const messages: Message[] = [{ role: 'user', content: 'Hello' }];

  describe('chat()', () => {
    it('should make POST request to /chat/completions', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      const result = await chat(messages, { apiKey: 'xai-test', model: 'grok-3' });

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

      await chat(messages, { apiKey: 'xai-test', model: 'grok-3' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.model, 'grok-3');
      assert.deepEqual(body.messages, messages);
      assert.equal(body.stream, false);
    });

    it('should include optional parameters', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      await chat(messages, {
        apiKey: 'xai-test',
        model: 'grok-3',
        temperature: 0.7,
        maxTokens: 1000,
        topP: 0.9,
        seed: 42,
      });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.temperature, 0.7);
      assert.equal(body.max_tokens, 1000);
      assert.equal(body.top_p, 0.9);
      assert.equal(body.seed, 42);
    });

    it('should filter xAI-specific reasoning_effort parameter (not supported by API)', async () => {
      // Suppress console.warn for this test
      const originalWarn = console.warn;
      console.warn = () => {};

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      await chat(messages, {
        apiKey: 'xai-test',
        model: 'grok-4-1-fast-reasoning',
        reasoningEffort: 'high',
      });

      console.warn = originalWarn;

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      // reasoning_effort is filtered out because it's not actually supported by the xAI API
      // Reasoning is controlled by model selection (e.g., *-reasoning vs *-non-reasoning)
      assert.equal(body.reasoning_effort, undefined);
    });
  });

  describe('chatSimple()', () => {
    it('should return just the content string', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      const text = await chatSimple(messages, { apiKey: 'xai-test', model: 'grok-3' });

      assert.equal(text, 'Hello!');
    });

    it('should return empty string if no content', async () => {
      const noContentResponse = {
        ...mockCompletion,
        choices: [{ ...mockCompletion.choices[0], message: { role: 'assistant', content: null } }],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(noContentResponse), { status: 200 });
      });

      const text = await chatSimple(messages, { apiKey: 'xai-test', model: 'grok-3' });

      assert.equal(text, '');
    });
  });

  describe('chatWithTools()', () => {
    it('should return content when no tool calls', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      const result = await chatWithTools(
        messages,
        [{ type: 'function', function: { name: 'test', parameters: {} } }],
        { apiKey: 'xai-test', model: 'grok-3' },
      );

      assert.equal(result.type, 'content');
      if (result.type === 'content') {
        assert.equal(result.content, 'Hello!');
      }
    });

    it('should return tool_calls when model uses tools', async () => {
      const toolCallResponse: ChatCompletion = {
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
        return new Response(JSON.stringify(toolCallResponse), { status: 200 });
      });

      const result = await chatWithTools(
        messages,
        [{ type: 'function', function: { name: 'get_weather', parameters: {} } }],
        { apiKey: 'xai-test', model: 'grok-3' },
      );

      assert.equal(result.type, 'tool_calls');
      if (result.type === 'tool_calls') {
        assert.equal(result.toolCalls.length, 1);
        assert.equal(result.toolCalls[0].function.name, 'get_weather');
      }
    });

    it('should include tools in request', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      const tools = [{ type: 'function' as const, function: { name: 'test', parameters: {} } }];
      await chatWithTools(messages, tools, { apiKey: 'xai-test', model: 'grok-3' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.deepEqual(body.tools, tools);
    });
  });

  describe('chatWithWebSearch()', () => {
    it('should include web_search tool in request', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      await chatWithWebSearch(messages, { apiKey: 'xai-test', model: 'grok-3' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.ok(body.tools.some((t: { type: string }) => t.type === 'web_search'));
    });
  });

  describe('chatStructured()', () => {
    it('should return parsed JSON response', async () => {
      const structuredResponse: ChatCompletion = {
        ...mockCompletion,
        choices: [
          {
            ...mockCompletion.choices[0],
            message: { role: 'assistant', content: '{"name":"John","age":25}' },
          },
        ],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(structuredResponse), { status: 200 });
      });

      const result = await chatStructured<{ name: string; age: number }>(
        messages,
        { name: 'extract', schema: { type: 'object' } },
        { apiKey: 'xai-test', model: 'grok-3' },
      );

      assert.equal(result.name, 'John');
      assert.equal(result.age, 25);
    });

    it('should include json_schema response format', async () => {
      const structuredResponse = {
        ...mockCompletion,
        choices: [{ ...mockCompletion.choices[0], message: { role: 'assistant', content: '{}' } }],
      };

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(structuredResponse), { status: 200 });
      });

      await chatStructured(
        messages,
        { name: 'test', description: 'Test schema', schema: { type: 'object' } },
        { apiKey: 'xai-test', model: 'grok-3' },
      );

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.response_format.type, 'json_schema');
      assert.equal(body.response_format.json_schema.name, 'test');
    });
  });

  describe('penalty parameter filtering', () => {
    it('should allow frequency_penalty for supported models', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      await chat(messages, {
        apiKey: 'xai-test',
        model: 'grok-3',
        requestOptions: { frequency_penalty: 0.5 },
      });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.frequency_penalty, 0.5);
    });

    it('should filter out frequency_penalty for unsupported models', async () => {
      // Capture console.warn
      const warnCalls: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args) => warnCalls.push(args.join(' '));

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      await chat(messages, {
        apiKey: 'xai-test',
        model: 'grok-3-mini',
        requestOptions: { frequency_penalty: 0.5, presence_penalty: 0.3 },
      });

      console.warn = originalWarn;

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.frequency_penalty, undefined);
      assert.equal(body.presence_penalty, undefined);
      assert.ok(warnCalls.some(msg => msg.includes('grok-3-mini') && msg.includes('frequency_penalty')));
    });

    it('should filter out penalties for fast models', async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      await chat(messages, {
        apiKey: 'xai-test',
        model: 'grok-4-1-fast-non-reasoning',
        requestOptions: { frequency_penalty: 0.5 },
      });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.frequency_penalty, undefined);
    });

    it('should filter out reasoning_effort (not supported by xAI API)', async () => {
      // Capture console.warn
      const warnCalls: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args) => warnCalls.push(args.join(' '));

      mockFetch.mock.mockImplementation(async () => {
        return new Response(JSON.stringify(mockCompletion), { status: 200 });
      });

      await chat(messages, {
        apiKey: 'xai-test',
        model: 'grok-4-1-fast-reasoning',
        reasoningEffort: 'high',
      });

      console.warn = originalWarn;

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.reasoning_effort, undefined);
      assert.ok(warnCalls.some(msg => msg.includes('reasoning_effort')));
      assert.ok(warnCalls.some(msg => msg.includes('Tip:')));
    });
  });
});

describe('modelSupportsPenalty', () => {
  it('should return true for grok-3', () => {
    assert.ok(modelSupportsPenalty('grok-3'));
  });

  it('should return true for grok-4-0709', () => {
    assert.ok(modelSupportsPenalty('grok-4-0709'));
  });

  it('should return false for grok-3-mini', () => {
    assert.ok(!modelSupportsPenalty('grok-3-mini'));
  });

  it('should return false for fast models', () => {
    assert.ok(!modelSupportsPenalty('grok-4-1-fast-reasoning'));
    assert.ok(!modelSupportsPenalty('grok-4-1-fast-non-reasoning'));
  });
});
