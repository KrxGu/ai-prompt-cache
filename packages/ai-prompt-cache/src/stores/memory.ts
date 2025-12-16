/**
 * In-memory LRU cache store
 */

import type { CacheStore } from '../types.js';

interface CacheEntry {
  value: string;
  expiresAt?: number;
}

export interface MemoryStoreOptions {
  /** Maximum number of entries */
  maxSize?: number;
}

export class MemoryStore implements CacheStore {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;

  constructor(options: MemoryStoreOptions = {}) {
    this.maxSize = options.maxSize ?? 1000;
  }

  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check expiration
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // LRU: move to end
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const entry: CacheEntry = {
      value,
      expiresAt: ttlSeconds ? Date.now() + (ttlSeconds * 1000) : undefined,
    };

    this.cache.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current size
   */
  get size(): number {
    return this.cache.size;
  }
}
