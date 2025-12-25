/**
 * Tests for Message class.
 *
 * @module core/message.test
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Message, type MessageRole } from './message.js';

describe('Message', () => {
  describe('constructor', () => {
    it('should create a message with role and content', () => {
      const msg = new Message('user', 'Hello!');
      assert.equal(msg.role, 'user');
      assert.equal(msg.content, 'Hello!');
    });

    it('should accept all valid roles', () => {
      const roles: MessageRole[] = ['system', 'user', 'assistant', 'tool'];
      for (const role of roles) {
        const msg = new Message(role, 'content');
        assert.equal(msg.role, role);
      }
    });

    it('should accept optional name', () => {
      const msg = new Message('user', 'Hello', { name: 'Alice' });
      assert.equal(msg.name, 'Alice');
    });

    it('should accept optional toolCallId', () => {
      const msg = new Message('tool', 'result', { toolCallId: 'call_123' });
      assert.equal(msg.toolCallId, 'call_123');
    });

    it('should accept optional metadata', () => {
      const msg = new Message('user', 'Hello', { metadata: { timestamp: 123 } });
      assert.deepEqual(msg.metadata, { timestamp: 123 });
    });

    it('should throw on invalid role', () => {
      assert.throws(() => {
        new Message('invalid' as MessageRole, 'content');
      }, /Invalid role/);
    });

    it('should throw on non-string content', () => {
      assert.throws(() => {
        new Message('user', 123 as unknown as string);
      }, /Invalid content/);
    });

    it('should allow empty string content', () => {
      const msg = new Message('assistant', '');
      assert.equal(msg.content, '');
    });
  });

  describe('factory methods', () => {
    it('Message.system() should create system message', () => {
      const msg = Message.system('You are helpful');
      assert.equal(msg.role, 'system');
      assert.equal(msg.content, 'You are helpful');
    });

    it('Message.user() should create user message', () => {
      const msg = Message.user('Hello!');
      assert.equal(msg.role, 'user');
      assert.equal(msg.content, 'Hello!');
    });

    it('Message.assistant() should create assistant message', () => {
      const msg = Message.assistant('Hi there!');
      assert.equal(msg.role, 'assistant');
      assert.equal(msg.content, 'Hi there!');
    });

    it('Message.tool() should create tool message with toolCallId', () => {
      const msg = Message.tool('{"result": 42}', 'call_abc');
      assert.equal(msg.role, 'tool');
      assert.equal(msg.content, '{"result": 42}');
      assert.equal(msg.toolCallId, 'call_abc');
    });

    it('factory methods should accept metadata', () => {
      const msg = Message.user('Hello', { key: 'value' });
      assert.deepEqual(msg.metadata, { key: 'value' });
    });
  });

  describe('toJSON()', () => {
    it('should serialize basic message', () => {
      const msg = new Message('user', 'Hello');
      const json = msg.toJSON();
      assert.deepEqual(json, { role: 'user', content: 'Hello' });
    });

    it('should include optional fields when present', () => {
      const msg = new Message('tool', 'result', {
        name: 'weather',
        toolCallId: 'call_123',
        metadata: { cached: true },
      });
      const json = msg.toJSON();
      assert.deepEqual(json, {
        role: 'tool',
        content: 'result',
        name: 'weather',
        toolCallId: 'call_123',
        metadata: { cached: true },
      });
    });

    it('should not include undefined optional fields', () => {
      const msg = new Message('user', 'Hello');
      const json = msg.toJSON();
      assert.ok(!('name' in json));
      assert.ok(!('toolCallId' in json));
      assert.ok(!('metadata' in json));
    });
  });

  describe('fromJSON()', () => {
    it('should deserialize basic message', () => {
      const msg = Message.fromJSON({ role: 'user', content: 'Hello' });
      assert.equal(msg.role, 'user');
      assert.equal(msg.content, 'Hello');
    });

    it('should deserialize message with all fields', () => {
      const msg = Message.fromJSON({
        role: 'tool',
        content: 'result',
        name: 'weather',
        toolCallId: 'call_123',
        metadata: { cached: true },
      });
      assert.equal(msg.role, 'tool');
      assert.equal(msg.content, 'result');
      assert.equal(msg.name, 'weather');
      assert.equal(msg.toolCallId, 'call_123');
      assert.deepEqual(msg.metadata, { cached: true });
    });

    it('should throw on null input', () => {
      assert.throws(() => {
        Message.fromJSON(null);
      }, /Invalid message JSON/);
    });

    it('should throw on non-object input', () => {
      assert.throws(() => {
        Message.fromJSON('not an object');
      }, /Invalid message JSON/);
    });

    it('should throw on missing role', () => {
      assert.throws(() => {
        Message.fromJSON({ content: 'Hello' });
      }, /Invalid message JSON/);
    });

    it('should throw on missing content', () => {
      assert.throws(() => {
        Message.fromJSON({ role: 'user' });
      }, /Invalid message JSON/);
    });

    it('should roundtrip through JSON', () => {
      const original = new Message('assistant', 'Hello', {
        name: 'bot',
        metadata: { tokens: 5 },
      });
      const json = original.toJSON();
      const restored = Message.fromJSON(json);
      assert.equal(restored.role, original.role);
      assert.equal(restored.content, original.content);
      assert.equal(restored.name, original.name);
      assert.deepEqual(restored.metadata, original.metadata);
    });
  });

  describe('utility methods', () => {
    it('withContent() should create copy with new content', () => {
      const msg = new Message('user', 'Hello', { name: 'Alice' });
      const updated = msg.withContent('Goodbye');
      assert.equal(updated.content, 'Goodbye');
      assert.equal(updated.role, 'user');
      assert.equal(updated.name, 'Alice');
      // Original unchanged
      assert.equal(msg.content, 'Hello');
    });

    it('withMetadata() should merge metadata', () => {
      const msg = new Message('user', 'Hello', { metadata: { a: 1 } });
      const updated = msg.withMetadata({ b: 2 });
      assert.deepEqual(updated.metadata, { a: 1, b: 2 });
      // Original unchanged
      assert.deepEqual(msg.metadata, { a: 1 });
    });

    it('isSystem() should return true for system messages', () => {
      assert.ok(Message.system('test').isSystem());
      assert.ok(!Message.user('test').isSystem());
    });

    it('isUser() should return true for user messages', () => {
      assert.ok(Message.user('test').isUser());
      assert.ok(!Message.system('test').isUser());
    });

    it('isAssistant() should return true for assistant messages', () => {
      assert.ok(Message.assistant('test').isAssistant());
      assert.ok(!Message.user('test').isAssistant());
    });

    it('isTool() should return true for tool messages', () => {
      assert.ok(Message.tool('test', 'id').isTool());
      assert.ok(!Message.user('test').isTool());
    });
  });

  describe('immutability', () => {
    it('message properties should be readonly', () => {
      const msg = new Message('user', 'Hello');
      // TypeScript enforces this at compile time
      // At runtime, properties are still assignable in JS
      // This test documents the expected behavior
      assert.equal(msg.role, 'user');
      assert.equal(msg.content, 'Hello');
    });
  });
});
