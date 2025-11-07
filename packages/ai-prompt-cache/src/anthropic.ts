export function applyAnthropicCacheControl(
  messages: any[],
  uptoExclusive: number,
  ttl?: string,
): any[] {
  return messages.map((message, index) => {
    if (index >= uptoExclusive) {
      return message;
    }

    const existingProviderOptions = (message as any).providerOptions || {};
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
