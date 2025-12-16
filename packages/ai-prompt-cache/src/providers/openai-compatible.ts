/**
 * OpenAI-compatible provider adapter
 * For use with OpenAI-compatible APIs (Together, Groq, local LLMs, etc.)
 */

import type { ProviderAdapter, ProviderCacheInfo, CacheReport, ProviderName } from '../types.js';

export interface OpenAICompatibleOptions {
  /** The provider name to use in providerOptions */
  providerName?: string;
}

/**
 * Create an OpenAI-compatible adapter with custom provider name
 */
export function createOpenAICompatibleAdapter(options: OpenAICompatibleOptions = {}): ProviderAdapter {
  const providerName = options.providerName || 'openai-compatible';

  return {
    name: 'openai-compatible' as ProviderName,

    detect(params: any): boolean {
      // This adapter is used explicitly, not auto-detected
      // Check if the specified provider name is in options
      const providerOptions = params.providerOptions;
      if (providerOptions?.[providerName] !== undefined) return true;
      
      return false;
    },

    applyPromptCache(params: any, info: ProviderCacheInfo): any {
      const { cacheKey, retention } = info;
      
      const providerOptions = params.providerOptions ?? {};
      
      // Use snake_case for OpenAI-compatible APIs (matches OpenAI REST API format)
      providerOptions[providerName] = {
        ...providerOptions[providerName],
        prompt_cache_key: cacheKey,
        ...(retention && { prompt_cache_retention: retention }),
      };

      return {
        ...params,
        providerOptions,
      };
    },

    extractCacheReport(metadata: any, usage: any): Partial<CacheReport> {
      const report: Partial<CacheReport> = {
        provider: providerName,
      };

      // Try to extract from provider-specific metadata
      const providerMeta = metadata?.[providerName];
      if (providerMeta?.cachedPromptTokens !== undefined) {
        report.cachedTokens = providerMeta.cachedPromptTokens;
        report.hit = providerMeta.cachedPromptTokens > 0;
      }

      // Also check usage object
      if (usage?.cachedInputTokens !== undefined) {
        report.cachedTokens = usage.cachedInputTokens;
        report.hit = usage.cachedInputTokens > 0;
      }

      return report;
    },

    getMinTokenThreshold(modelId?: string): number {
      // Default threshold for OpenAI-compatible providers
      return 1024;
    },
  };
}

// Default instance
export const openaiCompatibleAdapter = createOpenAICompatibleAdapter();
