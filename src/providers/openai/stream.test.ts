/**
 * Tests for OpenAI SSE stream parsing.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  accumulatorToToolCalls,
  createAccumulator,
  parseSSEStream,
  updateAccumulator,
} from './stream.js';
import type { ChatCompletionChunk } from './types.js';

describe('stream utilities', () => {
  describe('parseSSEStream', () => {
    it('should parse SSE data lines', async () => {
      const chunks: object[] = [];
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"id":"1"}\n\n'));
          controller.enqueue(encoder.encode('data: {"id":"2"}\n\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      const response = new Response(stream);

      for await (const chunk of parseSSEStream<{ id: string }>(response)) {
        chunks.push(chunk);
      }

      assert.equal(chunks.length, 2);
      assert.deepEqual(chunks[0], { id: '1' });
      assert.deepEqual(chunks[1], { id: '2' });
    });

    it('should handle split chunks', async () => {
      const chunks: object[] = [];
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"id":"1",'));
          controller.enqueue(encoder.encode('"name":"test"}\n\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      const response = new Response(stream);

      for await (const chunk of parseSSEStream<{ id: string; name: string }>(response)) {
        chunks.push(chunk);
      }

      assert.equal(chunks.length, 1);
      assert.deepEqual(chunks[0], { id: '1', name: 'test' });
    });

    it('should skip empty lines', async () => {
      const chunks: object[] = [];
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('\n\n'));
          controller.enqueue(encoder.encode('data: {"id":"1"}\n\n'));
          controller.enqueue(encoder.encode('\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      const response = new Response(stream);

      for await (const chunk of parseSSEStream<{ id: string }>(response)) {
        chunks.push(chunk);
      }

      assert.equal(chunks.length, 1);
    });

    it('should skip comment lines', async () => {
      const chunks: object[] = [];
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(': this is a comment\n'));
          controller.enqueue(encoder.encode('data: {"id":"1"}\n\n'));
          controller.enqueue(encoder.encode(': another comment\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      const response = new Response(stream);

      for await (const chunk of parseSSEStream<{ id: string }>(response)) {
        chunks.push(chunk);
      }

      assert.equal(chunks.length, 1);
    });

    it('should throw on invalid JSON', async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {invalid json}\n\n'));
          controller.close();
        },
      });

      const response = new Response(stream);

      await assert.rejects(async () => {
        for await (const _ of parseSSEStream<object>(response)) {
          // consume
        }
      }, /Failed to parse SSE data/);
    });

    it('should throw if body is null', async () => {
      const response = {
        body: null,
      } as unknown as Response;

      await assert.rejects(async () => {
        for await (const _ of parseSSEStream<object>(response)) {
          // consume
        }
      }, /Response body is null/);
    });
  });

  describe('createAccumulator', () => {
    it('should create empty accumulator', () => {
      const acc = createAccumulator();

      assert.equal(acc.content, '');
      assert.equal(acc.toolCalls.size, 0);
      assert.equal(acc.finishReason, null);
      assert.equal(acc.usage, null);
      assert.equal(acc.model, '');
      assert.equal(acc.id, '');
    });
  });

  describe('updateAccumulator', () => {
    it('should update metadata', () => {
      const acc = createAccumulator();
      const chunk: ChatCompletionChunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4o',
        choices: [],
      };

      updateAccumulator(acc, chunk);

      assert.equal(acc.id, 'chatcmpl-123');
      assert.equal(acc.model, 'gpt-4o');
    });

    it('should accumulate content', () => {
      const acc = createAccumulator();

      updateAccumulator(acc, createChunk({ delta: { content: 'Hello' } }));
      assert.equal(acc.content, 'Hello');

      updateAccumulator(acc, createChunk({ delta: { content: ' World' } }));
      assert.equal(acc.content, 'Hello World');
    });

    it('should track finish reason', () => {
      const acc = createAccumulator();

      updateAccumulator(acc, createChunk({ finish_reason: null }));
      assert.equal(acc.finishReason, null);

      updateAccumulator(acc, createChunk({ finish_reason: 'stop' }));
      assert.equal(acc.finishReason, 'stop');
    });

    it('should accumulate tool calls', () => {
      const acc = createAccumulator();

      // First chunk: tool call start
      updateAccumulator(
        acc,
        createChunk({
          delta: {
            tool_calls: [
              {
                index: 0,
                id: 'call_123',
                type: 'function',
                function: { name: 'get_weather', arguments: '{"loc' },
              },
            ],
          },
        }),
      );

      // Second chunk: tool call continuation
      updateAccumulator(
        acc,
        createChunk({
          delta: {
            tool_calls: [
              {
                index: 0,
                function: { arguments: 'ation":"NY"}' },
              },
            ],
          },
        }),
      );

      assert.equal(acc.toolCalls.size, 1);
      const toolCall = acc.toolCalls.get(0);
      assert.equal(toolCall?.id, 'call_123');
      assert.equal(toolCall?.name, 'get_weather');
      assert.equal(toolCall?.arguments, '{"location":"NY"}');
    });

    it('should handle multiple tool calls', () => {
      const acc = createAccumulator();

      updateAccumulator(
        acc,
        createChunk({
          delta: {
            tool_calls: [
              {
                index: 0,
                id: 'call_1',
                type: 'function',
                function: { name: 'func1', arguments: '{}' },
              },
              {
                index: 1,
                id: 'call_2',
                type: 'function',
                function: { name: 'func2', arguments: '{}' },
              },
            ],
          },
        }),
      );

      assert.equal(acc.toolCalls.size, 2);
      assert.equal(acc.toolCalls.get(0)?.name, 'func1');
      assert.equal(acc.toolCalls.get(1)?.name, 'func2');
    });

    it('should update usage', () => {
      const acc = createAccumulator();
      const usage = { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 };

      updateAccumulator(acc, { ...createChunk({}), usage });

      assert.deepEqual(acc.usage, usage);
    });
  });

  describe('accumulatorToToolCalls', () => {
    it('should convert empty accumulator', () => {
      const acc = createAccumulator();
      const toolCalls = accumulatorToToolCalls(acc);

      assert.deepEqual(toolCalls, []);
    });

    it('should convert tool calls to array format', () => {
      const acc = createAccumulator();
      acc.toolCalls.set(0, { id: 'call_1', name: 'func1', arguments: '{"a":1}' });
      acc.toolCalls.set(1, { id: 'call_2', name: 'func2', arguments: '{"b":2}' });

      const toolCalls = accumulatorToToolCalls(acc);

      assert.equal(toolCalls.length, 2);
      assert.deepEqual(toolCalls[0], {
        id: 'call_1',
        type: 'function',
        function: { name: 'func1', arguments: '{"a":1}' },
      });
      assert.deepEqual(toolCalls[1], {
        id: 'call_2',
        type: 'function',
        function: { name: 'func2', arguments: '{"b":2}' },
      });
    });
  });
});

// Helper to create minimal chunk
function createChunk(choice: Partial<ChatCompletionChunk['choices'][0]>): ChatCompletionChunk {
  return {
    id: 'test',
    object: 'chat.completion.chunk',
    created: Date.now(),
    model: 'gpt-4o',
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: null,
        ...choice,
      },
    ],
  };
}
