/**
 * OpenAI provider adapter
 */

import type { ProviderAdapter, ProviderCacheInfo, CacheReport, ProviderName } from '../types.js';

export const openaiAdapter: ProviderAdapter = {
  name: 'openai' as ProviderName,

  detect(params: any): boolean {
    // Check if this looks like an OpenAI request
    const providerOptions = params.providerOptions;
    if (providerOptions?.openai !== undefined) return true;
    
    // Check model ID patterns
    const modelId = params.modelId || '';
    if (modelId.startsWith('gpt-') || modelId.includes('openai')) return true;
    
    return false;
  },

  applyPromptCache(params: any, info: ProviderCacheInfo): any {
    const { cacheKey, retention } = info;
    
    const providerOptions = params.providerOptions ?? {};
    
    providerOptions.openai = {
      ...providerOptions.openai,
      // AI SDK uses camelCase
      promptCacheKey: cacheKey,
      // Add retention if specified
      ...(retention && { promptCacheRetention: retention }),
    };

    return {
      ...params,
      providerOptions,
    };
  },

  extractCacheReport(metadata: any, usage: any): Partial<CacheReport> {
    const report: Partial<CacheReport> = {
      provider: 'openai',
    };

    // Extract cached tokens from provider metadata
    if (metadata?.openai?.cachedPromptTokens) {
      report.cachedTokens = metadata.openai.cachedPromptTokens;
      report.hit = metadata.openai.cachedPromptTokens > 0;
    }

    // Also check usage object
    if (usage?.cachedInputTokens) {
      report.cachedTokens = usage.cachedInputTokens;
      report.hit = usage.cachedInputTokens > 0;
    }

    return report;
  },

  getMinTokenThreshold(modelId?: string): number {
    // OpenAI caching kicks in at 1024 tokens
    return 1024;
  },
};

/**
 * Apply OpenAI cache key (legacy function for backward compatibility)
 */
export function applyOpenAICacheKey(params: any, key: string, retention?: string): void {
  const result = openaiAdapter.applyPromptCache(params, { cacheKey: key, retention });
  Object.assign(params, result);
}
