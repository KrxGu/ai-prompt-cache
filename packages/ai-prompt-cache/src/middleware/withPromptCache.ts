/**
 * Prompt cache middleware
 * The main middleware for adding provider-specific prompt caching hints
 */

import type { LanguageModelMiddleware } from 'ai';
import type {
  PromptCacheOptions,
  CacheReport,
  InternalCacheMetadata,
  ProviderName,
} from '../types.js';
import { createCacheKey, extractSystemPrefix } from '../cache-key/index.js';
import { checkEligibility } from '../utils/eligibility.js';
import {
  openaiAdapter,
  anthropicAdapter,
  bedrockAdapter,
  geminiAdapter,
  detectAdapter,
  applyAnthropicCacheControl,
} from '../providers/index.js';

interface InternalConfig {
  select: PromptCacheOptions['select'];
  salt?: string;
  sharding?: PromptCacheOptions['sharding'];
  telemetry?: PromptCacheOptions['telemetry'];
  onEligibilityCheck?: PromptCacheOptions['onEligibilityCheck'];
  onCacheResult?: PromptCacheOptions['onCacheResult'];
  eligibility?: PromptCacheOptions['eligibility'];
  openai: { enable: boolean; retention?: string };
  anthropic: { enable: boolean; ttl?: string };
  bedrock: { enable: boolean };
  gemini: { enable: boolean };
  openaiCompatible: { enable: boolean; providerName?: string };
  debug: boolean;
}

/**
 * Create prompt cache middleware
 */
export function withPromptCache(
  options: PromptCacheOptions = {},
): LanguageModelMiddleware {
  const config: InternalConfig = {
    select: options.select ?? 'system-head',
    salt: options.extraKeySalt,
    sharding: options.sharding,
    telemetry: options.telemetry,
    onEligibilityCheck: options.onEligibilityCheck,
    onCacheResult: options.onCacheResult,
    eligibility: options.eligibility,
    openai: {
      enable: options.openai?.enable ?? true,
      retention: options.openai?.retention,
    },
    anthropic: {
      enable: options.anthropic?.enable ?? true,
      ttl: options.anthropic?.ttl,
    },
    bedrock: {
      enable: options.bedrock?.enable ?? true,
    },
    gemini: {
      enable: options.gemini?.enable ?? true,
    },
    openaiCompatible: {
      enable: options.openaiCompatible?.enable ?? false,
      providerName: options.openaiCompatible?.providerName,
    },
    debug: options.debug ?? false,
  };

  return {
    transformParams: async ({ params }: any) => {
      return transformParams(params, config);
    },

    wrapGenerate: async ({ doGenerate, params }: any) => {
      const startTime = Date.now();
      const metadata = params.providerOptions?.__aiPromptCache as InternalCacheMetadata | undefined;

      // Call telemetry onRequest hook
      if (metadata && config.telemetry?.onRequest) {
        config.telemetry.onRequest({
          cacheKey: metadata.key,
          provider: metadata.provider || 'unknown',
          eligible: metadata.eligible,
          reason: metadata.reason,
        });
      }

      const result = await doGenerate();
      const duration = Date.now() - startTime;

      // Build cache report
      if (metadata) {
        const cacheReport = buildCacheReport(metadata, result, duration);
        
        // Call individual onCacheResult callback
        if (config.onCacheResult) {
          config.onCacheResult(cacheReport);
        }
        
        // Call telemetry onFinish hook
        if (config.telemetry?.onFinish) {
          config.telemetry.onFinish({
            cacheKey: metadata.key,
            cacheReport,
            duration,
          });
        }
      }

      return result;
    },

    wrapStream: async ({ doStream, params }: any) => {
      const startTime = Date.now();
      const metadata = params.providerOptions?.__aiPromptCache as InternalCacheMetadata | undefined;
      let ttft: number | undefined;
      const onCacheResult = config.onCacheResult;
      const telemetryOnFinish = config.telemetry?.onFinish;

      // Call telemetry onRequest hook
      if (metadata && config.telemetry?.onRequest) {
        config.telemetry.onRequest({
          cacheKey: metadata.key,
          provider: metadata.provider || 'unknown',
          eligible: metadata.eligible,
          reason: metadata.reason,
        });
      }

      const result = await doStream();

      // Wrap the stream to capture TTFT
      const originalStream = result.stream;
      let firstChunk = true;

      const wrappedStream = new TransformStream({
        transform(chunk, controller) {
          if (firstChunk) {
            ttft = Date.now() - startTime;
            firstChunk = false;
          }
          controller.enqueue(chunk);
        },
        flush(controller) {
          const duration = Date.now() - startTime;

          // Build cache report and call hooks
          if (metadata) {
            const cacheReport = buildCacheReport(metadata, result, duration, ttft);
            
            // Call individual onCacheResult callback
            if (onCacheResult) {
              onCacheResult(cacheReport);
            }
            
            // Call telemetry onFinish hook
            if (telemetryOnFinish) {
              telemetryOnFinish({
                cacheKey: metadata.key,
                cacheReport,
                ttft,
                duration,
              });
            }
          }
        },
      });

      return {
        ...result,
        stream: originalStream.pipeThrough(wrappedStream),
      };
    },
  };
}

/**
 * Transform params to add cache hints
 */
function transformParams(original: any, config: InternalConfig): any {
  const params: any = { ...original };

  if (config.debug) {
    console.log('[withPromptCache] Processing params...');
  }

  if (!Array.isArray(params.prompt)) {
    return params;
  }

  const messages = params.prompt as any[];
  const { upto, text } = extractSystemPrefix(messages, config.select || 'system-head');

  if (text.length === 0) {
    if (config.debug) {
      console.log('[withPromptCache] No cacheable content found');
    }
    return params;
  }

  // Detect provider
  const adapter = detectAdapter(params);
  const providerName = adapter?.name || 'unknown';

  // Check eligibility
  const eligibilityResult = checkEligibility({
    text,
    provider: providerName,
    modelId: params.modelId,
    enabled: isProviderEnabled(providerName, config),
    strictMode: config.eligibility?.strict,
    minTokensOverride: config.eligibility?.minTokens,
  });

  // Call onEligibilityCheck callback
  if (config.onEligibilityCheck) {
    const minTokens = adapter?.getMinTokenThreshold(params.modelId) || 1024;
    const estimatedTokens = Math.ceil(text.length / 4);
    config.onEligibilityCheck({
      ...eligibilityResult,
      tokensEstimated: estimatedTokens,
      threshold: minTokens,
    });
  }

  // Generate cache key
  const keyResult = createCacheKey({
    messages: messages.slice(0, upto),
    tools: params.tools,
    modelId: params.modelId,
    salt: config.salt,
    sharding: config.sharding,
  });

  if (config.debug) {
    console.log(`[withPromptCache] Provider: ${providerName}`);
    console.log(`[withPromptCache] Eligible: ${eligibilityResult.eligible}`);
    console.log(`[withPromptCache] Cache key: ${keyResult.key.substring(0, 16)}...`);
  }

  // Store internal metadata for later use
  const internalMeta: InternalCacheMetadata = {
    baseKey: keyResult.baseKey,
    key: keyResult.key,
    eligible: eligibilityResult.eligible,
    reason: eligibilityResult.reason || undefined,
    provider: providerName,
    startTime: Date.now(),
  };

  params.providerOptions = params.providerOptions ?? {};
  params.providerOptions.__aiPromptCache = internalMeta;

  // Apply provider-specific cache hints
  if (eligibilityResult.eligible || !config.eligibility?.strict) {
    // OpenAI
    if (config.openai.enable && (providerName === 'openai' || !adapter)) {
      const result = openaiAdapter.applyPromptCache(params, {
        cacheKey: keyResult.key,
        retention: config.openai.retention,
      });
      Object.assign(params, result);
    }

    // Anthropic
    if (config.anthropic.enable && providerName === 'anthropic' && upto > 0) {
      params.prompt = applyAnthropicCacheControl(messages, upto, config.anthropic.ttl);
    }

    // Bedrock
    if (config.bedrock.enable && providerName === 'bedrock') {
      const result = bedrockAdapter.applyPromptCache(params, {
        cacheKey: keyResult.key,
      });
      Object.assign(params, result);
    }

    // Gemini
    if (config.gemini.enable && providerName === 'gemini') {
      const result = geminiAdapter.applyPromptCache(params, {
        cacheKey: keyResult.key,
      });
      Object.assign(params, result);
    }
  }

  return params;
}

/**
 * Check if provider is enabled in config
 */
function isProviderEnabled(provider: string, config: InternalConfig): boolean {
  switch (provider) {
    case 'openai':
      return config.openai.enable;
    case 'anthropic':
      return config.anthropic.enable;
    case 'bedrock':
      return config.bedrock.enable;
    case 'gemini':
      return config.gemini.enable;
    case 'openai-compatible':
      return config.openaiCompatible.enable;
    default:
      return true;
  }
}

/**
 * Build cache report from result
 */
function buildCacheReport(
  metadata: InternalCacheMetadata,
  result: any,
  duration: number,
  ttft?: number,
): CacheReport {
  const adapter = detectAdapter({ providerOptions: { [metadata.provider || 'openai']: {} } });
  const providerReport = adapter?.extractCacheReport(
    result.providerMetadata,
    result.usage,
  ) || {};

  return {
    provider: metadata.provider || 'unknown',
    eligible: metadata.eligible,
    eligibilityReason: metadata.reason,
    cacheKey: metadata.key,
    hit: providerReport.hit ?? false,
    cachedTokens: providerReport.cachedTokens,
    ttft,
    duration,
    source: providerReport.hit ? 'prompt-cache' : 'upstream',
  };
}
