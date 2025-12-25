/**
 * Tests for xAI SSE stream parsing.
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
    it('should parse OpenAI-compatible SSE format', async () => {
      const chunks: ChatCompletionChunk[] = [];
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"grok-3","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n',
            ),
          );
          controller.enqueue(
            encoder.encode(
              'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"grok-3","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
            ),
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      const response = new Response(stream);

      for await (const chunk of parseSSEStream(response)) {
        chunks.push(chunk);
      }

      assert.equal(chunks.length, 2);
      assert.equal(chunks[0].choices[0].delta.role, 'assistant');
      assert.equal(chunks[1].choices[0].delta.content, 'Hello');
    });

    it('should handle [DONE] correctly', async () => {
      const chunks: ChatCompletionChunk[] = [];
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"id":"123","object":"chat.completion.chunk","created":1234567890,"model":"grok-3","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}\n\n',
            ),
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      const response = new Response(stream);

      for await (const chunk of parseSSEStream(response)) {
        chunks.push(chunk);
      }

      assert.equal(chunks.length, 1);
    });

    it('should skip comment lines', async () => {
      const chunks: ChatCompletionChunk[] = [];
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(': this is a comment\n'));
          controller.enqueue(
            encoder.encode(
              'data: {"id":"123","object":"chat.completion.chunk","created":1234567890,"model":"grok-3","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}\n\n',
            ),
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      const response = new Response(stream);

      for await (const chunk of parseSSEStream(response)) {
        chunks.push(chunk);
      }

      assert.equal(chunks.length, 1);
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
      assert.equal(acc.toolCalls.size, 0);
      assert.equal(acc.finishReason, null);
      assert.equal(acc.usage, null);
    });
  });

  describe('updateAccumulator', () => {
    it('should accumulate content deltas', () => {
      const acc = createAccumulator();

      updateAccumulator(acc, createChunk({ content: 'Hello' }));
      assert.equal(acc.content, 'Hello');

      updateAccumulator(acc, createChunk({ content: ' World' }));
      assert.equal(acc.content, 'Hello World');
    });

    it('should capture id and model', () => {
      const acc = createAccumulator();

      updateAccumulator(acc, {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'grok-3',
        choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
      });

      assert.equal(acc.id, 'chatcmpl-123');
      assert.equal(acc.model, 'grok-3');
    });

    it('should capture finish reason', () => {
      const acc = createAccumulator();

      updateAccumulator(acc, {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'grok-3',
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      });

      assert.equal(acc.finishReason, 'stop');
    });

    it('should capture usage in final chunk', () => {
      const acc = createAccumulator();

      updateAccumulator(acc, {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'grok-3',
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });

      assert.deepEqual(acc.usage, { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 });
    });

    it('should accumulate tool calls', () => {
      const acc = createAccumulator();

      updateAccumulator(acc, {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'grok-3',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                { index: 0, id: 'call_123', type: 'function', function: { name: 'get_weather' } },
              ],
            },
            finish_reason: null,
          },
        ],
      });

      updateAccumulator(acc, {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'grok-3',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [{ index: 0, function: { arguments: '{"loc' } }],
            },
            finish_reason: null,
          },
        ],
      });

      updateAccumulator(acc, {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'grok-3',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [{ index: 0, function: { arguments: 'ation":"NYC"}' } }],
            },
            finish_reason: null,
          },
        ],
      });

      const toolCalls = accumulatorToToolCalls(acc);
      assert.equal(toolCalls.length, 1);
      assert.equal(toolCalls[0].id, 'call_123');
      assert.equal(toolCalls[0].function.name, 'get_weather');
      assert.equal(toolCalls[0].function.arguments, '{"location":"NYC"}');
    });
  });

  describe('accumulatorToToolCalls', () => {
    it('should convert empty accumulator', () => {
      const acc = createAccumulator();
      const toolCalls = accumulatorToToolCalls(acc);

      assert.deepEqual(toolCalls, []);
    });

    it('should convert tool calls', () => {
      const acc = createAccumulator();
      acc.toolCalls.set(0, {
        id: 'call_1',
        type: 'function',
        function: { name: 'func1', arguments: '{"a":1}' },
      });
      acc.toolCalls.set(1, {
        id: 'call_2',
        type: 'function',
        function: { name: 'func2', arguments: '{"b":2}' },
      });

      const toolCalls = accumulatorToToolCalls(acc);

      assert.equal(toolCalls.length, 2);
      assert.equal(toolCalls[0].function.name, 'func1');
      assert.equal(toolCalls[1].function.name, 'func2');
    });
  });
});

function createChunk(delta: { content?: string; role?: 'assistant' }): ChatCompletionChunk {
  return {
    id: 'chatcmpl-123',
    object: 'chat.completion.chunk',
    created: 1234567890,
    model: 'grok-3',
    choices: [{ index: 0, delta, finish_reason: null }],
  };
}
