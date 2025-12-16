/**
 * Tests for provider adapters
 */

import { describe, it, expect } from 'vitest';
import {
  openaiAdapter,
  anthropicAdapter,
  bedrockAdapter,
  geminiAdapter,
  createOpenAICompatibleAdapter,
  detectAdapter,
  applyAnthropicCacheControl,
} from '../src/providers/index.js';

describe('openaiAdapter', () => {
  it('detects OpenAI requests', () => {
    expect(openaiAdapter.detect({ providerOptions: { openai: {} } })).toBe(true);
    expect(openaiAdapter.detect({ modelId: 'gpt-4o' })).toBe(true);
    expect(openaiAdapter.detect({ modelId: 'claude-3' })).toBe(false);
  });

  it('applies prompt cache key', () => {
    const params = { providerOptions: {} };
    const result = openaiAdapter.applyPromptCache(params, {
      cacheKey: 'test-key',
      retention: '24h',
    });

    expect(result.providerOptions.openai.promptCacheKey).toBe('test-key');
    expect(result.providerOptions.openai.promptCacheRetention).toBe('24h');
  });

  it('extracts cache report from metadata', () => {
    const report = openaiAdapter.extractCacheReport(
      { openai: { cachedPromptTokens: 100 } },
      {},
    );

    expect(report.cachedTokens).toBe(100);
    expect(report.hit).toBe(true);
  });

  it('returns min token threshold', () => {
    expect(openaiAdapter.getMinTokenThreshold()).toBe(1024);
  });
});

describe('anthropicAdapter', () => {
  it('detects Anthropic requests', () => {
    expect(anthropicAdapter.detect({ providerOptions: { anthropic: {} } })).toBe(true);
    expect(anthropicAdapter.detect({ modelId: 'claude-3-5-sonnet' })).toBe(true);
    expect(anthropicAdapter.detect({ modelId: 'gpt-4o' })).toBe(false);
  });

  it('extracts cache report from metadata', () => {
    const report = anthropicAdapter.extractCacheReport(
      { anthropic: { cacheReadInputTokens: 50 } },
      {},
    );

    expect(report.cachedTokens).toBe(50);
    expect(report.hit).toBe(true);
  });

  it('returns model-specific token thresholds', () => {
    expect(anthropicAdapter.getMinTokenThreshold('claude-3-haiku')).toBe(2048);
    expect(anthropicAdapter.getMinTokenThreshold('claude-3-opus')).toBe(1024);
    expect(anthropicAdapter.getMinTokenThreshold('claude-3-5-sonnet')).toBe(1024);
  });
});

describe('applyAnthropicCacheControl', () => {
  it('adds cache control to system messages', () => {
    const messages = [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'Hello' },
    ];

    const result = applyAnthropicCacheControl(messages, 1);

    expect(result[0].providerOptions.anthropic.cacheControl).toEqual({
      type: 'ephemeral',
    });
    expect(result[1].providerOptions).toBeUndefined();
  });

  it('includes TTL when provided', () => {
    const messages = [{ role: 'system', content: 'System' }];
    const result = applyAnthropicCacheControl(messages, 1, '1h');

    expect(result[0].providerOptions.anthropic.cacheControl).toEqual({
      type: 'ephemeral',
      ttl: '1h',
    });
  });
});

describe('bedrockAdapter', () => {
  it('detects Bedrock requests', () => {
    expect(bedrockAdapter.detect({ providerOptions: { bedrock: {} } })).toBe(true);
    expect(bedrockAdapter.detect({ modelId: 'amazon.titan' })).toBe(true);
  });

  it('applies cache point', () => {
    const params = { providerOptions: {} };
    const result = bedrockAdapter.applyPromptCache(params, { cacheKey: 'key' });

    expect(result.providerOptions.bedrock.cachePoint).toBeDefined();
  });
});

describe('geminiAdapter', () => {
  it('detects Gemini requests', () => {
    expect(geminiAdapter.detect({ providerOptions: { google: {} } })).toBe(true);
    expect(geminiAdapter.detect({ modelId: 'gemini-pro' })).toBe(true);
  });
});

describe('createOpenAICompatibleAdapter', () => {
  it('creates adapter with custom provider name', () => {
    const adapter = createOpenAICompatibleAdapter({ providerName: 'together' });

    const params = { providerOptions: {} };
    const result = adapter.applyPromptCache(params, { cacheKey: 'key' });

    expect(result.providerOptions.together.prompt_cache_key).toBe('key');
  });
});

describe('detectAdapter', () => {
  it('detects OpenAI', () => {
    const adapter = detectAdapter({ modelId: 'gpt-4o' });
    expect(adapter?.name).toBe('openai');
  });

  it('detects Anthropic', () => {
    const adapter = detectAdapter({ modelId: 'claude-3-5-sonnet' });
    expect(adapter?.name).toBe('anthropic');
  });

  it('returns undefined for unknown', () => {
    const adapter = detectAdapter({ modelId: 'unknown-model' });
    expect(adapter).toBeUndefined();
  });
});
