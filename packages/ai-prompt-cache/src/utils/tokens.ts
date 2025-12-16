/**
 * Token estimation utilities
 */

/**
 * Approximate token count from character count
 * Heuristic: ~4 chars per token for English text
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Minimum token thresholds by provider
 * These are the minimum tokens required for caching to be effective
 */
export const MIN_TOKEN_THRESHOLDS: Record<string, number> = {
  // OpenAI: caching kicks in at 1024 tokens
  openai: 1024,
  // Anthropic: varies by model, using Claude 3.5 Sonnet minimum
  anthropic: 1024,
  // Bedrock: similar to underlying model
  bedrock: 1024,
  // Gemini: varies by tier
  gemini: 1024,
  // Default for unknown providers
  default: 1024,
};

/**
 * Get minimum token threshold for a provider
 */
export function getMinTokenThreshold(provider: string, modelId?: string): number {
  // Anthropic has model-specific thresholds
  if (provider === 'anthropic' && modelId) {
    if (modelId.includes('haiku')) return 2048;
    if (modelId.includes('opus')) return 1024;
    // Claude 3.5 Sonnet and others
    return 1024;
  }

  return MIN_TOKEN_THRESHOLDS[provider] ?? MIN_TOKEN_THRESHOLDS.default;
}
