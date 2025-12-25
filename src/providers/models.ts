/**
 * Known models for each provider.
 *
 * This module provides comprehensive lists of model identifiers
 * for each supported provider. Use these for validation, documentation,
 * or to enumerate available models.
 *
 * @module providers/models
 */

import type { ProviderId } from './types.js';

/**
 * Known OpenAI models.
 *
 * Includes:
 * - GPT series (gpt-5, gpt-4.1, gpt-4o, etc.)
 * - O-series reasoning models (o1, o3)
 * - Specialized models (realtime, audio, image, codex)
 */
export const OPENAI_MODELS = [
  // GPT-5 series
  'gpt-5.2',
  'gpt-5.2-pro',
  'gpt-5.1',
  'gpt-5.1-codex',
  'gpt-5.1-codex-max',
  'gpt-5',
  'gpt-5-pro',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-5-codex',
  'gpt-5-chat-latest',
  // GPT-4.1 series
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  // GPT-4o series
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4o-mini-tts',
  'gpt-4o-transcribe',
  'gpt-4o-mini-transcribe',
  // GPT-4 series
  'gpt-4-turbo',
  'gpt-4-turbo-preview',
  'gpt-4',
  'gpt-4-32k',
  // GPT-3.5 series
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-16k',
  // O-series reasoning models
  'o1',
  'o1-preview',
  'o1-mini',
  'o3',
  'o3-mini',
  'o3-pro',
  'o3-deep-research',
  // Open-source models
  'gpt-oss-120b',
  'gpt-oss-20b',
  // Realtime/Audio models
  'gpt-realtime',
  'gpt-realtime-mini',
  'gpt-audio',
  'gpt-audio-mini',
  // Image models
  'gpt-image-1.5',
  'gpt-image-1',
  'gpt-image-1-mini',
  // ChatGPT-specific
  'chatgpt-4o-latest',
  'chatgpt-image-latest',
] as const;

/**
 * Known Anthropic Claude models.
 *
 * Includes:
 * - Claude 4 series (opus, sonnet, haiku)
 * - Claude 3.5 series
 * - Claude 3 series
 * - Legacy Claude 2 series
 */
export const ANTHROPIC_MODELS = [
  // Claude 4 series
  'claude-opus-4.5',
  'claude-sonnet-4.5',
  'claude-haiku-4.5',
  'claude-opus-4',
  'claude-sonnet-4',
  // Claude 3.5 series
  'claude-3-5-sonnet-latest',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-sonnet-20240620',
  'claude-3-5-haiku-latest',
  'claude-3-5-haiku-20241022',
  // Claude 3 series
  'claude-3-opus-latest',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
  // Legacy Claude 2
  'claude-2.1',
  'claude-2.0',
  'claude-instant-1.2',
] as const;

/**
 * Known xAI Grok models.
 *
 * Includes:
 * - Grok 4 series (reasoning, non-reasoning, fast variants)
 * - Grok 3 series
 * - Grok 2 series (including vision and image)
 * - Specialized models (code)
 */
export const XAI_MODELS = [
  // Grok 4 series
  'grok-4-1-fast-reasoning',
  'grok-4-1-fast-non-reasoning',
  'grok-4-fast-reasoning',
  'grok-4-fast-non-reasoning',
  'grok-4-0709',
  'grok-4',
  // Grok 3 series
  'grok-3',
  'grok-3-mini',
  // Grok 2 series
  'grok-2',
  'grok-2-vision-1212',
  'grok-2-image-1212',
  'grok-2-1212',
  // Specialized
  'grok-code-fast-1',
  // Legacy/aliases
  'grok-beta',
] as const;

/**
 * Type for OpenAI model identifiers.
 */
export type OpenAIModel = (typeof OPENAI_MODELS)[number];

/**
 * Type for Anthropic model identifiers.
 */
export type AnthropicModel = (typeof ANTHROPIC_MODELS)[number];

/**
 * Type for xAI model identifiers.
 */
export type XAIModel = (typeof XAI_MODELS)[number];

/**
 * Union type of all known model identifiers.
 */
export type KnownModel = OpenAIModel | AnthropicModel | XAIModel;

/**
 * Map of provider IDs to their known models.
 */
export const MODELS_BY_PROVIDER: Record<ProviderId, readonly string[]> = {
  openai: OPENAI_MODELS,
  anthropic: ANTHROPIC_MODELS,
  xai: XAI_MODELS,
} as const;

/**
 * Get all known models for a provider.
 *
 * @param providerId - The provider ID
 * @returns Array of known model identifiers
 *
 * @example
 * ```typescript
 * const openaiModels = getModelsForProvider('openai');
 * // ['gpt-5.2', 'gpt-5', 'o1-preview', ...]
 * ```
 */
export function getModelsForProvider(providerId: ProviderId): readonly string[] {
  return MODELS_BY_PROVIDER[providerId];
}

/**
 * Check if a model identifier is a known model.
 *
 * Note: This only checks against the known models list.
 * Providers may have additional models not in this list.
 *
 * @param model - Model identifier to check
 * @returns true if the model is in the known models list
 *
 * @example
 * ```typescript
 * isKnownModel('gpt-5.2');        // true
 * isKnownModel('claude-3-opus');  // true
 * isKnownModel('custom-model');   // false
 * ```
 */
export function isKnownModel(model: string): model is KnownModel {
  const lower = model.toLowerCase();
  return (
    OPENAI_MODELS.some((m) => m.toLowerCase() === lower) ||
    ANTHROPIC_MODELS.some((m) => m.toLowerCase() === lower) ||
    XAI_MODELS.some((m) => m.toLowerCase() === lower)
  );
}

/**
 * Get all known models across all providers.
 *
 * @returns Array of all known model identifiers
 */
export function getAllKnownModels(): readonly string[] {
  return [...OPENAI_MODELS, ...ANTHROPIC_MODELS, ...XAI_MODELS];
}
