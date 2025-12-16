/**
 * Anthropic provider adapter
 */

import type { ProviderAdapter, ProviderCacheInfo, CacheReport, ProviderName } from '../types.js';

export const anthropicAdapter: ProviderAdapter = {
  name: 'anthropic' as ProviderName,

  detect(params: any): boolean {
    const providerOptions = params.providerOptions;
    if (providerOptions?.anthropic !== undefined) return true;
    
    const modelId = params.modelId || '';
    if (modelId.includes('claude') || modelId.includes('anthropic')) return true;
    
    return false;
  },

  applyPromptCache(params: any, info: ProviderCacheInfo): any {
    // Anthropic uses message-level cacheControl
    // This is handled differently - we need to modify messages directly
    // The actual application is done via applyAnthropicCacheControl
    return params;
  },

  extractCacheReport(metadata: any, usage: any): Partial<CacheReport> {
    const report: Partial<CacheReport> = {
      provider: 'anthropic',
    };

    // Extract from provider metadata
    const anthropicMeta = metadata?.anthropic;
    if (anthropicMeta) {
      if (anthropicMeta.cacheReadInputTokens !== undefined) {
        report.cachedTokens = anthropicMeta.cacheReadInputTokens;
        report.hit = anthropicMeta.cacheReadInputTokens > 0;
      }
      if (anthropicMeta.cacheCreationInputTokens !== undefined) {
        // Cache was created (first request with this prefix)
        report.hit = report.hit || false; // Still counts as a miss for the read
      }
    }

    // Also check usage object
    if (usage?.cachedInputTokens !== undefined) {
      report.cachedTokens = usage.cachedInputTokens;
      report.hit = usage.cachedInputTokens > 0;
    }

    return report;
  },

  getMinTokenThreshold(modelId?: string): number {
    if (modelId?.includes('haiku')) return 2048;
    if (modelId?.includes('opus')) return 1024;
    // Claude 3.5 Sonnet and others
    return 1024;
  },
};

/**
 * Apply Anthropic cache control markers to messages
 */
export function applyAnthropicCacheControl(
  messages: any[],
  uptoExclusive: number,
  ttl?: string,
): any[] {
  return messages.map((message, index) => {
    if (index >= uptoExclusive) {
      return message;
    }

    const existingProviderOptions = message.providerOptions || {};
    const existingAnthropic = existingProviderOptions.anthropic || {};
    
    const providerOptions = {
      ...existingProviderOptions,
      anthropic: {
        ...existingAnthropic,
        cacheControl: ttl ? { type: 'ephemeral', ttl } : { type: 'ephemeral' },
      },
    };

    return {
      ...message,
      providerOptions,
    };
  });
}
