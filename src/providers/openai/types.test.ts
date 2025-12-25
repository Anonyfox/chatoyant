/**
 * Tests for OpenAI type definitions.
 *
 * These tests verify the types are correctly exported and structured.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  AssistantMessage,
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionRequest,
  Choice,
  ContentPart,
  Embedding,
  EmbeddingResponse,
  FinishReason,
  FunctionDefinition,
  ImageData,
  ImageGenerationResponse,
  Message,
  Model,
  ResponseFormat,
  Role,
  Tool,
  ToolCall,
  ToolChoice,
  Usage,
} from './types.js';

describe('OpenAI types', () => {
  describe('Role', () => {
    it('should allow valid roles', () => {
      const roles: Role[] = ['system', 'user', 'assistant', 'tool'];
      assert.equal(roles.length, 4);
    });
  });

  describe('FinishReason', () => {
    it('should allow valid finish reasons', () => {
      const reasons: FinishReason[] = ['stop', 'length', 'tool_calls', 'content_filter'];
      assert.equal(reasons.length, 4);
    });
  });

  describe('Message', () => {
    it('should allow string content', () => {
      const msg: Message = { role: 'user', content: 'Hello' };
      assert.equal(msg.content, 'Hello');
    });

    it('should allow array content', () => {
      const parts: ContentPart[] = [
        { type: 'text', text: 'Hello' },
        { type: 'image_url', image_url: { url: 'https://example.com/img.png' } },
      ];
      const msg: Message = { role: 'user', content: parts };
      assert.ok(Array.isArray(msg.content));
    });

    it('should allow null content for assistant', () => {
      const msg: AssistantMessage = { role: 'assistant', content: null };
      assert.equal(msg.content, null);
    });
  });

  describe('Tool', () => {
    it('should define function tool', () => {
      const tool: Tool = {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
          },
        },
      };
      assert.equal(tool.function.name, 'get_weather');
    });
  });

  describe('ToolCall', () => {
    it('should structure tool call', () => {
      const call: ToolCall = {
        id: 'call_123',
        type: 'function',
        function: {
          name: 'get_weather',
          arguments: '{"location":"NYC"}',
        },
      };
      assert.equal(call.function.name, 'get_weather');
    });
  });

  describe('ToolChoice', () => {
    it('should allow string values', () => {
      const choices: ToolChoice[] = ['none', 'auto', 'required'];
      assert.equal(choices.length, 3);
    });

    it('should allow specific function', () => {
      const choice: ToolChoice = {
        type: 'function',
        function: { name: 'specific_func' },
      };
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
        json_schema: {
          name: 'person',
          schema: { type: 'object' },
        },
      };
      assert.equal(format.type, 'json_schema');
    });
  });

  describe('ChatCompletionRequest', () => {
    it('should have required fields', () => {
      const req: ChatCompletionRequest = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
      };
      assert.equal(req.model, 'gpt-4o');
      assert.equal(req.messages.length, 1);
    });

    it('should allow optional fields', () => {
      const req: ChatCompletionRequest = {
        model: 'gpt-4o',
        messages: [],
        temperature: 0.7,
        max_tokens: 1000,
        stream: true,
        tools: [],
        response_format: { type: 'json_object' },
      };
      assert.equal(req.temperature, 0.7);
    });
  });

  describe('Usage', () => {
    it('should track token counts', () => {
      const usage: Usage = {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      };
      assert.equal(usage.total_tokens, usage.prompt_tokens + usage.completion_tokens);
    });

    it('should allow detailed token breakdowns', () => {
      const usage: Usage = {
        prompt_tokens: 100,
        completion_tokens: 200,
        total_tokens: 300,
        prompt_tokens_details: {
          cached_tokens: 50,
        },
        completion_tokens_details: {
          reasoning_tokens: 100,
        },
      };
      assert.equal(usage.completion_tokens_details?.reasoning_tokens, 100);
    });
  });

  describe('Choice', () => {
    it('should include message and finish reason', () => {
      const choice: Choice = {
        index: 0,
        message: { role: 'assistant', content: 'Hello!' },
        finish_reason: 'stop',
      };
      assert.equal(choice.finish_reason, 'stop');
    });
  });

  describe('ChatCompletion', () => {
    it('should structure complete response', () => {
      const completion: ChatCompletion = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };
      assert.equal(completion.object, 'chat.completion');
    });
  });

  describe('ChatCompletionChunk', () => {
    it('should structure streaming chunk', () => {
      const chunk: ChatCompletionChunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            delta: { content: 'Hello' },
            finish_reason: null,
          },
        ],
      };
      assert.equal(chunk.object, 'chat.completion.chunk');
    });
  });

  describe('Embedding', () => {
    it('should structure embedding result', () => {
      const embedding: Embedding = {
        object: 'embedding',
        index: 0,
        embedding: [0.1, 0.2, 0.3],
      };
      assert.equal(embedding.embedding.length, 3);
    });
  });

  describe('EmbeddingResponse', () => {
    it('should structure embedding response', () => {
      const response: EmbeddingResponse = {
        object: 'list',
        data: [{ object: 'embedding', index: 0, embedding: [0.1] }],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 5, total_tokens: 5 },
      };
      assert.equal(response.object, 'list');
    });
  });

  describe('ImageData', () => {
    it('should allow url format', () => {
      const data: ImageData = { url: 'https://example.com/image.png' };
      assert.ok(data.url);
    });

    it('should allow base64 format', () => {
      const data: ImageData = { b64_json: 'base64data...' };
      assert.ok(data.b64_json);
    });

    it('should include revised prompt', () => {
      const data: ImageData = {
        url: 'https://example.com/image.png',
        revised_prompt: 'A better description',
      };
      assert.ok(data.revised_prompt);
    });
  });

  describe('ImageGenerationResponse', () => {
    it('should structure image response', () => {
      const response: ImageGenerationResponse = {
        created: 1234567890,
        data: [{ url: 'https://example.com/image.png' }],
      };
      assert.equal(response.data.length, 1);
    });
  });

  describe('Model', () => {
    it('should structure model info', () => {
      const model: Model = {
        id: 'gpt-4o',
        object: 'model',
        created: 1234567890,
        owned_by: 'openai',
      };
      assert.equal(model.object, 'model');
    });
  });

  describe('FunctionDefinition', () => {
    it('should define function with schema', () => {
      const func: FunctionDefinition = {
        name: 'calculate',
        description: 'Performs calculation',
        parameters: {
          type: 'object',
          properties: {
            expression: { type: 'string' },
          },
          required: ['expression'],
        },
        strict: true,
      };
      assert.equal(func.strict, true);
    });
  });
});
