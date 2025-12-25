/**
 * Tests for Chat class.
 *
 * These tests focus on the Chat class behavior without making actual API calls.
 * Provider-level API tests are in the respective provider test files.
 *
 * @module core/chat.test
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Schema } from '../schema/index.js';
import { Chat, type ChatJSON } from './chat.js';
import { Message } from './message.js';
import { Tool } from './tool.js';

// Simple schema for tool tests
class SearchParams extends Schema {
  query = Schema.String();
}

describe('Chat', () => {
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

    it('should resolve "best" preset to gpt-5.1 for OpenAI', () => {
      const chat = new Chat({ model: 'best' });
      assert.equal(chat.model, 'gpt-5.1');
    });

    it('should resolve "cheap" preset to gpt-4o-mini for OpenAI', () => {
      const chat = new Chat({ model: 'cheap' });
      assert.equal(chat.model, 'gpt-4o-mini');
    });

    it('should resolve "balanced" preset to gpt-4o for OpenAI', () => {
      const chat = new Chat({ model: 'balanced' });
      assert.equal(chat.model, 'gpt-4o');
    });

    it('should resolve "reasoning" preset to gpt-5.1 for OpenAI', () => {
      const chat = new Chat({ model: 'reasoning' });
      assert.equal(chat.model, 'gpt-5.1');
    });

    it('should resolve preset with explicit provider', () => {
      const chat = new Chat({
        model: 'fast',
        defaults: { provider: 'anthropic' },
      });
      assert.equal(chat.model, 'claude-3-5-haiku-20241022');
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
});
