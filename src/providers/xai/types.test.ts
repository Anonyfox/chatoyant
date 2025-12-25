/**
 * Tests for xAI type definitions.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  ChatCompletion,
  ChatRequest,
  ContentPart,
  EmbeddingResponse,
  FinishReason,
  ImageGenerationRequest,
  LanguageModel,
  Message,
  ReasoningEffort,
  ResponseFormat,
  Role,
  Tool,
  ToolChoice,
  Usage,
  WebSearchTool,
} from './types.js';

describe('xAI types', () => {
  describe('Role', () => {
    it('should allow valid roles', () => {
      const roles: Role[] = ['system', 'user', 'assistant', 'tool'];
      assert.equal(roles.length, 4);
    });
  });

  describe('Message', () => {
    it('should allow string content', () => {
      const msg: Message = { role: 'user', content: 'Hello' };
      assert.equal(msg.content, 'Hello');
    });

    it('should allow array content for multimodal', () => {
      const parts: ContentPart[] = [
        { type: 'text', text: 'What is this?' },
        { type: 'image_url', image_url: { url: 'https://example.com/img.jpg', detail: 'high' } },
      ];
      const msg: Message = { role: 'user', content: parts };
      assert.ok(Array.isArray(msg.content));
    });

    it('should allow null content for tool calls', () => {
      const msg: Message = {
        role: 'assistant',
        content: null,
        tool_calls: [
          { id: 'call_1', type: 'function', function: { name: 'test', arguments: '{}' } },
        ],
      };
      assert.equal(msg.content, null);
    });

    it('should allow tool_call_id for tool role', () => {
      const msg: Message = { role: 'tool', content: 'Result', tool_call_id: 'call_1' };
      assert.equal(msg.tool_call_id, 'call_1');
    });
  });

  describe('Tool', () => {
    it('should define function tool', () => {
      const tool: Tool = {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get weather',
          parameters: { type: 'object' },
        },
      };
      assert.equal(tool.function?.name, 'get_weather');
    });

    it('should define web_search tool (xAI-specific)', () => {
      const tool: WebSearchTool = { type: 'web_search' };
      assert.equal(tool.type, 'web_search');
    });
  });

  describe('ToolChoice', () => {
    it('should allow string choices', () => {
      const choices: ToolChoice[] = ['none', 'auto', 'required'];
      assert.equal(choices.length, 3);
    });

    it('should allow specific function', () => {
      const choice: ToolChoice = { type: 'function', function: { name: 'specific' } };
      assert.equal(choice.type, 'function');
    });
  });

  describe('ResponseFormat', () => {
    it('should allow text format', () => {
      const format: ResponseFormat = { type: 'text' };
      assert.equal(format.type, 'text');
    });

    it('should allow json_object format', () => {
      const format: ResponseFormat = { type: 'json_object' };
      assert.equal(format.type, 'json_object');
    });

    it('should allow json_schema format', () => {
      const format: ResponseFormat = {
        type: 'json_schema',
        json_schema: { name: 'test', schema: { type: 'object' } },
      };
      assert.equal(format.type, 'json_schema');
    });
  });

  describe('ReasoningEffort (xAI-specific)', () => {
    it('should allow valid effort levels', () => {
      const efforts: ReasoningEffort[] = ['low', 'medium', 'high'];
      assert.equal(efforts.length, 3);
    });
  });

  describe('ChatRequest', () => {
    it('should have required fields', () => {
      const req: ChatRequest = {
        model: 'grok-3',
        messages: [{ role: 'user', content: 'Hello' }],
      };
      assert.equal(req.model, 'grok-3');
    });

    it('should allow xAI-specific reasoning_effort', () => {
      const req: ChatRequest = {
        model: 'grok-4-1-fast-reasoning',
        messages: [],
        reasoning_effort: 'high',
      };
      assert.equal(req.reasoning_effort, 'high');
    });
  });

  describe('Usage', () => {
    it('should track token counts', () => {
      const usage: Usage = {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      };
      assert.equal(usage.total_tokens, 30);
    });

    it('should allow detailed token counts', () => {
      const usage: Usage = {
        prompt_tokens: 100,
        completion_tokens: 200,
        total_tokens: 300,
        prompt_tokens_details: { cached_tokens: 50 },
        completion_tokens_details: { reasoning_tokens: 100 },
      };
      assert.equal(usage.prompt_tokens_details?.cached_tokens, 50);
      assert.equal(usage.completion_tokens_details?.reasoning_tokens, 100);
    });
  });

  describe('FinishReason', () => {
    it('should allow valid finish reasons', () => {
      const reasons: FinishReason[] = ['stop', 'length', 'tool_calls', 'content_filter'];
      assert.equal(reasons.length, 4);
    });
  });

  describe('ChatCompletion', () => {
    it('should structure complete response', () => {
      const response: ChatCompletion = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'grok-3',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };
      assert.equal(response.object, 'chat.completion');
    });
  });

  describe('LanguageModel (xAI-specific)', () => {
    it('should include extended model info', () => {
      const model: LanguageModel = {
        id: 'grok-3',
        fingerprint: 'abc123',
        aliases: ['grok-3-latest'],
        context_length: 131072,
        input_modalities: ['text'],
        output_modalities: ['text'],
        pricing: { input: 3.0, output: 15.0 },
      };
      assert.equal(model.context_length, 131072);
      assert.ok(model.pricing.input > 0);
    });
  });

  describe('ImageGenerationRequest', () => {
    it('should require prompt', () => {
      const req: ImageGenerationRequest = { prompt: 'A sunset' };
      assert.equal(req.prompt, 'A sunset');
    });

    it('should allow optional parameters', () => {
      const req: ImageGenerationRequest = {
        prompt: 'A sunset',
        model: 'grok-2-image-1212',
        size: '1024x1024',
        quality: 'hd',
        style: 'vivid',
        n: 2,
      };
      assert.equal(req.quality, 'hd');
    });
  });

  describe('EmbeddingResponse', () => {
    it('should structure embedding response', () => {
      const response: EmbeddingResponse = {
        object: 'list',
        data: [{ object: 'embedding', index: 0, embedding: [0.1, 0.2, 0.3] }],
        model: 'grok-embedding-1',
        usage: { prompt_tokens: 5, total_tokens: 5 },
      };
      assert.equal(response.object, 'list');
      assert.equal(response.data[0].embedding.length, 3);
    });
  });
});
