/**
 * Google Gemini provider adapter
 */

import type { ProviderAdapter, ProviderCacheInfo, CacheReport, ProviderName } from '../types.js';

export const geminiAdapter: ProviderAdapter = {
  name: 'gemini' as ProviderName,

  detect(params: any): boolean {
    const providerOptions = params.providerOptions;
    if (providerOptions?.google !== undefined) return true;
    if (providerOptions?.gemini !== undefined) return true;
    
    const modelId = params.modelId || '';
    if (modelId.includes('gemini') || modelId.includes('google')) return true;
    
    return false;
  },

  applyPromptCache(params: any, info: ProviderCacheInfo): any {
    // Gemini uses implicit caching based on consistent prefixes
    // No explicit cache key needed, but we can set context caching options
    const providerOptions = params.providerOptions ?? {};
    
    // Gemini's context caching is automatic for consistent prefixes
    // We just need to ensure the prefix is consistent (which our canonicalization handles)
    providerOptions.google = {
      ...providerOptions.google,
      // Enable cached content if available
      cachedContent: providerOptions.google?.cachedContent,
    };

    return {
      ...params,
      providerOptions,
    };
  },

  extractCacheReport(metadata: any, usage: any): Partial<CacheReport> {
    const report: Partial<CacheReport> = {
      provider: 'gemini',
    };

    // Extract from provider metadata if available
    if (metadata?.google?.cachedContentTokenCount !== undefined) {
      report.cachedTokens = metadata.google.cachedContentTokenCount;
      report.hit = metadata.google.cachedContentTokenCount > 0;
    }

    // Also check usage object
    if (usage?.cachedInputTokens !== undefined) {
      report.cachedTokens = usage.cachedInputTokens;
      report.hit = usage.cachedInputTokens > 0;
    }

    return report;
  },

  getMinTokenThreshold(modelId?: string): number {
    // Gemini thresholds vary by tier
    if (modelId?.includes('pro')) return 1024;
    if (modelId?.includes('flash')) return 1024;
    return 1024;
  },
};
