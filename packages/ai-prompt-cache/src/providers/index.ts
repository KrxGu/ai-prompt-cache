/**
 * Provider adapters index
 */

export { openaiAdapter, applyOpenAICacheKey } from './openai.js';
export { anthropicAdapter, applyAnthropicCacheControl } from './anthropic.js';
export { bedrockAdapter } from './bedrock.js';
export { geminiAdapter } from './gemini.js';
export { openaiCompatibleAdapter, createOpenAICompatibleAdapter } from './openai-compatible.js';

import type { ProviderAdapter, ProviderName } from '../types.js';
import { openaiAdapter } from './openai.js';
import { anthropicAdapter } from './anthropic.js';
import { bedrockAdapter } from './bedrock.js';
import { geminiAdapter } from './gemini.js';
import { openaiCompatibleAdapter } from './openai-compatible.js';

/**
 * All available provider adapters
 */
export const adapters: ProviderAdapter[] = [
  openaiAdapter,
  anthropicAdapter,
  bedrockAdapter,
  geminiAdapter,
  openaiCompatibleAdapter,
];

/**
 * Get adapter by name
 */
export function getAdapter(name: ProviderName): ProviderAdapter | undefined {
  return adapters.find(a => a.name === name);
}

/**
 * Detect the appropriate adapter for given params
 */
export function detectAdapter(params: any): ProviderAdapter | undefined {
  // Check in order of specificity
  for (const adapter of adapters) {
    if (adapter.detect(params)) {
      return adapter;
    }
  }
  return undefined;
}
