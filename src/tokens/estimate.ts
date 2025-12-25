/**
 * Heuristic token estimation.
 *
 * These functions provide fast approximations without requiring
 * actual tokenizer libraries. Accuracy is typically within 10-15%
 * for English text, less accurate for code or non-Latin scripts.
 *
 * @module tokens/estimate
 */

/**
 * Characters per token ratio by content type.
 * Based on empirical analysis of GPT tokenizers.
 */
const CHARS_PER_TOKEN = {
  /** Average English text */
  english: 4.0,
  /** Code (more tokens due to operators, keywords) */
  code: 3.5,
  /** CJK characters (Chinese, Japanese, Korean) */
  cjk: 1.5,
  /** Mixed content default */
  mixed: 3.8,
} as const;

/**
 * Detect if text contains significant CJK characters.
 */
function hasCJK(text: string): boolean {
  // CJK Unified Ideographs and common ranges
  const cjkPattern = /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/;
  return cjkPattern.test(text);
}

/**
 * Detect if text is primarily code.
 */
function isCode(text: string): boolean {
  // Heuristics for code detection
  const codeIndicators = [
    /[{}[\]();]/, // Brackets and semicolons
    /^\s*(function|const|let|var|class|import|export|def|fn|pub)\s/m, // Keywords
    /[=!<>]{2,}/, // Operators
    /\s{2,}[a-zA-Z_]\w*\s*[=(]/, // Indented identifiers
  ];
  const matches = codeIndicators.filter((p) => p.test(text)).length;
  return matches >= 2;
}

/**
 * Estimate token count for a string.
 *
 * Uses character-based heuristics with content-type detection.
 * Accuracy is typically within 10-15% for English text.
 *
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 *
 * @example
 * ```typescript
 * import { estimateTokens } from 'chatoyant/tokens';
 *
 * const tokens = estimateTokens("Hello, world!");
 * // ~3-4 tokens
 * ```
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // Determine content type and ratio
  let charsPerToken: number;

  if (hasCJK(text)) {
    // CJK-heavy content uses different tokenization
    const cjkMatches = text.match(
      /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g,
    );
    const cjkRatio = (cjkMatches?.length ?? 0) / text.length;

    // Blend between CJK and mixed ratios based on content
    charsPerToken = CHARS_PER_TOKEN.cjk * cjkRatio + CHARS_PER_TOKEN.mixed * (1 - cjkRatio);
  } else if (isCode(text)) {
    charsPerToken = CHARS_PER_TOKEN.code;
  } else {
    charsPerToken = CHARS_PER_TOKEN.english;
  }

  return Math.ceil(text.length / charsPerToken);
}

/**
 * Estimate tokens for a simple prompt-response pair.
 *
 * @param prompt - User prompt
 * @param response - Model response (optional)
 * @returns Object with input, output, and total token estimates
 *
 * @example
 * ```typescript
 * const estimate = estimatePromptTokens(
 *   "What is 2+2?",
 *   "2+2 equals 4."
 * );
 * // { input: 5, output: 6, total: 11 }
 * ```
 */
export function estimatePromptTokens(
  prompt: string,
  response?: string,
): { input: number; output: number; total: number } {
  const input = estimateTokens(prompt);
  const output = response ? estimateTokens(response) : 0;
  return { input, output, total: input + output };
}

/**
 * Estimate tokens for an array of text strings.
 *
 * @param texts - Array of text strings
 * @returns Total estimated token count
 */
export function estimateTokensMany(texts: string[]): number {
  return texts.reduce((sum, text) => sum + estimateTokens(text), 0);
}

/**
 * Estimate tokens with a specific character ratio.
 *
 * Use this when you know your content type and want
 * a more accurate estimate.
 *
 * @param text - Text to estimate
 * @param charsPerToken - Characters per token ratio
 * @returns Estimated token count
 *
 * @example
 * ```typescript
 * // For dense code
 * const tokens = estimateTokensWithRatio(code, 3.0);
 *
 * // For simple English
 * const tokens = estimateTokensWithRatio(prose, 4.5);
 * ```
 */
export function estimateTokensWithRatio(text: string, charsPerToken: number): number {
  if (!text || charsPerToken <= 0) return 0;
  return Math.ceil(text.length / charsPerToken);
}

/**
 * Common character-per-token ratios for reference.
 */
export const TOKEN_RATIOS = CHARS_PER_TOKEN;

