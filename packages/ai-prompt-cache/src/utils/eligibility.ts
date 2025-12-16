/**
 * Eligibility checking for prompt caching
 */

import type { EligibilityResult, EligibilityReason, ProviderName } from '../types.js';
import { estimateTokens, getMinTokenThreshold } from './tokens.js';

export interface EligibilityCheckInput {
  text: string;
  provider: ProviderName | string;
  modelId?: string;
  enabled?: boolean;
  strictMode?: boolean;
  minTokensOverride?: number;
}

/**
 * Check if prompt caching is eligible for the given input
 */
export function checkEligibility(input: EligibilityCheckInput): EligibilityResult {
  const {
    text,
    provider,
    modelId,
    enabled = true,
    strictMode = false,
    minTokensOverride,
  } = input;

  // Check if caching is disabled
  if (!enabled) {
    return {
      eligible: false,
      reason: 'disabled',
    };
  }

  // Check for empty content
  if (!text || text.trim().length === 0) {
    return {
      eligible: false,
      reason: 'no_cacheable_content',
    };
  }

  // Estimate tokens
  const tokenCount = estimateTokens(text);
  const minRequired = minTokensOverride ?? getMinTokenThreshold(provider, modelId);

  // Check token threshold
  if (tokenCount < minRequired) {
    if (strictMode) {
      return {
        eligible: false,
        reason: 'below_min_tokens',
        details: {
          tokenCount,
          minRequired,
          provider,
        },
      };
    }
    // In non-strict mode, we still apply hints but note it won't cache
    return {
      eligible: true,
      reason: 'below_min_tokens',
      details: {
        tokenCount,
        minRequired,
        provider,
      },
    };
  }

  return {
    eligible: true,
    reason: null,
    details: {
      tokenCount,
      minRequired,
      provider,
    },
  };
}
