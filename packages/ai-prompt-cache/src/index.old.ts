import type { LanguageModelMiddleware } from 'ai';
import { applyAnthropicCacheControl } from './anthropic.js';
import { applyOpenAICacheKey } from './openai.js';
import { sha256Hex } from './key.js';
import { extractSystemPrefix, type CacheSelect } from './util.js';

export type PromptCacheOptions = {
  select?: CacheSelect;
  anthropic?: { enable?: boolean; ttl?: string };
  openai?: { enable?: boolean };
  extraKeySalt?: string;
};

type InternalConfig = {
  select: CacheSelect;
  enableAnthropic: boolean;
  enableOpenAI: boolean;
  ttl?: string;
  salt?: string;
};

export function withPromptCache(
  options: PromptCacheOptions = {},
): LanguageModelMiddleware {
  const config: InternalConfig = {
    select: options.select ?? 'system-head',
    enableAnthropic: options.anthropic?.enable ?? true,
    enableOpenAI: options.openai?.enable ?? true,
    ttl: options.anthropic?.ttl,
    salt: options.extraKeySalt,
  };

  return {
    transformParams: async ({ params }: any) => {
      return transformParams(params, config);
    },
    wrapGenerate: async ({ doGenerate }: any) => {
      return doGenerate();
    },
    wrapStream: async ({ doStream }: any) => {
      return doStream();
    },
  };
}

function transformParams(
  original: any,
  config: InternalConfig,
): any {
  const params: any = { ...original };

  console.log('[withPromptCache] Original params:', JSON.stringify({
    hasPrompt: !!params.prompt,
    promptLength: Array.isArray(params.prompt) ? params.prompt.length : 'not-array',
    promptType: Array.isArray(params.prompt) ? typeof params.prompt[0] : 'unknown'
  }, null, 2));

  if (Array.isArray(params.prompt)) {
    const messages = params.prompt as any[];
    const { upto, text } = extractSystemPrefix(messages, config.select);

    console.log(`[withPromptCache] Found ${upto} system messages, ${text.length} chars of text`);

    if (text.length > 0) {
      const cacheKey = sha256Hex({ text, salt: config.salt });
      console.log(`[withPromptCache] Generated cache key: ${cacheKey.substring(0, 16)}...`);

      if (config.enableOpenAI) {
        applyOpenAICacheKey(params, cacheKey);
        console.log('[withPromptCache] Applied OpenAI cache key');
      }

      if (config.enableAnthropic && upto > 0) {
        params.prompt = applyAnthropicCacheControl(messages, upto, config.ttl);
        console.log(`[withPromptCache] Applied Anthropic cache control to ${upto} messages`);
      }
    }
  }

  console.log('[withPromptCache] Final params:', JSON.stringify({
    hasPrompt: !!params.prompt,
    hasProviderOptions: !!params.providerOptions,
    providerOptions: params.providerOptions
  }, null, 2));

  return params;
}

export type { CacheSelect } from './util.js';
