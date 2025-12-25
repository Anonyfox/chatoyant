/**
 * Tests for Tool class.
 *
 * @module core/tool.test
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Schema } from '../schema/index.js';
import { createTool, Tool, type ToolContext } from './tool.js';

// Test schema for tool parameters
class TestParams extends Schema {
  query = Schema.String({ description: 'Search query' });
  limit = Schema.Integer({ minimum: 1, maximum: 100, optional: true });
}

// Test schema for tool results
class TestResult extends Schema {
  items = Schema.Array(Schema.String());
  total = Schema.Integer();
}

describe('Tool', () => {
  describe('constructor', () => {
    it('should create tool with required fields', () => {
      const tool = new Tool({
        name: 'search',
        description: 'Search for items',
        parameters: TestParams,
        execute: async () => ({ items: [], total: 0 }),
      });

      assert.equal(tool.name, 'search');
      assert.equal(tool.description, 'Search for items');
      assert.equal(tool.timeout, 10_000); // default
    });

    it('should accept custom timeout', () => {
      const tool = new Tool({
        name: 'slow_task',
        description: 'A slow task',
        parameters: TestParams,
        execute: async () => ({}),
        timeout: 30_000,
      });

      assert.equal(tool.timeout, 30_000);
    });

    it('should accept result schema', () => {
      const tool = new Tool({
        name: 'search',
        description: 'Search',
        parameters: TestParams,
        resultSchema: TestResult,
        execute: async () => ({ items: [], total: 0 }),
      });

      assert.ok(tool.resultSchema);
    });

    it('should accept schema instance instead of constructor', () => {
      const paramsInstance = Schema.create(TestParams);
      const tool = new Tool({
        name: 'search',
        description: 'Search',
        parameters: paramsInstance,
        execute: async () => ({}),
      });

      assert.ok(tool.parameters);
    });

    it('should throw on missing name', () => {
      assert.throws(() => {
        new Tool({
          name: '',
          description: 'Test',
          parameters: TestParams,
          execute: async () => ({}),
        });
      }, /name is required/);
    });

    it('should throw on missing description', () => {
      assert.throws(() => {
        new Tool({
          name: 'test',
          description: '',
          parameters: TestParams,
          execute: async () => ({}),
        });
      }, /description is required/);
    });

    it('should throw on missing parameters', () => {
      assert.throws(() => {
        new Tool({
          name: 'test',
          description: 'Test',
          parameters: undefined as any,
          execute: async () => ({}),
        });
      }, /parameters schema is required/);
    });

    it('should throw on missing execute function', () => {
      assert.throws(() => {
        new Tool({
          name: 'test',
          description: 'Test',
          parameters: TestParams,
          execute: undefined as any,
        });
      }, /execute function is required/);
    });
  });

  describe('createTool()', () => {
    it('should be an alias for new Tool()', () => {
      const tool = createTool({
        name: 'test',
        description: 'Test tool',
        parameters: TestParams,
        execute: async () => ({}),
      });

      assert.ok(tool instanceof Tool);
    });
  });

  describe('getParametersSchema()', () => {
    it('should return JSON Schema for parameters', () => {
      const tool = new Tool({
        name: 'search',
        description: 'Search',
        parameters: TestParams,
        execute: async () => ({}),
      });

      const schema = tool.getParametersSchema();
      assert.equal(schema.type, 'object');
      assert.ok(schema.properties);
      assert.ok('query' in (schema.properties as object));
    });
  });

  describe('validateArgs()', () => {
    const tool = new Tool({
      name: 'search',
      description: 'Search',
      parameters: TestParams,
      execute: async () => ({}),
    });

    it('should return true for valid args', () => {
      const valid = tool.validateArgs({ query: 'hello' });
      assert.ok(valid);
    });

    it('should return true for valid args with optional fields', () => {
      const valid = tool.validateArgs({ query: 'hello', limit: 10 });
      assert.ok(valid);
    });

    it('should return false for invalid args', () => {
      const valid = tool.validateArgs({ query: 123 });
      assert.ok(!valid);
    });

    it('should return false for missing required args', () => {
      const valid = tool.validateArgs({});
      assert.ok(!valid);
    });

    it('should return false for out-of-range values', () => {
      const valid = tool.validateArgs({ query: 'test', limit: 1000 });
      assert.ok(!valid);
    });
  });

  describe('parseArgs()', () => {
    const tool = new Tool({
      name: 'search',
      description: 'Search',
      parameters: TestParams,
      execute: async () => ({}),
    });

    it('should parse valid args', () => {
      const args = tool.parseArgs({ query: 'hello', limit: 5 });
      assert.equal(args.query, 'hello');
      assert.equal(args.limit, 5);
    });

    it('should throw on invalid args', () => {
      assert.throws(() => {
        tool.parseArgs({ query: 123 });
      });
    });
  });

  describe('validateResult()', () => {
    it('should return true if no result schema', () => {
      const tool = new Tool({
        name: 'test',
        description: 'Test',
        parameters: TestParams,
        execute: async () => ({}),
      });

      assert.ok(tool.validateResult({ anything: 'goes' }));
    });

    it('should validate against result schema if present', () => {
      const tool = new Tool({
        name: 'search',
        description: 'Search',
        parameters: TestParams,
        resultSchema: TestResult,
        execute: async () => ({ items: [], total: 0 }),
      });

      assert.ok(tool.validateResult({ items: ['a', 'b'], total: 2 }));
      assert.ok(!tool.validateResult({ items: 'not array' }));
    });
  });

  describe('execute()', () => {
    it('should execute function with args and context', async () => {
      let receivedArgs: unknown;
      let receivedCtx: unknown;

      const tool = new Tool({
        name: 'test',
        description: 'Test',
        parameters: TestParams,
        execute: async ({ args, ctx }) => {
          receivedArgs = args;
          receivedCtx = ctx;
          return { success: true };
        },
      });

      const ctx: ToolContext = { model: 'gpt-4o', provider: 'openai' };
      const result = await tool.execute({ args: { query: 'test' }, ctx });

      assert.deepEqual(receivedArgs, { query: 'test' });
      assert.deepEqual(receivedCtx, ctx);
      assert.deepEqual(result, { success: true });
    });
  });

  describe('executeWithTimeout()', () => {
    it('should execute successfully within timeout', async () => {
      const tool = new Tool({
        name: 'fast',
        description: 'Fast tool',
        parameters: TestParams,
        execute: async () => ({ done: true }),
        timeout: 1000,
      });

      const ctx: ToolContext = { model: 'gpt-4o', provider: 'openai' };
      const result = await tool.executeWithTimeout({ args: { query: 'test' }, ctx });
      assert.deepEqual(result, { done: true });
    });

    it('should timeout slow executions', async () => {
      const tool = new Tool({
        name: 'slow',
        description: 'Slow tool',
        parameters: TestParams,
        execute: async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return { done: true };
        },
        timeout: 100, // 100ms timeout
      });

      const ctx: ToolContext = { model: 'gpt-4o', provider: 'openai' };
      await assert.rejects(tool.executeWithTimeout({ args: { query: 'test' }, ctx }), /timed out/i);
    });
  });

  describe('executeCall()', () => {
    const tool = new Tool({
      name: 'search',
      description: 'Search',
      parameters: TestParams,
      execute: async ({ args }) => ({
        items: [`result for: ${args.query}`],
        total: 1,
      }),
    });

    const ctx: ToolContext = { model: 'gpt-4o', provider: 'openai' };

    it('should execute valid call successfully', async () => {
      const result = await tool.executeCall(
        { id: 'call_1', name: 'search', args: { query: 'test' } },
        ctx,
      );

      assert.ok(result.success);
      assert.equal(result.id, 'call_1');
      assert.deepEqual(result.result, { items: ['result for: test'], total: 1 });
      assert.ok(!result.error);
    });

    it('should return error for invalid args', async () => {
      const result = await tool.executeCall(
        { id: 'call_2', name: 'search', args: { query: 123 } },
        ctx,
      );

      assert.ok(!result.success);
      assert.equal(result.id, 'call_2');
      assert.ok(result.error?.includes('Invalid arguments'));
    });

    it('should return error for execution failure', async () => {
      const failingTool = new Tool({
        name: 'fails',
        description: 'Fails',
        parameters: TestParams,
        execute: async () => {
          throw new Error('Execution failed');
        },
      });

      const result = await failingTool.executeCall(
        { id: 'call_3', name: 'fails', args: { query: 'test' } },
        ctx,
      );

      assert.ok(!result.success);
      assert.ok(result.error?.includes('Execution failed'));
    });

    it('should return error for invalid result', async () => {
      const badResultTool = new Tool({
        name: 'bad_result',
        description: 'Bad result',
        parameters: TestParams,
        resultSchema: TestResult,
        execute: async () => ({ bad: 'result' }) as any,
      });

      const result = await badResultTool.executeCall(
        { id: 'call_4', name: 'bad_result', args: { query: 'test' } },
        ctx,
      );

      assert.ok(!result.success);
      assert.ok(result.error?.includes('Invalid result'));
    });
  });
});
