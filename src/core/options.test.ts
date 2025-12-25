/**
 * Tests for options utilities.
 *
 * @module core/options.test
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  type CommonOptions,
  DEFAULT_MAX_TOOL_ITERATIONS,
  DEFAULT_RETRIES,
  DEFAULT_TIMEOUT,
  DEFAULT_TOOL_TIMEOUT,
  type GenerateOptions,
  mergeOptions,
} from './options.js';

describe('Options', () => {
  describe('constants', () => {
    it('DEFAULT_TIMEOUT should be 120 seconds', () => {
      assert.equal(DEFAULT_TIMEOUT, 120_000);
    });

    it('DEFAULT_RETRIES should be 3', () => {
      assert.equal(DEFAULT_RETRIES, 3);
    });

    it('DEFAULT_MAX_TOOL_ITERATIONS should be 5', () => {
      assert.equal(DEFAULT_MAX_TOOL_ITERATIONS, 5);
    });

    it('DEFAULT_TOOL_TIMEOUT should be 10 seconds', () => {
      assert.equal(DEFAULT_TOOL_TIMEOUT, 10_000);
    });
  });

  describe('mergeOptions()', () => {
    it('should return empty object when both undefined', () => {
      const result = mergeOptions<CommonOptions>(undefined, undefined);
      assert.deepEqual(result, {});
    });

    it('should return defaults when overrides undefined', () => {
      const defaults: GenerateOptions = { timeout: 5000, temperature: 0.5 };
      const result = mergeOptions(defaults, undefined);
      assert.deepEqual(result, defaults);
    });

    it('should return overrides when defaults undefined', () => {
      const overrides: Partial<GenerateOptions> = { timeout: 3000 };
      const result = mergeOptions<GenerateOptions>(undefined, overrides);
      assert.deepEqual(result, overrides);
    });

    it('should merge defaults and overrides', () => {
      const defaults: GenerateOptions = { timeout: 5000, temperature: 0.5 };
      const overrides: Partial<GenerateOptions> = { temperature: 0.7 };
      const result = mergeOptions(defaults, overrides);
      assert.equal(result.timeout, 5000);
      assert.equal(result.temperature, 0.7);
    });

    it('should override default values completely', () => {
      const defaults: GenerateOptions = { timeout: 5000, maxTokens: 1000 };
      const overrides: Partial<GenerateOptions> = { timeout: 10000 };
      const result = mergeOptions(defaults, overrides);
      assert.equal(result.timeout, 10000);
      assert.equal(result.maxTokens, 1000);
    });

    it('should merge extra options when both have them', () => {
      const defaults: GenerateOptions = {
        timeout: 5000,
        extra: { a: 1, b: 2 },
      };
      const overrides: Partial<GenerateOptions> = {
        extra: { b: 3, c: 4 },
      };
      const result = mergeOptions(defaults, overrides);
      assert.deepEqual(result.extra, { a: 1, b: 3, c: 4 });
    });

    it('should preserve extra from defaults if overrides has none', () => {
      const defaults: GenerateOptions = {
        timeout: 5000,
        extra: { a: 1 },
      };
      const overrides: Partial<GenerateOptions> = { temperature: 0.5 };
      const result = mergeOptions(defaults, overrides);
      assert.deepEqual(result.extra, { a: 1 });
    });

    it('should preserve extra from overrides if defaults has none', () => {
      const defaults: GenerateOptions = { timeout: 5000 };
      const overrides: Partial<GenerateOptions> = { extra: { b: 2 } };
      const result = mergeOptions(defaults, overrides);
      assert.deepEqual(result.extra, { b: 2 });
    });

    it('should handle provider-specific options', () => {
      const defaults: GenerateOptions = { temperature: 0.5 };
      const overrides: Partial<GenerateOptions> = {
        reasoning: 'high',
        webSearch: true,
      };
      const result = mergeOptions(defaults, overrides);
      assert.equal(result.temperature, 0.5);
      assert.equal(result.reasoning, 'high');
      assert.equal(result.webSearch, true);
    });

    it('should not mutate original objects', () => {
      const defaults: GenerateOptions = { timeout: 5000 };
      const overrides: Partial<GenerateOptions> = { temperature: 0.7 };
      const defaultsCopy = { ...defaults };
      const overridesCopy = { ...overrides };

      mergeOptions(defaults, overrides);

      assert.deepEqual(defaults, defaultsCopy);
      assert.deepEqual(overrides, overridesCopy);
    });
  });

  describe('GenerateOptions type coverage', () => {
    it('should support all common options', () => {
      const opts: GenerateOptions = {
        provider: 'openai',
        timeout: 30000,
        retries: 2,
        temperature: 0.8,
        maxTokens: 2000,
        topP: 0.9,
        stop: ['END'],
        frequencyPenalty: 0.5,
        presencePenalty: 0.5,
      };
      assert.ok(opts);
    });

    it('should support provider-specific options', () => {
      const opts: GenerateOptions = {
        reasoning: 'medium',
        webSearch: true,
        cache: true,
        extra: { custom: 'value' },
      };
      assert.ok(opts);
    });

    it('should support stop as string or array', () => {
      const withString: GenerateOptions = { stop: 'END' };
      const withArray: GenerateOptions = { stop: ['END', 'STOP'] };
      assert.ok(withString);
      assert.ok(withArray);
    });
  });
});
