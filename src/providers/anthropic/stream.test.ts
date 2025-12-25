/**
 * Tests for Anthropic SSE stream parsing.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  accumulatorToToolUses,
  createAccumulator,
  parseSSEStream,
  updateAccumulator,
} from './stream.js';
import type { StreamEvent } from './types.js';

describe('stream utilities', () => {
  describe('parseSSEStream', () => {
    it('should parse Anthropic SSE format', async () => {
      const events: StreamEvent[] = [];
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('event: message_start\n'));
          controller.enqueue(
            encoder.encode(
              'data: {"message":{"id":"msg_123","type":"message","role":"assistant","content":[],"model":"claude-3","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":0}}}\n\n',
            ),
          );
          controller.enqueue(encoder.encode('event: content_block_start\n'));
          controller.enqueue(
            encoder.encode('data: {"index":0,"content_block":{"type":"text","text":""}}\n\n'),
          );
          controller.enqueue(encoder.encode('event: message_stop\n'));
          controller.enqueue(encoder.encode('data: {}\n\n'));
          controller.close();
        },
      });

      const response = new Response(stream);

      for await (const event of parseSSEStream(response)) {
        events.push(event);
      }

      assert.equal(events.length, 3);
      assert.equal(events[0].type, 'message_start');
      assert.equal(events[1].type, 'content_block_start');
      assert.equal(events[2].type, 'message_stop');
    });

    it('should skip ping events', async () => {
      const events: StreamEvent[] = [];
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('event: ping\n'));
          controller.enqueue(encoder.encode('data: {}\n\n'));
          controller.enqueue(encoder.encode('event: message_stop\n'));
          controller.enqueue(encoder.encode('data: {}\n\n'));
          controller.close();
        },
      });

      const response = new Response(stream);

      for await (const event of parseSSEStream(response)) {
        events.push(event);
      }

      assert.equal(events.length, 1);
      assert.equal(events[0].type, 'message_stop');
    });

    it('should handle split chunks', async () => {
      const events: StreamEvent[] = [];
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('event: message_'));
          controller.enqueue(encoder.encode('stop\ndata: {}\n\n'));
          controller.close();
        },
      });

      const response = new Response(stream);

      for await (const event of parseSSEStream(response)) {
        events.push(event);
      }

      assert.equal(events.length, 1);
      assert.equal(events[0].type, 'message_stop');
    });

    it('should throw if body is null', async () => {
      const response = { body: null } as unknown as Response;

      await assert.rejects(async () => {
        for await (const _ of parseSSEStream(response)) {
          // consume
        }
      }, /Response body is null/);
    });
  });

  describe('createAccumulator', () => {
    it('should create empty accumulator', () => {
      const acc = createAccumulator();

      assert.equal(acc.id, '');
      assert.equal(acc.model, '');
      assert.equal(acc.content, '');
      assert.equal(acc.thinking, '');
      assert.equal(acc.toolUses.size, 0);
      assert.equal(acc.stopReason, null);
      assert.equal(acc.usage, null);
    });
  });

  describe('updateAccumulator', () => {
    it('should update on message_start', () => {
      const acc = createAccumulator();
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

      updateAccumulator(acc, event);

      assert.equal(acc.id, 'msg_123');
      assert.equal(acc.model, 'claude-3');
      assert.deepEqual(acc.usage, { input_tokens: 10, output_tokens: 0 });
    });

    it('should accumulate text deltas', () => {
      const acc = createAccumulator();

      updateAccumulator(acc, {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Hello' },
      });

      assert.equal(acc.content, 'Hello');

      updateAccumulator(acc, {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: ' World' },
      });

      assert.equal(acc.content, 'Hello World');
    });

    it('should accumulate thinking deltas', () => {
      const acc = createAccumulator();

      updateAccumulator(acc, {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'thinking_delta', thinking: 'Let me think...' },
      });

      assert.equal(acc.thinking, 'Let me think...');
    });

    it('should accumulate tool use', () => {
      const acc = createAccumulator();

      updateAccumulator(acc, {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'tool_use', id: 'call_123', name: 'get_weather', input: {} },
      });

      updateAccumulator(acc, {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: '{"loc' },
      });

      updateAccumulator(acc, {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: 'ation":"NYC"}' },
      });

      updateAccumulator(acc, { type: 'content_block_stop', index: 0 });

      const toolUses = accumulatorToToolUses(acc);
      assert.equal(toolUses.length, 1);
      assert.equal(toolUses[0].name, 'get_weather');
      assert.deepEqual(toolUses[0].input, { location: 'NYC' });
    });

    it('should update stop reason on message_delta', () => {
      const acc = createAccumulator();
      acc.usage = { input_tokens: 10, output_tokens: 0 };

      updateAccumulator(acc, {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: 50 },
      });

      assert.equal(acc.stopReason, 'end_turn');
      assert.equal(acc.usage?.output_tokens, 50);
    });
  });

  describe('accumulatorToToolUses', () => {
    it('should convert empty accumulator', () => {
      const acc = createAccumulator();
      const toolUses = accumulatorToToolUses(acc);

      assert.deepEqual(toolUses, []);
    });

    it('should convert tool uses', () => {
      const acc = createAccumulator();
      acc.toolUses.set(0, { type: 'tool_use', id: 'call_1', name: 'func1', input: { a: 1 } });
      acc.toolUses.set(1, { type: 'tool_use', id: 'call_2', name: 'func2', input: { b: 2 } });

      const toolUses = accumulatorToToolUses(acc);

      assert.equal(toolUses.length, 2);
      assert.equal(toolUses[0].name, 'func1');
      assert.equal(toolUses[1].name, 'func2');
    });
  });
});
