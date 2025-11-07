export function applyOpenAICacheKey(
  params: any,
  key: string,
): void {
  const providerOptions = params.providerOptions ?? {};

  // Note: OpenAI doesn't actually support prompt caching via a cache key parameter
  // The Responses API caches automatically based on prompt content
  // We're adding this for potential future support or custom proxy usage
  providerOptions.openai = {
    ...providerOptions.openai,
    // Try both snake_case and camelCase versions
    prompt_cache_key: key,
    promptCacheKey: key,
  };

  params.providerOptions = providerOptions;
  
  console.log('[OpenAI] Applied cache key to params:', {
    hasProviderOptions: !!params.providerOptions,
    hasOpenAIOptions: !!params.providerOptions?.openai,
    prompt_cache_key: params.providerOptions?.openai?.prompt_cache_key?.substring(0, 16) + '...',
    promptCacheKey: params.providerOptions?.openai?.promptCacheKey?.substring(0, 16) + '...'
  });
}
