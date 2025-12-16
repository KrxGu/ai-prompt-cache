/**
 * Tests for eligibility and token utilities
 */

import { describe, it, expect } from 'vitest';
import { estimateTokens, getMinTokenThreshold } from '../src/utils/tokens.js';
import { checkEligibility } from '../src/utils/eligibility.js';

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates tokens based on character count', () => {
    // ~4 chars per token
    expect(estimateTokens('Hello world')).toBe(3); // 11 chars / 4 = 2.75 -> 3
    expect(estimateTokens('a'.repeat(100))).toBe(25); // 100 / 4 = 25
  });
});

describe('getMinTokenThreshold', () => {
  it('returns default threshold for unknown providers', () => {
    expect(getMinTokenThreshold('unknown')).toBe(1024);
  });

  it('returns provider-specific thresholds', () => {
    expect(getMinTokenThreshold('openai')).toBe(1024);
    expect(getMinTokenThreshold('anthropic')).toBe(1024);
  });

  it('returns model-specific thresholds for Anthropic', () => {
    expect(getMinTokenThreshold('anthropic', 'claude-3-haiku')).toBe(2048);
    expect(getMinTokenThreshold('anthropic', 'claude-3-opus')).toBe(1024);
  });
});

describe('checkEligibility', () => {
  it('returns eligible for sufficient tokens', () => {
    const text = 'a'.repeat(5000); // ~1250 tokens
    const result = checkEligibility({ text, provider: 'openai' });

    expect(result.eligible).toBe(true);
    expect(result.reason).toBeNull();
  });

  it('returns ineligible in strict mode for insufficient tokens', () => {
    const text = 'Hello world'; // ~3 tokens
    const result = checkEligibility({
      text,
      provider: 'openai',
      strictMode: true,
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('below_min_tokens');
    expect(result.details?.tokenCount).toBe(3);
    expect(result.details?.minRequired).toBe(1024);
  });

  it('returns eligible with warning in non-strict mode', () => {
    const text = 'Hello world';
    const result = checkEligibility({
      text,
      provider: 'openai',
      strictMode: false,
    });

    // Still eligible but with a reason
    expect(result.eligible).toBe(true);
    expect(result.reason).toBe('below_min_tokens');
  });

  it('returns ineligible when disabled', () => {
    const text = 'a'.repeat(5000);
    const result = checkEligibility({
      text,
      provider: 'openai',
      enabled: false,
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('disabled');
  });

  it('returns ineligible for empty content', () => {
    const result = checkEligibility({
      text: '',
      provider: 'openai',
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('no_cacheable_content');
  });

  it('respects minTokensOverride', () => {
    const text = 'a'.repeat(200); // ~50 tokens
    const result = checkEligibility({
      text,
      provider: 'openai',
      minTokensOverride: 10,
    });

    expect(result.eligible).toBe(true);
    expect(result.reason).toBeNull();
  });
});
