/**
 * Tests for Chat class.
 *
 * These tests focus on the Chat class behavior without making actual API calls.
 * Provider-level API tests are in the respective provider test files.
 *
 * @module core/chat.test
 */

import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { Schema } from '../schema/index.js';
import { Chat, type ChatJSON, createAsyncChannel } from './chat.js';
import { Message } from './message.js';
import { Tool } from './tool.js';

// Simple schema for tool tests
class SearchParams extends Schema {
  query = Schema.String();
}

describe('Chat', () => {
  describe('Anthropic automatic caching', () => {
    let originalFetch: typeof globalThis.fetch;
    let originalApiKey: string | undefined;
    let mockFetch: ReturnType<typeof mock.fn<typeof fetch>>;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      originalApiKey = process.env.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'sk-test';
      mockFetch = mock.fn<typeof fetch>();
      globalThis.fetch = mockFetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      if (originalApiKey === undefined) {
        delete process.env.ANTHROPIC_API_KEY;
      } else {
        process.env.ANTHROPIC_API_KEY = originalApiKey;
      }
    });

    function createAnthropicResponse(body: Record<string, unknown>): Response {
      return new Response(JSON.stringify(body), { status: 200 });
    }

    function createAnthropicStreamResponse(): Response {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const events = [
            {
              event: 'message_start',
              data: {
                message: {
                  id: 'msg_123',
                  type: 'message',
                  role: 'assistant',
                  content: [],
                  model: 'claude-sonnet-4-20250514',
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
              data: { index: 0, delta: { type: 'text_delta', text: 'Hello!' } },
            },
            { event: 'content_block_stop', data: { index: 0 } },
            {
              event: 'message_delta',
              data: {
                delta: { stop_reason: 'end_turn', stop_sequence: null },
                usage: { output_tokens: 5 },
              },
            },
            { event: 'message_stop', data: {} },
          ];

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

    it('should enable automatic caching for direct Chat.generate() Anthropic requests', async () => {
      mockFetch.mock.mockImplementation(async () =>
        createAnthropicResponse({
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello!' }],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      );

      const chat = new Chat({ model: 'claude-sonnet-4-20250514' });
      chat.user('Hello');
      await chat.generate();

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.deepEqual(body.cache_control, { type: 'ephemeral' });
    });

    it('should enable automatic caching for direct Chat.stream() Anthropic requests', async () => {
      mockFetch.mock.mockImplementation(async () => createAnthropicStreamResponse());

      const chat = new Chat({ model: 'claude-sonnet-4-20250514' });
      chat.user('Hello');

      for await (const _chunk of chat.stream()) {
        // drain
      }

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.deepEqual(body.cache_control, { type: 'ephemeral' });
    });

    it('should enable automatic caching for Anthropic tool loops on every round-trip', async () => {
      let callCount = 0;
      mockFetch.mock.mockImplementation(async () => {
        callCount += 1;
        if (callCount === 1) {
          return createAnthropicResponse({
            id: 'msg_tool',
            type: 'message',
            role: 'assistant',
            content: [
              { type: 'tool_use', id: 'call_1', name: 'search', input: { query: 'weather' } },
            ],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'tool_use',
            stop_sequence: null,
            usage: { input_tokens: 10, output_tokens: 5 },
          });
        }

        return createAnthropicResponse({
          id: 'msg_final',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Sunny.' }],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 12, output_tokens: 6 },
        });
      });

      const chat = new Chat({ model: 'claude-sonnet-4-20250514' });
      chat.user('What is the weather?');
      chat.addTool(
        new Tool({
          name: 'search',
          description: 'Searches for weather',
          parameters: SearchParams,
          execute: async () => ({ summary: 'Sunny' }),
        }),
      );

      await chat.generate();

      assert.equal(mockFetch.mock.calls.length, 2);
      for (const call of mockFetch.mock.calls) {
        const [, options] = call.arguments;
        const body = JSON.parse(options?.body as string);
        assert.deepEqual(body.cache_control, { type: 'ephemeral' });
      }
    });
  });

  describe('constructor', () => {
    it('should create chat with default model', () => {
      const chat = new Chat();
      assert.equal(chat.model, 'gpt-4o');
    });

    it('should create chat with custom model', () => {
      const chat = new Chat({ model: 'claude-sonnet-4-20250514' });
      assert.equal(chat.model, 'claude-sonnet-4-20250514');
    });

    it('should accept default options', () => {
      const chat = new Chat({
        model: 'gpt-4o',
        defaults: { temperature: 0.5 },
      });
      assert.equal(chat.model, 'gpt-4o');
    });

    it('should start with empty messages', () => {
      const chat = new Chat();
      assert.equal(chat.messages.length, 0);
    });

    it('should start with no tools', () => {
      const chat = new Chat();
      assert.equal(chat.tools.length, 0);
    });

    // Model Presets
    it('should resolve "fast" preset to gpt-4o-mini for OpenAI', () => {
      const chat = new Chat({ model: 'fast' });
      assert.equal(chat.model, 'gpt-4o-mini');
    });

    it('should resolve "best" preset to gpt-5.4 for OpenAI', () => {
      const chat = new Chat({ model: 'best' });
      assert.equal(chat.model, 'gpt-5.4');
    });

    it('should resolve "cheap" preset to gpt-5.4-mini for OpenAI', () => {
      const chat = new Chat({ model: 'cheap' });
      assert.equal(chat.model, 'gpt-5.4-mini');
    });

    it('should resolve "balanced" preset to gpt-5.4-mini for OpenAI', () => {
      const chat = new Chat({ model: 'balanced' });
      assert.equal(chat.model, 'gpt-5.4-mini');
    });

    it('should resolve "reasoning" preset to gpt-5.4-pro for OpenAI', () => {
      const chat = new Chat({ model: 'reasoning' });
      assert.equal(chat.model, 'gpt-5.4-pro');
    });

    it('should resolve preset with explicit provider', () => {
      const chat = new Chat({
        model: 'fast',
        defaults: { provider: 'anthropic' },
      });
      assert.equal(chat.model, 'claude-haiku-4-5');
    });

    it('should not modify actual model names', () => {
      const chat = new Chat({ model: 'gpt-4-turbo' });
      assert.equal(chat.model, 'gpt-4-turbo');
    });
  });

  describe('model property', () => {
    it('should allow getting model', () => {
      const chat = new Chat({ model: 'gpt-4o' });
      assert.equal(chat.model, 'gpt-4o');
    });

    it('should allow setting model', () => {
      const chat = new Chat({ model: 'gpt-4o' });
      chat.model = 'claude-sonnet-4-20250514';
      assert.equal(chat.model, 'claude-sonnet-4-20250514');
    });
  });

  describe('fluent message building', () => {
    it('system() should add system message and return this', () => {
      const chat = new Chat();
      const result = chat.system('You are helpful');
      assert.equal(result, chat);
      assert.equal(chat.messages.length, 1);
      assert.equal(chat.messages[0].role, 'system');
      assert.equal(chat.messages[0].content, 'You are helpful');
    });

    it('user() should add user message and return this', () => {
      const chat = new Chat();
      const result = chat.user('Hello!');
      assert.equal(result, chat);
      assert.equal(chat.messages.length, 1);
      assert.equal(chat.messages[0].role, 'user');
    });

    it('assistant() should add assistant message and return this', () => {
      const chat = new Chat();
      const result = chat.assistant('Hi there!');
      assert.equal(result, chat);
      assert.equal(chat.messages.length, 1);
      assert.equal(chat.messages[0].role, 'assistant');
    });

    it('should support method chaining', () => {
      const chat = new Chat();
      chat.system('System').user('User').assistant('Assistant');
      assert.equal(chat.messages.length, 3);
      assert.equal(chat.messages[0].role, 'system');
      assert.equal(chat.messages[1].role, 'user');
      assert.equal(chat.messages[2].role, 'assistant');
    });

    it('should support metadata in message builders', () => {
      const chat = new Chat();
      chat.user('Hello', { timestamp: 123 });
      assert.deepEqual(chat.messages[0].metadata, { timestamp: 123 });
    });

    it('addMessage() should add raw Message instance', () => {
      const chat = new Chat();
      const msg = Message.user('Hello');
      chat.addMessage(msg);
      assert.equal(chat.messages.length, 1);
      assert.equal(chat.messages[0], msg);
    });

    it('addMessages() should add multiple messages', () => {
      const chat = new Chat();
      const messages = [Message.user('One'), Message.assistant('Two')];
      chat.addMessages(messages);
      assert.equal(chat.messages.length, 2);
    });

    it('clearMessages() should remove all messages', () => {
      const chat = new Chat();
      chat.user('One').assistant('Two');
      chat.clearMessages();
      assert.equal(chat.messages.length, 0);
    });
  });

  describe('tool registration', () => {
    const testTool = new Tool({
      name: 'search',
      description: 'Search',
      parameters: SearchParams,
      execute: async () => ({}),
    });

    it('addTool() should add tool and return this', () => {
      const chat = new Chat();
      const result = chat.addTool(testTool);
      assert.equal(result, chat);
      assert.equal(chat.tools.length, 1);
      assert.equal(chat.tools[0], testTool);
    });

    it('addTools() should add multiple tools', () => {
      const chat = new Chat();
      const tool2 = new Tool({
        name: 'fetch',
        description: 'Fetch',
        parameters: SearchParams,
        execute: async () => ({}),
      });
      chat.addTools([testTool, tool2]);
      assert.equal(chat.tools.length, 2);
    });

    it('clearTools() should remove all tools', () => {
      const chat = new Chat();
      chat.addTool(testTool);
      chat.clearTools();
      assert.equal(chat.tools.length, 0);
    });

    it('tools should be readonly', () => {
      const chat = new Chat();
      chat.addTool(testTool);
      // Can read
      assert.equal(chat.tools.length, 1);
      // TypeScript prevents direct assignment
    });
  });

  describe('toJSON()', () => {
    it('should serialize empty chat', () => {
      const chat = new Chat({ model: 'gpt-4o' });
      const json = chat.toJSON();
      assert.equal(json.model, 'gpt-4o');
      assert.deepEqual(json.messages, []);
    });

    it('should serialize messages', () => {
      const chat = new Chat();
      chat.system('System').user('User');
      const json = chat.toJSON();
      assert.equal(json.messages.length, 2);
      assert.equal(json.messages[0].role, 'system');
      assert.equal(json.messages[0].content, 'System');
    });

    it('should include config if defaults set', () => {
      const chat = new Chat({
        model: 'gpt-4o',
        defaults: { temperature: 0.5 },
      });
      const json = chat.toJSON();
      assert.ok(json.config);
      assert.deepEqual(json.config?.defaults, { temperature: 0.5 });
    });

    it('should not include config if no defaults', () => {
      const chat = new Chat({ model: 'gpt-4o' });
      const json = chat.toJSON();
      assert.ok(!json.config);
    });
  });

  describe('stringify()', () => {
    it('should return JSON string', () => {
      const chat = new Chat();
      chat.user('Hello');
      const str = chat.stringify();
      assert.ok(typeof str === 'string');
      const parsed = JSON.parse(str);
      assert.equal(parsed.messages[0].content, 'Hello');
    });

    it('should pretty print when requested', () => {
      const chat = new Chat();
      chat.user('Hello');
      const pretty = chat.stringify(true);
      const compact = chat.stringify(false);
      assert.ok(pretty.includes('\n'));
      assert.ok(!compact.includes('\n'));
    });
  });

  describe('fromJSON() instance method', () => {
    it('should restore model', () => {
      const chat = new Chat();
      chat.fromJSON({ model: 'claude-sonnet-4-20250514', messages: [] });
      assert.equal(chat.model, 'claude-sonnet-4-20250514');
    });

    it('should restore messages', () => {
      const chat = new Chat();
      chat.fromJSON({
        model: 'gpt-4o',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi' },
        ],
      });
      assert.equal(chat.messages.length, 2);
      assert.equal(chat.messages[0].content, 'Hello');
    });

    it('should replace existing messages', () => {
      const chat = new Chat();
      chat.user('Old message');
      chat.fromJSON({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'New message' }],
      });
      assert.equal(chat.messages.length, 1);
      assert.equal(chat.messages[0].content, 'New message');
    });

    it('should restore config defaults', () => {
      const chat = new Chat();
      chat.fromJSON({
        model: 'gpt-4o',
        messages: [],
        config: { defaults: { temperature: 0.8 } },
      });
      // Defaults are internal, verify via toJSON roundtrip
      const json = chat.toJSON();
      assert.deepEqual(json.config?.defaults, { temperature: 0.8 });
    });

    it('should throw on invalid JSON', () => {
      const chat = new Chat();
      assert.throws(() => {
        chat.fromJSON(null as unknown as ChatJSON);
      }, /Invalid chat JSON/);
    });

    it('should return this for chaining', () => {
      const chat = new Chat();
      const result = chat.fromJSON({ model: 'gpt-4o', messages: [] });
      assert.equal(result, chat);
    });
  });

  describe('Chat.fromJSON() static method', () => {
    it('should create new chat from object', () => {
      const chat = Chat.fromJSON({
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
      });
      assert.equal(chat.model, 'claude-sonnet-4-20250514');
      assert.equal(chat.messages.length, 1);
    });

    it('should create new chat from string', () => {
      const json = JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
      });
      const chat = Chat.fromJSON(json);
      assert.equal(chat.model, 'gpt-4o');
      assert.equal(chat.messages[0].content, 'Hello');
    });
  });

  describe('clone()', () => {
    it('should create independent copy', () => {
      const original = new Chat({ model: 'gpt-4o' });
      original.user('Hello');
      const clone = original.clone();

      assert.notEqual(clone, original);
      assert.equal(clone.model, 'gpt-4o');
      assert.equal(clone.messages.length, 1);

      // Modifications don't affect original
      clone.user('Another');
      assert.equal(original.messages.length, 1);
      assert.equal(clone.messages.length, 2);
    });

    it('should copy tools', () => {
      const tool = new Tool({
        name: 'test',
        description: 'Test',
        parameters: SearchParams,
        execute: async () => ({}),
      });
      const original = new Chat();
      original.addTool(tool);
      const clone = original.clone();

      assert.equal(clone.tools.length, 1);
      assert.equal(clone.tools[0], tool); // Same tool reference
    });

    it('should deep copy message metadata', () => {
      const original = new Chat();
      original.user('Hello', { data: { nested: true } });
      const clone = original.clone();

      // Metadata should be copied
      assert.deepEqual(clone.messages[0].metadata, { data: { nested: true } });
    });
  });

  describe('fork()', () => {
    it('should be an alias for clone()', () => {
      const original = new Chat();
      original.user('Hello');
      const forked = original.fork();

      assert.equal(forked.messages.length, 1);
      assert.notEqual(forked, original);
    });
  });

  describe('serialization roundtrip', () => {
    it('should preserve all data through JSON roundtrip', () => {
      const original = new Chat({ model: 'gpt-4o', defaults: { temperature: 0.7 } });
      original.system('System prompt');
      original.user('User message');
      original.assistant('Assistant response');

      const json = original.toJSON();
      const restored = Chat.fromJSON(json);

      assert.equal(restored.model, original.model);
      assert.equal(restored.messages.length, original.messages.length);
      for (let i = 0; i < original.messages.length; i++) {
        assert.equal(restored.messages[i].role, original.messages[i].role);
        assert.equal(restored.messages[i].content, original.messages[i].content);
      }
    });

    it('should preserve message metadata through roundtrip', () => {
      const original = new Chat();
      original.user('Hello', { custom: 'data', nested: { value: 42 } });

      const json = original.toJSON();
      const restored = Chat.fromJSON(json);

      assert.deepEqual(restored.messages[0].metadata, original.messages[0].metadata);
    });

    it('should handle string roundtrip', () => {
      const original = new Chat({ model: 'claude-sonnet-4-20250514' });
      original.user('Test');

      const str = original.stringify();
      const restored = Chat.fromJSON(str);

      assert.equal(restored.model, 'claude-sonnet-4-20250514');
      assert.equal(restored.messages[0].content, 'Test');
    });
  });

  describe('messages property', () => {
    it('should be readonly array', () => {
      const chat = new Chat();
      chat.user('Hello');
      const messages = chat.messages;
      assert.ok(Array.isArray(messages));
      // TypeScript enforces readonly at compile time
    });

    it('should reflect added messages', () => {
      const chat = new Chat();
      assert.equal(chat.messages.length, 0);
      chat.user('One');
      assert.equal(chat.messages.length, 1);
      chat.assistant('Two');
      assert.equal(chat.messages.length, 2);
    });
  });

  describe('_getSystemPrompt()', () => {
    it('should return undefined when no system messages', () => {
      const chat = new Chat();
      chat.user('Hello');
      assert.equal((chat as any)._getSystemPrompt(), undefined);
    });

    it('should return single system message content', () => {
      const chat = new Chat();
      chat.system('You are helpful');
      chat.user('Hello');
      assert.equal((chat as any)._getSystemPrompt(), 'You are helpful');
    });

    it('should join multiple system messages with double newline', () => {
      const chat = new Chat();
      chat.system('You are helpful');
      chat.system('Be concise');
      chat.user('Hello');
      assert.equal((chat as any)._getSystemPrompt(), 'You are helpful\n\nBe concise');
    });

    it('should return undefined for empty messages list', () => {
      const chat = new Chat();
      assert.equal((chat as any)._getSystemPrompt(), undefined);
    });
  });

  describe('_formatMessages() for Anthropic', () => {
    it('should strip system messages from Anthropic message array', () => {
      const chat = new Chat();
      chat.system('You are helpful');
      chat.user('Hello');
      chat.assistant('Hi');
      const messages = (chat as any)._formatMessages('anthropic');
      assert.equal(messages.length, 2);
      assert.equal(messages[0].role, 'user');
      assert.equal(messages[1].role, 'assistant');
    });

    it('should keep system messages for OpenAI', () => {
      const chat = new Chat();
      chat.system('You are helpful');
      chat.user('Hello');
      const messages = (chat as any)._formatMessages('openai');
      assert.equal(messages.length, 2);
      assert.equal(messages[0].role, 'system');
      assert.equal(messages[1].role, 'user');
    });

    it('should keep system messages for xAI', () => {
      const chat = new Chat();
      chat.system('You are helpful');
      chat.user('Hello');
      const messages = (chat as any)._formatMessages('xai');
      assert.equal(messages.length, 2);
      assert.equal(messages[0].role, 'system');
    });

    it('system prompt and formatted messages should be complementary for Anthropic', () => {
      const chat = new Chat();
      chat.system('Be helpful');
      chat.system('Be concise');
      chat.user('Hello');
      chat.assistant('Hi');
      chat.user('How are you?');

      const messages = (chat as any)._formatMessages('anthropic');
      const systemPrompt = (chat as any)._getSystemPrompt();

      assert.equal(systemPrompt, 'Be helpful\n\nBe concise');
      assert.equal(messages.length, 3);
      assert.ok(messages.every((m: any) => m.role !== 'system'));
    });

    it('should format assistant tool call messages for OpenAI/xAI', () => {
      const chat = new Chat();
      chat.user('search for cats');
      (chat as any)._messages.push(
        Message.assistantToolCall([{ id: 'call_1', name: 'search', arguments: '{"q":"cats"}' }]),
      );
      (chat as any)._messages.push(Message.tool('found 5 results', 'call_1'));
      chat.assistant('Here are the results.');

      const messages = (chat as any)._formatMessages('openai');
      assert.equal(messages.length, 4);

      assert.equal(messages[1].role, 'assistant');
      assert.equal(messages[1].content, null);
      assert.equal(messages[1].tool_calls.length, 1);
      assert.equal(messages[1].tool_calls[0].id, 'call_1');
      assert.equal(messages[1].tool_calls[0].type, 'function');
      assert.equal(messages[1].tool_calls[0].function.name, 'search');

      assert.equal(messages[2].role, 'tool');
      assert.equal(messages[2].tool_call_id, 'call_1');
      assert.equal(messages[2].content, 'found 5 results');
    });

    it('should format assistant tool call messages for Anthropic', () => {
      const chat = new Chat();
      chat.user('search for cats');
      (chat as any)._messages.push(
        Message.assistantToolCall([{ id: 'call_1', name: 'search', arguments: '{"q":"cats"}' }]),
      );
      (chat as any)._messages.push(Message.tool('found 5 results', 'call_1'));
      chat.assistant('Here are the results.');

      const messages = (chat as any)._formatMessages('anthropic');
      assert.equal(messages.length, 4);

      assert.equal(messages[1].role, 'assistant');
      assert.equal(messages[1].content[0].type, 'tool_use');
      assert.equal(messages[1].content[0].id, 'call_1');
      assert.equal(messages[1].content[0].name, 'search');
      assert.deepEqual(messages[1].content[0].input, { q: 'cats' });

      assert.equal(messages[2].role, 'user');
      assert.equal(messages[2].content[0].type, 'tool_result');
      assert.equal(messages[2].content[0].tool_use_id, 'call_1');
    });

    it('should group consecutive tool results for Anthropic', () => {
      const chat = new Chat();
      chat.user('search for cats and dogs');
      (chat as any)._messages.push(
        Message.assistantToolCall([
          { id: 'call_1', name: 'search', arguments: '{"q":"cats"}' },
          { id: 'call_2', name: 'search', arguments: '{"q":"dogs"}' },
        ]),
      );
      (chat as any)._messages.push(Message.tool('cats result', 'call_1'));
      (chat as any)._messages.push(Message.tool('dogs result', 'call_2'));
      chat.assistant('Here are both results.');

      const messages = (chat as any)._formatMessages('anthropic');
      assert.equal(messages.length, 4);

      // tool_use content should have both calls
      assert.equal(messages[1].content.length, 2);

      // tool_result user message should have both results grouped
      assert.equal(messages[2].role, 'user');
      assert.equal(messages[2].content.length, 2);
      assert.equal(messages[2].content[0].tool_use_id, 'call_1');
      assert.equal(messages[2].content[1].tool_use_id, 'call_2');
    });

    it('should persist tool interactions through toJSON/fromJSON', () => {
      const chat = new Chat({ model: 'gpt-4o' });
      chat.user('search for cats');
      (chat as any)._messages.push(
        Message.assistantToolCall([{ id: 'call_1', name: 'search', arguments: '{"q":"cats"}' }]),
      );
      (chat as any)._messages.push(Message.tool('found 5 results', 'call_1'));
      chat.assistant('Here are the results.');

      const json = chat.toJSON();
      const restored = Chat.fromJSON(json);
      const restoredMessages = (restored as any)._messages;

      assert.equal(restoredMessages.length, 4);
      assert.ok(restoredMessages[1].hasToolCalls());
      assert.equal(restoredMessages[1].toolCalls[0].name, 'search');
      assert.ok(restoredMessages[2].isTool());
      assert.equal(restoredMessages[2].toolCallId, 'call_1');
    });
  });

  describe('_repairJsonEscapes / _parseToolArgs', () => {
    it('should preserve all valid JSON escape sequences', () => {
      const chat = new Chat();
      const repair = (s: string) => (chat as any)._repairJsonEscapes(s);

      assert.equal(repair('{"a": "hello\\nworld"}'), '{"a": "hello\\nworld"}');
      assert.equal(repair('{"a": "tab\\there"}'), '{"a": "tab\\there"}');
      assert.equal(repair('{"a": "quote\\"here"}'), '{"a": "quote\\"here"}');
      assert.equal(repair('{"a": "back\\\\slash"}'), '{"a": "back\\\\slash"}');
      assert.equal(repair('{"a": "slash\\/here"}'), '{"a": "slash\\/here"}');
      assert.equal(repair('{"a": "\\u0041"}'), '{"a": "\\u0041"}');
      assert.equal(repair('{"a": "\\b\\f\\r"}'), '{"a": "\\b\\f\\r"}');
    });

    it('should fix invalid regex-style escapes', () => {
      const chat = new Chat();
      const repair = (s: string) => (chat as any)._repairJsonEscapes(s);

      assert.equal(repair('{"code": "\\s+"}'), '{"code": "\\\\s+"}');
      assert.equal(repair('{"code": "\\D+"}'), '{"code": "\\\\D+"}');
      assert.equal(repair('{"code": "\\w+"}'), '{"code": "\\\\w+"}');
      assert.equal(repair('{"code": "\\W\\S"}'), '{"code": "\\\\W\\\\S"}');
      assert.equal(repair('{"code": "\\d{3}"}'), '{"code": "\\\\d{3}"}');
      assert.equal(repair('{"code": "\\p{L}"}'), '{"code": "\\\\p{L}"}');
    });

    it('should handle mixed valid and invalid escapes in one string', () => {
      const chat = new Chat();
      const repair = (s: string) => (chat as any)._repairJsonEscapes(s);

      // \n is valid, \s is not → only \s gets repaired
      const input = '{"code": "line1\\n\\s+line2"}';
      const expected = '{"code": "line1\\n\\\\s+line2"}';
      assert.equal(repair(input), expected);
    });

    it('should not touch already-correct escaped backslashes before letters', () => {
      const chat = new Chat();
      const repair = (s: string) => (chat as any)._repairJsonEscapes(s);

      // \\s means: JSON escape \\ (backslash) then literal s → no change
      assert.equal(repair('{"code": "\\\\s+"}'), '{"code": "\\\\s+"}');
      // \\D same
      assert.equal(repair('{"code": "\\\\D+"}'), '{"code": "\\\\D+"}');
    });

    it('should handle incomplete unicode escapes', () => {
      const chat = new Chat();
      const repair = (s: string) => (chat as any)._repairJsonEscapes(s);

      // \u00 is incomplete → not valid → double the backslash
      assert.equal(repair('{"a": "\\u00"}'), '{"a": "\\\\u00"}');
      // \u0041 is complete → leave alone
      assert.equal(repair('{"a": "\\u0041"}'), '{"a": "\\u0041"}');
    });

    it('should handle Windows-style paths correctly', () => {
      const chat = new Chat();
      const repair = (s: string) => (chat as any)._repairJsonEscapes(s);

      // C:\\Users\\foo → each \\ is a valid escape pair → no change
      assert.equal(repair('{"path": "C:\\\\Users\\\\foo"}'), '{"path": "C:\\\\Users\\\\foo"}');
    });

    it('should parse tool args with invalid escapes and preserve backslashes', () => {
      const chat = new Chat();
      const parse = (s: string) => (chat as any)._parseToolArgs(s);

      // The JSON string has \s (invalid) → repair makes it \\s → parse produces \s
      const result = parse('{"pattern": "\\s+"}');
      assert.equal(result.pattern, '\\s+');
    });

    it('should parse tool args with multiple regex patterns', () => {
      const chat = new Chat();
      const parse = (s: string) => (chat as any)._parseToolArgs(s);

      const result = parse('{"re": "^\\d{3}-\\d{2}-\\d{4}$"}');
      assert.equal(result.re, '^\\d{3}-\\d{2}-\\d{4}$');
    });

    it('should parse valid tool args with no repair needed', () => {
      const chat = new Chat();
      const parse = (s: string) => (chat as any)._parseToolArgs(s);

      const result = parse('{"q": "hello world", "limit": 10}');
      assert.equal(result.q, 'hello world');
      assert.equal(result.limit, 10);
    });

    it('should preserve real newlines and tabs', () => {
      const chat = new Chat();
      const parse = (s: string) => (chat as any)._parseToolArgs(s);

      const result = parse('{"content": "line1\\nline2\\ttab"}');
      assert.equal(result.content, 'line1\nline2\ttab');
    });

    it('should handle complex code content with mixed escapes', () => {
      const chat = new Chat();
      const parse = (s: string) => (chat as any)._parseToolArgs(s);

      // Code containing: const re = /\s+\d/g;\n (newline) console.log(re);
      // In correct JSON: \\s and \\d are literal, \n is newline
      const json = '{"code": "const re = /\\\\s+\\\\d/g;\\nconsole.log(re);"}';
      const result = parse(json);
      assert.ok(result.code.includes('\\s+'));
      assert.ok(result.code.includes('\\d'));
      assert.ok(result.code.includes('\n'));
    });
  });

  describe('stream() tool awareness', () => {
    const testTool = new Tool({
      name: 'lookup',
      description: 'Look up data',
      parameters: SearchParams,
      execute: async () => ({ result: 'found' }),
    });

    it('should have _streamWithToolLoop method', () => {
      const chat = new Chat();
      assert.equal(typeof (chat as any)._streamWithToolLoop, 'function');
    });

    it('should have _streamDirect method', () => {
      const chat = new Chat();
      assert.equal(typeof (chat as any)._streamDirect, 'function');
    });

    it('should have _streamAccumulateWithTools method', () => {
      const chat = new Chat();
      assert.equal(typeof (chat as any)._streamAccumulateWithTools, 'function');
    });

    it('stream() should be an async generator', () => {
      const chat = new Chat();
      chat.user('Hello');
      const gen = chat.stream();
      assert.equal(typeof gen[Symbol.asyncIterator], 'function');
    });

    it('_buildToolDefinitions should format tools for provider', () => {
      const chat = new Chat();
      chat.addTool(testTool);
      const defs = (chat as any)._buildToolDefinitions('openai');
      assert.equal(defs.length, 1);
      assert.equal(defs[0].name, 'lookup');
      assert.equal(defs[0].description, 'Look up data');
      assert.ok(defs[0].parameters);
    });

    it('_appendToolResults should format Anthropic tool results correctly', () => {
      const chat = new Chat();
      const messages = [{ role: 'user', content: 'test' }];
      const calls = [{ id: 'call_1', name: 'lookup', args: { query: 'test' } }];
      const results = [{ id: 'call_1', result: { data: 'found' }, success: true }];
      const updated = (chat as any)._appendToolResults('anthropic', messages, calls, results);

      assert.equal(updated.length, 3);
      assert.equal(updated[1].role, 'assistant');
      assert.ok(Array.isArray(updated[1].content));
      assert.equal(updated[1].content[0].type, 'tool_use');
      assert.equal(updated[2].role, 'user');
      assert.ok(Array.isArray(updated[2].content));
      assert.equal(updated[2].content[0].type, 'tool_result');
    });

    it('_appendToolResults should format OpenAI tool results correctly', () => {
      const chat = new Chat();
      const messages = [{ role: 'user', content: 'test' }];
      const calls = [{ id: 'call_1', name: 'lookup', args: { query: 'test' } }];
      const results = [{ id: 'call_1', result: { data: 'found' }, success: true }];
      const updated = (chat as any)._appendToolResults('openai', messages, calls, results);

      assert.equal(updated.length, 3);
      assert.equal(updated[1].role, 'assistant');
      assert.ok(Array.isArray(updated[1].tool_calls));
      assert.equal(updated[2].role, 'tool');
      assert.equal(updated[2].tool_call_id, 'call_1');
    });

    it('onToolCallStart and onToolCallComplete should be accepted as options', () => {
      const chat = new Chat();
      chat.addTool(testTool);
      chat.user('Hello');

      const startCalls: unknown[] = [];
      const completedResults: unknown[] = [];

      const gen = chat.stream({
        onToolCallStart: (calls) => startCalls.push(calls),
        onToolCallComplete: (results) => completedResults.push(results),
      });
      assert.equal(typeof gen[Symbol.asyncIterator], 'function');
    });

    it('onToolCallStart/onToolCallComplete should be accepted in generate options', () => {
      const chat = new Chat();
      chat.addTool(testTool);
      chat.user('Hello');

      const opts = {
        onToolCallStart: (_calls: unknown[]) => {},
        onToolCallComplete: (_results: unknown[]) => {},
      };

      assert.doesNotThrow(() => {
        const promise = chat.generate(opts);
        promise.catch(() => {});
      });
    });
  });

  describe('tool result serialization (_serializeToolResult)', () => {
    it('should pass strings through without double-stringifying', () => {
      const chat = new Chat();
      const serialize = (chat as any)._serializeToolResult.bind(chat);
      assert.equal(serialize('hello world'), 'hello world');
      assert.equal(serialize('result with "quotes"'), 'result with "quotes"');
    });

    it('should JSON.stringify objects', () => {
      const chat = new Chat();
      const serialize = (chat as any)._serializeToolResult.bind(chat);
      assert.equal(serialize({ key: 'value' }), '{"key":"value"}');
    });

    it('should JSON.stringify arrays', () => {
      const chat = new Chat();
      const serialize = (chat as any)._serializeToolResult.bind(chat);
      assert.equal(serialize([1, 2, 3]), '[1,2,3]');
    });

    it('should JSON.stringify numbers', () => {
      const chat = new Chat();
      const serialize = (chat as any)._serializeToolResult.bind(chat);
      assert.equal(serialize(42), '42');
    });

    it('should JSON.stringify null', () => {
      const chat = new Chat();
      const serialize = (chat as any)._serializeToolResult.bind(chat);
      assert.equal(serialize(null), 'null');
    });

    it('should produce correct content in _appendToolResults for string results', () => {
      const chat = new Chat();
      const messages = [{ role: 'user', content: 'test' }];
      const calls = [{ id: 'call_1', name: 'lookup', args: {} }];
      const results = [{ id: 'call_1', result: 'plain string result', success: true }];

      const openai = (chat as any)._appendToolResults('openai', messages, calls, results);
      assert.equal(openai[2].content, 'plain string result');

      const anthropic = (chat as any)._appendToolResults('anthropic', messages, calls, results);
      assert.equal(anthropic[2].content[0].content, 'plain string result');
    });

    it('should produce correct content in _appendToolResults for object results', () => {
      const chat = new Chat();
      const messages = [{ role: 'user', content: 'test' }];
      const calls = [{ id: 'call_1', name: 'lookup', args: {} }];
      const results = [{ id: 'call_1', result: { data: 'found' }, success: true }];

      const openai = (chat as any)._appendToolResults('openai', messages, calls, results);
      assert.equal(openai[2].content, '{"data":"found"}');

      const anthropic = (chat as any)._appendToolResults('anthropic', messages, calls, results);
      assert.equal(anthropic[2].content[0].content, '{"data":"found"}');
    });

    it('should handle error results with fallback message', () => {
      const chat = new Chat();
      const messages = [{ role: 'user', content: 'test' }];
      const calls = [{ id: 'call_1', name: 'lookup', args: {} }];
      const results = [{ id: 'call_1', result: null, success: false, error: undefined }];

      const openai = (chat as any)._appendToolResults('openai', messages, calls, results);
      assert.equal(openai[2].content, 'Unknown error');
    });
  });

  describe('lastResult and usage tracking', () => {
    it('should be null before any generation', () => {
      const chat = new Chat();
      assert.equal(chat.lastResult, null);
    });

    it('should not be copied by clone()', () => {
      const chat = new Chat();
      (chat as any)._lastResult = {
        content: 'test',
        usage: {
          inputTokens: 10,
          outputTokens: 5,
          reasoningTokens: 0,
          cachedTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 15,
        },
        timing: { latencyMs: 100 },
        cost: { estimatedUsd: 0.001 },
        provider: 'openai',
        model: 'gpt-4o',
        cached: false,
        iterations: 1,
      };
      const cloned = chat.clone();
      assert.equal(cloned.lastResult, null);
    });

    it('_extractUsage should normalize OpenAI usage', () => {
      const chat = new Chat();
      const extract = (u: unknown, p: string) => (chat as any)._extractUsage(u, p);
      const usage = extract(
        {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
          completion_tokens_details: { reasoning_tokens: 10 },
          prompt_tokens_details: { cached_tokens: 20 },
        },
        'openai',
      );
      assert.equal(usage.inputTokens, 100);
      assert.equal(usage.outputTokens, 50);
      assert.equal(usage.totalTokens, 150);
      assert.equal(usage.reasoningTokens, 10);
      assert.equal(usage.cachedTokens, 20);
    });

    it('_extractUsage should normalize Anthropic usage', () => {
      const chat = new Chat();
      const extract = (u: unknown, p: string) => (chat as any)._extractUsage(u, p);
      const usage = extract(
        {
          input_tokens: 200,
          output_tokens: 80,
          cache_read_input_tokens: 50,
        },
        'anthropic',
      );
      assert.equal(usage.inputTokens, 200);
      assert.equal(usage.outputTokens, 80);
      assert.equal(usage.totalTokens, 280);
      assert.equal(usage.cachedTokens, 50);
      assert.equal(usage.cacheWriteTokens, 0);
    });

    it('_extractUsage should track Anthropic cache writes', () => {
      const chat = new Chat();
      const extract = (u: unknown, p: string) => (chat as any)._extractUsage(u, p);
      const usage = extract(
        {
          input_tokens: 200,
          output_tokens: 80,
          cache_read_input_tokens: 50,
          cache_creation_input_tokens: 25,
        },
        'anthropic',
      );
      assert.equal(usage.cacheWriteTokens, 25);
    });

    it('_extractUsage should normalize xAI usage', () => {
      const chat = new Chat();
      const extract = (u: unknown, p: string) => (chat as any)._extractUsage(u, p);
      const usage = extract(
        {
          prompt_tokens: 300,
          completion_tokens: 100,
          total_tokens: 400,
          completion_tokens_details: { reasoning_tokens: 30 },
        },
        'xai',
      );
      assert.equal(usage.inputTokens, 300);
      assert.equal(usage.outputTokens, 100);
      assert.equal(usage.totalTokens, 400);
      assert.equal(usage.reasoningTokens, 30);
      assert.equal(usage.cachedTokens, 0);
      assert.equal(usage.cacheWriteTokens, 0);
    });

    it('_extractUsage should handle null/undefined usage gracefully', () => {
      const chat = new Chat();
      const extract = (u: unknown, p: string) => (chat as any)._extractUsage(u, p);

      const fromNull = extract(null, 'openai');
      assert.equal(fromNull.inputTokens, 0);
      assert.equal(fromNull.outputTokens, 0);
      assert.equal(fromNull.totalTokens, 0);

      const fromUndefined = extract(undefined, 'anthropic');
      assert.equal(fromUndefined.inputTokens, 0);
    });

    it('_addUsage should accumulate token counts', () => {
      const chat = new Chat();
      const add = (t: any, a: any) => (chat as any)._addUsage(t, a);
      const total = {
        inputTokens: 100,
        outputTokens: 50,
        reasoningTokens: 10,
        cachedTokens: 5,
        cacheWriteTokens: 2,
        totalTokens: 150,
      };
      add(total, {
        inputTokens: 200,
        outputTokens: 80,
        reasoningTokens: 20,
        cachedTokens: 10,
        cacheWriteTokens: 3,
        totalTokens: 280,
      });
      assert.equal(total.inputTokens, 300);
      assert.equal(total.outputTokens, 130);
      assert.equal(total.reasoningTokens, 30);
      assert.equal(total.cachedTokens, 15);
      assert.equal(total.cacheWriteTokens, 5);
      assert.equal(total.totalTokens, 430);
    });

    it('_buildAndStoreResult should create and store a GenerateResult', () => {
      const chat = new Chat();
      const build = (
        content: string,
        usage: any,
        start: number,
        prov: string,
        model: string,
        iter: number,
      ) => (chat as any)._buildAndStoreResult(content, usage, start, prov, model, iter);
      const usage = {
        inputTokens: 100,
        outputTokens: 50,
        reasoningTokens: 0,
        cachedTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 150,
      };
      const startTime = Date.now() - 500;
      const result = build('Hello', usage, startTime, 'openai', 'gpt-4o', 3);

      assert.equal(result.content, 'Hello');
      assert.equal(result.provider, 'openai');
      assert.equal(result.model, 'gpt-4o');
      assert.equal(result.iterations, 3);
      assert.equal(result.cached, false);
      assert.ok(result.timing.latencyMs >= 400);
      assert.equal(result.usage.inputTokens, 100);
      assert.equal(result.usage.outputTokens, 50);
      assert.equal(chat.lastResult, result);
    });

    it('_buildAndStoreResult should detect cached responses', () => {
      const chat = new Chat();
      const build = (...args: any[]) => (chat as any)._buildAndStoreResult(...args);
      const usage = {
        inputTokens: 100,
        outputTokens: 50,
        reasoningTokens: 0,
        cachedTokens: 30,
        cacheWriteTokens: 0,
        totalTokens: 150,
      };
      const result = build('Hi', usage, Date.now(), 'openai', 'gpt-4o', 1);
      assert.equal(result.cached, true);
    });

    it('GenerateResult should include iterations field', () => {
      const chat = new Chat();
      const build = (...args: any[]) => (chat as any)._buildAndStoreResult(...args);
      const usage = {
        inputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        cachedTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 0,
      };
      const r1 = build('a', usage, Date.now(), 'openai', 'gpt-4o', 1);
      assert.equal(r1.iterations, 1);

      const r5 = build('b', usage, Date.now(), 'xai', 'grok-3', 5);
      assert.equal(r5.iterations, 5);
    });

    it('successive calls should overwrite lastResult', () => {
      const chat = new Chat();
      const build = (...args: any[]) => (chat as any)._buildAndStoreResult(...args);
      const usage = {
        inputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        cachedTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 0,
      };
      build('first', usage, Date.now(), 'openai', 'gpt-4o', 1);
      assert.equal(chat.lastResult?.content, 'first');

      build('second', usage, Date.now(), 'anthropic', 'claude-sonnet-4-20250514', 2);
      assert.equal(chat.lastResult?.content, 'second');
      assert.equal(chat.lastResult?.provider, 'anthropic');
      assert.equal(chat.lastResult?.iterations, 2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty content messages', () => {
      const chat = new Chat();
      chat.assistant('');
      assert.equal(chat.messages.length, 1);
      assert.equal(chat.messages[0].content, '');
    });

    it('should handle very long content', () => {
      const chat = new Chat();
      const longContent = 'a'.repeat(100000);
      chat.user(longContent);
      assert.equal(chat.messages[0].content.length, 100000);
    });

    it('should handle unicode content', () => {
      const chat = new Chat();
      chat.user('Hello 🌍 世界 مرحبا');
      assert.equal(chat.messages[0].content, 'Hello 🌍 世界 مرحبا');
    });

    it('should handle newlines in content', () => {
      const chat = new Chat();
      chat.user('Line 1\nLine 2\nLine 3');
      assert.ok(chat.messages[0].content.includes('\n'));
    });

    it('should preserve message order', () => {
      const chat = new Chat();
      for (let i = 0; i < 100; i++) {
        chat.user(`Message ${i}`);
      }
      for (let i = 0; i < 100; i++) {
        assert.equal(chat.messages[i].content, `Message ${i}`);
      }
    });
  });

  describe('createAsyncChannel', () => {
    it('should yield values pushed before consumption', async () => {
      const ch = createAsyncChannel<string>();
      ch.push('a');
      ch.push('b');
      ch.push('c');
      ch.close();

      const collected: string[] = [];
      for await (const v of ch) {
        collected.push(v);
      }
      assert.deepEqual(collected, ['a', 'b', 'c']);
    });

    it('should yield values pushed asynchronously', async () => {
      const ch = createAsyncChannel<string>();

      setTimeout(() => {
        ch.push('x');
        ch.push('y');
        ch.close();
      }, 10);

      const collected: string[] = [];
      for await (const v of ch) {
        collected.push(v);
      }
      assert.deepEqual(collected, ['x', 'y']);
    });

    it('should handle interleaved push and pull', async () => {
      const ch = createAsyncChannel<number>();

      const producer = async () => {
        for (let i = 0; i < 5; i++) {
          await new Promise((r) => setTimeout(r, 5));
          ch.push(i);
        }
        ch.close();
      };

      producer();
      const collected: number[] = [];
      for await (const v of ch) {
        collected.push(v);
      }
      assert.deepEqual(collected, [0, 1, 2, 3, 4]);
    });

    it('should terminate immediately when closed with no data', async () => {
      const ch = createAsyncChannel<string>();
      ch.close();

      const collected: string[] = [];
      for await (const v of ch) {
        collected.push(v);
      }
      assert.deepEqual(collected, []);
    });

    it('should deliver values in order under rapid push', async () => {
      const ch = createAsyncChannel<number>();
      const count = 1000;

      setTimeout(() => {
        for (let i = 0; i < count; i++) ch.push(i);
        ch.close();
      }, 0);

      const collected: number[] = [];
      for await (const v of ch) {
        collected.push(v);
      }
      assert.equal(collected.length, count);
      assert.equal(collected[0], 0);
      assert.equal(collected[count - 1], count - 1);
    });

    it('should bridge callback-based producer with async consumer', async () => {
      const ch = createAsyncChannel<string>();

      const simulateProvider = (onChunk: (c: string) => void) => {
        return new Promise<string>((resolve) => {
          const chunks = ['Hello', ' ', 'world', '!'];
          let i = 0;
          const timer = setInterval(() => {
            if (i < chunks.length) {
              onChunk(chunks[i]);
              i++;
            } else {
              clearInterval(timer);
              resolve(chunks.join(''));
            }
          }, 5);
        });
      };

      const resultPromise = simulateProvider((chunk) => ch.push(chunk)).then((result) => {
        ch.close();
        return result;
      });

      const collected: string[] = [];
      for await (const chunk of ch) {
        collected.push(chunk);
      }

      const finalResult = await resultPromise;
      assert.deepEqual(collected, ['Hello', ' ', 'world', '!']);
      assert.equal(finalResult, 'Hello world!');
    });
  });

  describe('streamAccumulate with tools', () => {
    it('streamAccumulate should be a function', () => {
      const chat = new Chat();
      assert.equal(typeof chat.streamAccumulate, 'function');
    });

    it('streamAccumulate should return a promise', () => {
      const chat = new Chat();
      chat.user('Hello');
      const result = chat.streamAccumulate();
      assert.ok(result instanceof Promise);
      result.catch(() => {});
    });
  });
});
