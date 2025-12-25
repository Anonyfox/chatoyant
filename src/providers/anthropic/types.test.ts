/**
 * Tests for Anthropic type definitions.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  ContentBlock,
  Message,
  MessagesRequest,
  MessagesResponse,
  ResponseContentBlock,
  Role,
  StopReason,
  StreamEvent,
  Tool,
  ToolChoice,
  ToolUseBlock,
  Usage,
} from './types.js';

describe('Anthropic types', () => {
  describe('Role', () => {
    it('should allow valid roles', () => {
      const roles: Role[] = ['user', 'assistant'];
      assert.equal(roles.length, 2);
    });
  });

  describe('StopReason', () => {
    it('should allow valid stop reasons', () => {
      const reasons: StopReason[] = ['end_turn', 'max_tokens', 'stop_sequence', 'tool_use'];
      assert.equal(reasons.length, 4);
    });
  });

  describe('Message', () => {
    it('should allow string content', () => {
      const msg: Message = { role: 'user', content: 'Hello' };
      assert.equal(msg.content, 'Hello');
    });

    it('should allow array content', () => {
      const blocks: ContentBlock[] = [
        { type: 'text', text: 'Hello' },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'base64data' } },
      ];
      const msg: Message = { role: 'user', content: blocks };
      assert.ok(Array.isArray(msg.content));
    });
  });

  describe('Tool', () => {
    it('should define tool with input schema', () => {
      const tool: Tool = {
        name: 'get_weather',
        description: 'Get weather for a location',
        input_schema: {
          type: 'object',
          properties: {
            location: { type: 'string' },
          },
          required: ['location'],
        },
      };
      assert.equal(tool.name, 'get_weather');
    });
  });

  describe('ToolUseBlock', () => {
    it('should structure tool use', () => {
      const block: ToolUseBlock = {
        type: 'tool_use',
        id: 'call_123',
        name: 'get_weather',
        input: { location: 'NYC' },
      };
      assert.equal(block.name, 'get_weather');
    });
  });

  describe('ToolChoice', () => {
    it('should allow auto', () => {
      const choice: ToolChoice = { type: 'auto' };
      assert.equal(choice.type, 'auto');
    });

    it('should allow any', () => {
      const choice: ToolChoice = { type: 'any' };
      assert.equal(choice.type, 'any');
    });

    it('should allow none', () => {
      const choice: ToolChoice = { type: 'none' };
      assert.equal(choice.type, 'none');
    });

    it('should allow specific tool', () => {
      const choice: ToolChoice = { type: 'tool', name: 'specific_tool' };
      assert.equal(choice.type, 'tool');
    });
  });

  describe('MessagesRequest', () => {
    it('should have required fields', () => {
      const req: MessagesRequest = {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1024,
      };
      assert.equal(req.model, 'claude-sonnet-4-20250514');
      assert.equal(req.max_tokens, 1024);
    });

    it('should allow optional fields', () => {
      const req: MessagesRequest = {
        model: 'claude-sonnet-4-20250514',
        messages: [],
        max_tokens: 1024,
        system: 'You are helpful.',
        temperature: 0.7,
        tools: [],
        stream: true,
      };
      assert.equal(req.temperature, 0.7);
    });
  });

  describe('Usage', () => {
    it('should track token counts', () => {
      const usage: Usage = {
        input_tokens: 10,
        output_tokens: 20,
      };
      assert.equal(usage.input_tokens, 10);
      assert.equal(usage.output_tokens, 20);
    });

    it('should allow cache token counts', () => {
      const usage: Usage = {
        input_tokens: 100,
        output_tokens: 200,
        cache_creation_input_tokens: 50,
        cache_read_input_tokens: 25,
      };
      assert.equal(usage.cache_creation_input_tokens, 50);
    });
  });

  describe('MessagesResponse', () => {
    it('should structure complete response', () => {
      const response: MessagesResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!' }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 5 },
      };
      assert.equal(response.type, 'message');
    });
  });

  describe('ResponseContentBlock', () => {
    it('should allow text block', () => {
      const block: ResponseContentBlock = { type: 'text', text: 'Hello' };
      assert.equal(block.type, 'text');
    });

    it('should allow tool_use block', () => {
      const block: ResponseContentBlock = {
        type: 'tool_use',
        id: 'call_1',
        name: 'test',
        input: {},
      };
      assert.equal(block.type, 'tool_use');
    });

    it('should allow thinking block', () => {
      const block: ResponseContentBlock = {
        type: 'thinking',
        thinking: 'Let me think...',
      };
      assert.equal(block.type, 'thinking');
    });
  });

  describe('StreamEvent', () => {
    it('should have message_start type', () => {
      const event: StreamEvent = {
        type: 'message_start',
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
      };
      assert.equal(event.type, 'message_start');
    });

    it('should have content_block_delta type', () => {
      const event: StreamEvent = {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Hello' },
      };
      assert.equal(event.type, 'content_block_delta');
    });

    it('should have message_stop type', () => {
      const event: StreamEvent = { type: 'message_stop' };
      assert.equal(event.type, 'message_stop');
    });
  });
});
