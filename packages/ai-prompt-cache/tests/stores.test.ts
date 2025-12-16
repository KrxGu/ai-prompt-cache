/**
 * Tests for cache stores
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from '../src/stores/memory.js';

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore({ maxSize: 10 });
  });

  it('stores and retrieves values', async () => {
    await store.set('key1', 'value1');
    const value = await store.get('key1');
    expect(value).toBe('value1');
  });

  it('returns null for missing keys', async () => {
    const value = await store.get('nonexistent');
    expect(value).toBeNull();
  });

  it('deletes values', async () => {
    await store.set('key1', 'value1');
    await store.delete('key1');
    const value = await store.get('key1');
    expect(value).toBeNull();
  });

  it('checks existence with has()', async () => {
    await store.set('key1', 'value1');
    expect(await store.has('key1')).toBe(true);
    expect(await store.has('key2')).toBe(false);
  });

  it('respects TTL', async () => {
    await store.set('key1', 'value1', 0.1); // 100ms TTL
    
    // Should exist immediately
    expect(await store.get('key1')).toBe('value1');
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Should be expired
    expect(await store.get('key1')).toBeNull();
  });

  it('evicts oldest when at capacity', async () => {
    const store = new MemoryStore({ maxSize: 3 });
    
    await store.set('key1', 'value1');
    await store.set('key2', 'value2');
    await store.set('key3', 'value3');
    
    // All should exist
    expect(await store.get('key1')).toBe('value1');
    
    // Add one more, should evict key2 (key1 was recently accessed)
    await store.set('key4', 'value4');
    
    expect(store.size).toBe(3);
    expect(await store.get('key4')).toBe('value4');
  });

  it('maintains LRU order on access', async () => {
    const store = new MemoryStore({ maxSize: 3 });
    
    await store.set('key1', 'value1');
    await store.set('key2', 'value2');
    await store.set('key3', 'value3');
    
    // Access key1 to make it recently used
    await store.get('key1');
    
    // Add new key, should evict key2 (oldest not recently accessed)
    await store.set('key4', 'value4');
    
    expect(await store.get('key1')).toBe('value1'); // Still exists
    expect(await store.get('key2')).toBeNull(); // Evicted
  });

  it('clears all entries', async () => {
    await store.set('key1', 'value1');
    await store.set('key2', 'value2');
    
    store.clear();
    
    expect(store.size).toBe(0);
    expect(await store.get('key1')).toBeNull();
  });
});
