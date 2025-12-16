/**
 * Key sharding for distributing cache load
 */

import type { ShardingOptions } from '../types.js';

let roundRobinCounter = 0;

/**
 * Apply sharding to a cache key
 */
export function applySharding(
  baseKey: string,
  options: ShardingOptions,
): string {
  const { shards, by, token } = options;

  if (shards <= 1) return baseKey;

  let shardIndex: number;

  switch (by) {
    case 'random':
      shardIndex = Math.floor(Math.random() * shards);
      break;

    case 'round-robin':
      shardIndex = roundRobinCounter % shards;
      roundRobinCounter = (roundRobinCounter + 1) % Number.MAX_SAFE_INTEGER;
      break;

    case 'user':
    case 'session':
      if (token) {
        // Consistent hash based on token
        shardIndex = simpleHash(token) % shards;
      } else {
        // Fallback to random if no token provided
        shardIndex = Math.floor(Math.random() * shards);
      }
      break;

    default:
      shardIndex = 0;
  }

  return `${baseKey}_s${shardIndex}`;
}

/**
 * Simple string hash for consistent sharding
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Reset round-robin counter (useful for testing)
 */
export function resetRoundRobin(): void {
  roundRobinCounter = 0;
}
