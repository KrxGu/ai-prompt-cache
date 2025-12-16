/**
 * Cache key generation engine
 */

import { createHash } from 'node:crypto';
import type { CacheKeyInput, CacheKeyResult, CacheSelect } from '../types.js';
import { extractNormalizedText, canonicalizeTools, stableStringify } from './canonicalize.js';
import { applySharding } from './sharding.js';
import { estimateTokens } from '../utils/tokens.js';

/**
 * Generate a deterministic cache key from input
 */
export function createCacheKey(input: CacheKeyInput): CacheKeyResult {
  const { messages, tools, modelId, salt, version = 'v1', sharding } = input;

  const components: string[] = [];

  // Add version for future-proofing
  components.push(`version:${version}`);

  // Add model ID if provided (prevents cross-model collisions)
  if (modelId) {
    components.push(`model:${modelId}`);
  }

  // Add salt if provided
  if (salt) {
    components.push(`salt:${salt}`);
  }

  // Extract and normalize message text
  const messageText = extractNormalizedText(messages as any[]);
  if (messageText) {
    components.push(`messages:${messageText}`);
  }

  // Canonicalize tools if present
  if (tools) {
    const toolsStr = canonicalizeTools(tools);
    if (toolsStr) {
      components.push(`tools:${toolsStr}`);
    }
  }

  // Create the composite string to hash
  const composite = components.join('|');
  const chars = composite.length;
  const approxTokens = estimateTokens(composite);

  // Generate SHA-256 hash (truncated to 32 chars)
  const baseKey = sha256Hex(composite);

  // Apply sharding if configured
  const key = sharding ? applySharding(baseKey, sharding) : baseKey;

  return {
    key,
    baseKey,
    debug: {
      chars,
      approxTokens,
      components: components.map(c => c.split(':')[0]),
    },
  };
}

/**
 * Generate SHA-256 hex hash (32 chars)
 */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 32);
}

/**
 * Legacy function for backward compatibility
 */
export function sha256HexLegacy(input: unknown): string {
  const serialized = stableStringify(input);
  return createHash('sha256').update(serialized).digest('hex').slice(0, 32);
}

/**
 * Extract system prefix from messages based on selector
 */
export function extractSystemPrefix(
  messages: any[],
  selector: CacheSelect,
): { upto: number; text: string } {
  if (typeof selector === 'function') {
    const upto = clampIndex(selector(messages), messages.length);
    return { upto, text: extractNormalizedText(messages.slice(0, upto)) };
  }

  if (selector === 'tools+system') {
    // Include all system messages plus any tool definitions
    let upto = 0;
    while (upto < messages.length && messages[upto].role === 'system') {
      upto += 1;
    }
    return { upto, text: extractNormalizedText(messages.slice(0, upto)) };
  }

  // Default: 'system-head' - consecutive system messages from the start
  let upto = 0;
  while (upto < messages.length && messages[upto].role === 'system') {
    upto += 1;
  }
  return { upto, text: extractNormalizedText(messages.slice(0, upto)) };
}

function clampIndex(value: number, max: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > max) return max;
  return Math.floor(value);
}
