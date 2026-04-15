/**
 * Tests for one-shot shortcut functions.
 *
 * These tests verify the shortcuts correctly set up Chat instances.
 * Actual API integration is tested in provider-level tests.
 *
 * @module core/shortcuts.test
 */

import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { Schema } from '../schema/index.js';
import type { GenDataOptions, GenStreamOptions, GenTextOptions } from './shortcuts.js';

describe('Shortcuts', () => {
  describe('Anthropic one-shot caching behavior', () => {
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

    function createMessageResponse(): Response {
      return new Response(
        JSON.stringify({
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello!' }],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
        { status: 200 },
      );
    }

    function createStructuredResponse(): Response {
      return new Response(
        JSON.stringify({
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'call_1', name: 'response', input: { name: 'Alice', age: 30 } },
          ],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'tool_use',
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
        { status: 200 },
      );
    }

    function createStreamResponse(): Response {
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

    it('genText should not enable Anthropic automatic caching', async () => {
      mockFetch.mock.mockImplementation(async () => createMessageResponse());

      const { genText } = await import('./shortcuts.js');
      await genText('Hello', { model: 'claude-sonnet-4-20250514' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.cache_control, undefined);
    });

    it('genData should not enable Anthropic automatic caching', async () => {
      mockFetch.mock.mockImplementation(async () => createStructuredResponse());

      class Person extends Schema {
        name = Schema.String();
        age = Schema.Integer();
      }

      const { genData } = await import('./shortcuts.js');
      await genData('Extract Alice', Person, { model: 'claude-sonnet-4-20250514' });

      const [, options] = mockFetch.mock.calls[0].arguments;
      const body = JSON.parse(options?.body as string);
      assert.equal(body.cache_control, undefined);
    });

    it('genStream and genStreamAccumulate should not enable Anthropic automatic caching', async () => {
      mockFetch.mock.mockImplementation(async () => createStreamResponse());

      const { genStream, genStreamAccumulate } = await import('./shortcuts.js');
      for await (const _chunk of genStream('Hello', { model: 'claude-sonnet-4-20250514' })) {
        // drain
      }

      let [, options] = mockFetch.mock.calls[0].arguments;
      let body = JSON.parse(options?.body as string);
      assert.equal(body.cache_control, undefined);

      mockFetch.mock.mockImplementation(async () => createStreamResponse());
      await genStreamAccumulate('Hello', { model: 'claude-sonnet-4-20250514' });

      [, options] = mockFetch.mock.calls[1].arguments;
      body = JSON.parse(options?.body as string);
      assert.equal(body.cache_control, undefined);
    });
  });

  describe('GenTextOptions type', () => {
    it('should accept system prompt', () => {
      const opts: GenTextOptions = {
        system: 'You are helpful',
      };
      assert.equal(opts.system, 'You are helpful');
    });

    it('should accept model', () => {
      const opts: GenTextOptions = {
        model: 'claude-sonnet-4-20250514',
      };
      assert.equal(opts.model, 'claude-sonnet-4-20250514');
    });

    it('should accept generation options', () => {
      const opts: GenTextOptions = {
        temperature: 0.7,
        maxTokens: 1000,
        topP: 0.9,
      };
      assert.equal(opts.temperature, 0.7);
      assert.equal(opts.maxTokens, 1000);
    });

    it('should accept provider-specific options', () => {
      const opts: GenTextOptions = {
        reasoning: 'high',
        webSearch: true,
      };
      assert.equal(opts.reasoning, 'high');
      assert.ok(opts.webSearch);
    });
  });

  describe('GenDataOptions type', () => {
    it('should accept same options as GenTextOptions', () => {
      const opts: GenDataOptions = {
        system: 'Extract data',
        model: 'gpt-4o',
        temperature: 0.3,
      };
      assert.equal(opts.system, 'Extract data');
    });
  });

  describe('GenStreamOptions type', () => {
    it('should accept stream callbacks', () => {
      const deltas: string[] = [];
      const opts: GenStreamOptions = {
        onDelta: (delta) => deltas.push(delta),
        onComplete: (full) => console.log(full),
        onError: (err) => console.error(err),
      };
      assert.ok(typeof opts.onDelta === 'function');
      assert.ok(typeof opts.onComplete === 'function');
      assert.ok(typeof opts.onError === 'function');
    });

    it('should accept all generation options', () => {
      const opts: GenStreamOptions = {
        system: 'Stream content',
        model: 'gpt-4o',
        temperature: 0.8,
        maxTokens: 2000,
      };
      assert.ok(opts);
    });
  });

  describe('type safety', () => {
    it('should enforce valid provider IDs', () => {
      // TypeScript enforces this at compile time
      const opts: GenTextOptions = {
        provider: 'openai',
      };
      assert.equal(opts.provider, 'openai');
    });

    it('should enforce valid reasoning values', () => {
      // TypeScript enforces this at compile time
      const opts: GenTextOptions = {
        reasoning: 'medium',
      };
      assert.equal(opts.reasoning, 'medium');
    });
  });

  // Note: Actual function behavior tests would require mocking the providers
  // or running against live APIs. Those tests belong in integration tests.
  describe('function signatures', () => {
    it('genText should accept prompt and optional options', async () => {
      // We're just testing that the imports and types work
      // Actual execution would require API keys
      const { genText } = await import('./shortcuts.js');
      assert.ok(typeof genText === 'function');
    });

    it('genData should accept prompt, schema, and optional options', async () => {
      const { genData } = await import('./shortcuts.js');
      assert.ok(typeof genData === 'function');
    });

    it('genStream should return async generator', async () => {
      const { genStream } = await import('./shortcuts.js');
      assert.ok(typeof genStream === 'function');
    });

    it('genStreamAccumulate should return promise', async () => {
      const { genStreamAccumulate } = await import('./shortcuts.js');
      assert.ok(typeof genStreamAccumulate === 'function');
    });
  });
});
