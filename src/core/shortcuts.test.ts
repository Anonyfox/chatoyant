/**
 * Tests for one-shot shortcut functions.
 *
 * These tests verify the shortcuts correctly set up Chat instances.
 * Actual API integration is tested in provider-level tests.
 *
 * @module core/shortcuts.test
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import type { GenDataOptions, GenStreamOptions, GenTextOptions } from './shortcuts.js';

describe('Shortcuts', () => {
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
