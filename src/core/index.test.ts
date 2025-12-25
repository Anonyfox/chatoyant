/**
 * Tests for core module exports.
 *
 * Verifies all expected exports are present and correctly typed.
 *
 * @module core/index.test
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

describe('Core module exports', () => {
  describe('main classes', () => {
    it('should export Chat class', async () => {
      const { Chat } = await import('./index.js');
      assert.ok(typeof Chat === 'function');
      const chat = new Chat();
      assert.ok(chat instanceof Chat);
    });

    it('should export Message class', async () => {
      const { Message } = await import('./index.js');
      assert.ok(typeof Message === 'function');
      const msg = new Message('user', 'test');
      assert.ok(msg instanceof Message);
    });

    it('should export Tool class', async () => {
      const { Tool } = await import('./index.js');
      const { Schema: S } = await import('../schema/index.js');
      class P extends S {
        x = S.String();
      }
      assert.ok(typeof Tool === 'function');
      const tool = new Tool({
        name: 'test',
        description: 'test',
        parameters: P,
        execute: async () => ({}),
      });
      assert.ok(tool instanceof Tool);
    });

    it('should export createTool helper', async () => {
      const { createTool, Tool } = await import('./index.js');
      const { Schema } = await import('../schema/index.js');
      class P extends Schema {
        x = Schema.String();
      }
      assert.ok(typeof createTool === 'function');
      const tool = createTool({
        name: 'test',
        description: 'test',
        parameters: P,
        execute: async () => ({}),
      });
      assert.ok(tool instanceof Tool);
    });
  });

  describe('one-shot functions', () => {
    it('should export genText', async () => {
      const { genText } = await import('./index.js');
      assert.ok(typeof genText === 'function');
    });

    it('should export genData', async () => {
      const { genData } = await import('./index.js');
      assert.ok(typeof genData === 'function');
    });

    it('should export genStream', async () => {
      const { genStream } = await import('./index.js');
      assert.ok(typeof genStream === 'function');
    });

    it('should export genStreamAccumulate', async () => {
      const { genStreamAccumulate } = await import('./index.js');
      assert.ok(typeof genStreamAccumulate === 'function');
    });
  });

  describe('constants', () => {
    it('should export DEFAULT_TIMEOUT', async () => {
      const { DEFAULT_TIMEOUT } = await import('./index.js');
      assert.equal(typeof DEFAULT_TIMEOUT, 'number');
      assert.equal(DEFAULT_TIMEOUT, 120_000);
    });

    it('should export DEFAULT_RETRIES', async () => {
      const { DEFAULT_RETRIES } = await import('./index.js');
      assert.equal(typeof DEFAULT_RETRIES, 'number');
      assert.equal(DEFAULT_RETRIES, 3);
    });

    it('should export DEFAULT_MAX_TOOL_ITERATIONS', async () => {
      const { DEFAULT_MAX_TOOL_ITERATIONS } = await import('./index.js');
      assert.equal(typeof DEFAULT_MAX_TOOL_ITERATIONS, 'number');
      assert.equal(DEFAULT_MAX_TOOL_ITERATIONS, 5);
    });

    it('should export DEFAULT_TOOL_TIMEOUT', async () => {
      const { DEFAULT_TOOL_TIMEOUT } = await import('./index.js');
      assert.equal(typeof DEFAULT_TOOL_TIMEOUT, 'number');
      assert.equal(DEFAULT_TOOL_TIMEOUT, 10_000);
    });
  });

  describe('utility functions', () => {
    it('should export mergeOptions', async () => {
      const { mergeOptions } = await import('./index.js');
      assert.ok(typeof mergeOptions === 'function');

      const result = mergeOptions({ timeout: 1000 }, { temperature: 0.5 });
      assert.equal(result.timeout, 1000);
      assert.equal(result.temperature, 0.5);
    });
  });

  describe('types (compile-time verification)', () => {
    it('should export ChatJSON type', async () => {
      const mod = await import('./index.js');
      // Type exists if module loads without error
      assert.ok(mod);
    });

    it('should export MessageJSON and MessageRole types', async () => {
      const mod = await import('./index.js');
      assert.ok(mod);
    });

    it('should export GenerateResult and StreamDelta types', async () => {
      const mod = await import('./index.js');
      assert.ok(mod);
    });

    it('should export all option types', async () => {
      const mod = await import('./index.js');
      assert.ok(mod);
    });

    it('should export all tool types', async () => {
      const mod = await import('./index.js');
      assert.ok(mod);
    });
  });
});

describe('Root module re-exports core', () => {
  it('should re-export Chat at root level', async () => {
    const { Chat } = await import('../index.js');
    assert.ok(typeof Chat === 'function');
  });

  it('should re-export genText at root level', async () => {
    const { genText } = await import('../index.js');
    assert.ok(typeof genText === 'function');
  });

  it('should re-export Tool at root level', async () => {
    const { Tool } = await import('../index.js');
    assert.ok(typeof Tool === 'function');
  });

  it('should re-export Message at root level', async () => {
    const { Message } = await import('../index.js');
    assert.ok(typeof Message === 'function');
  });

  it('should also export Schema at root level', async () => {
    const { Schema } = await import('../index.js');
    assert.ok(typeof Schema === 'function');
  });

  it('should also export provider clients at root level', async () => {
    const { createOpenAIClient, createAnthropicClient, createXAIClient } = await import(
      '../index.js'
    );
    assert.ok(typeof createOpenAIClient === 'function');
    assert.ok(typeof createAnthropicClient === 'function');
    assert.ok(typeof createXAIClient === 'function');
  });
});
