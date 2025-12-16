/**
 * Amazon Bedrock provider adapter
 */

import type { ProviderAdapter, ProviderCacheInfo, CacheReport, ProviderName } from '../types.js';

export const bedrockAdapter: ProviderAdapter = {
  name: 'bedrock' as ProviderName,

  detect(params: any): boolean {
    const providerOptions = params.providerOptions;
    if (providerOptions?.bedrock !== undefined) return true;
    
    const modelId = params.modelId || '';
    if (modelId.includes('bedrock') || modelId.includes('amazon')) return true;
    
    return false;
  },

  applyPromptCache(params: any, info: ProviderCacheInfo): any {
    const { cacheKey } = info;
    
    const providerOptions = params.providerOptions ?? {};
    
    // Bedrock uses cache points for prompt caching
    providerOptions.bedrock = {
      ...providerOptions.bedrock,
      cachePoint: {
        type: 'default',
      },
    };

    return {
      ...params,
      providerOptions,
    };
  },

  extractCacheReport(metadata: any, usage: any): Partial<CacheReport> {
    const report: Partial<CacheReport> = {
      provider: 'bedrock',
    };

    // Extract from provider metadata if available
    if (metadata?.bedrock?.cacheReadInputTokenCount !== undefined) {
      report.cachedTokens = metadata.bedrock.cacheReadInputTokenCount;
      report.hit = metadata.bedrock.cacheReadInputTokenCount > 0;
    }

    // Also check usage object
    if (usage?.cachedInputTokens !== undefined) {
      report.cachedTokens = usage.cachedInputTokens;
      report.hit = usage.cachedInputTokens > 0;
    }

    return report;
  },

  getMinTokenThreshold(modelId?: string): number {
    // Bedrock threshold depends on underlying model
    return 1024;
  },
};
