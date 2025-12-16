/**
 * Tests for cache key generation
 */

import { describe, it, expect } from 'vitest';
import { createCacheKey, sha256Hex, extractSystemPrefix } from '../src/cache-key/index.js';

describe('sha256Hex', () => {
  it('generates consistent hash for same input', () => {
    const hash1 = sha256Hex('hello world');
    const hash2 = sha256Hex('hello world');
    expect(hash1).toBe(hash2);
  });

  it('generates different hash for different input', () => {
    const hash1 = sha256Hex('hello world');
    const hash2 = sha256Hex('hello world!');
    expect(hash1).not.toBe(hash2);
  });

  it('returns 32 character hex string', () => {
    const hash = sha256Hex('test');
    expect(hash).toHaveLength(32);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });
});

describe('createCacheKey', () => {
  it('generates deterministic key for same messages', () => {
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
    ];

    const result1 = createCacheKey({ messages });
    const result2 = createCacheKey({ messages });

    expect(result1.key).toBe(result2.key);
    expect(result1.baseKey).toBe(result2.baseKey);
  });

  it('generates different key for different messages', () => {
    const messages1 = [{ role: 'system', content: 'Assistant A' }];
    const messages2 = [{ role: 'system', content: 'Assistant B' }];

    const result1 = createCacheKey({ messages: messages1 });
    const result2 = createCacheKey({ messages: messages2 });

    expect(result1.key).not.toBe(result2.key);
  });

  it('includes salt in key generation', () => {
    const messages = [{ role: 'system', content: 'Hello' }];

    const result1 = createCacheKey({ messages, salt: 'salt1' });
    const result2 = createCacheKey({ messages, salt: 'salt2' });

    expect(result1.key).not.toBe(result2.key);
  });

  it('includes modelId in key generation', () => {
    const messages = [{ role: 'system', content: 'Hello' }];

    const result1 = createCacheKey({ messages, modelId: 'gpt-4o' });
    const result2 = createCacheKey({ messages, modelId: 'gpt-4o-mini' });

    expect(result1.key).not.toBe(result2.key);
  });

  it('includes debug info', () => {
    const messages = [{ role: 'system', content: 'Hello world' }];
    const result = createCacheKey({ messages });

    expect(result.debug.chars).toBeGreaterThan(0);
    expect(result.debug.approxTokens).toBeGreaterThan(0);
    expect(result.debug.components).toContain('version');
  });

  it('applies sharding when configured', () => {
    const messages = [{ role: 'system', content: 'Hello' }];
    
    const result = createCacheKey({
      messages,
      sharding: { shards: 4, by: 'random' },
    });

    // Key should have shard suffix
    expect(result.key).toMatch(/_s\d$/);
    // Base key should not have shard suffix
    expect(result.baseKey).not.toMatch(/_s\d$/);
  });

  it('consistent sharding with user token', () => {
    const messages = [{ role: 'system', content: 'Hello' }];
    
    const result1 = createCacheKey({
      messages,
      sharding: { shards: 4, by: 'user', token: 'user123' },
    });
    const result2 = createCacheKey({
      messages,
      sharding: { shards: 4, by: 'user', token: 'user123' },
    });

    expect(result1.key).toBe(result2.key);
  });
});

describe('extractSystemPrefix', () => {
  it('extracts consecutive system messages', () => {
    const messages = [
      { role: 'system', content: 'System 1' },
      { role: 'system', content: 'System 2' },
      { role: 'user', content: 'Hello' },
    ];

    const result = extractSystemPrefix(messages, 'system-head');

    expect(result.upto).toBe(2);
    expect(result.text).toContain('System 1');
    expect(result.text).toContain('System 2');
  });

  it('handles no system messages', () => {
    const messages = [
      { role: 'user', content: 'Hello' },
    ];

    const result = extractSystemPrefix(messages, 'system-head');

    expect(result.upto).toBe(0);
    expect(result.text).toBe('');
  });

  it('supports custom selector function', () => {
    const messages = [
      { role: 'system', content: 'System' },
      { role: 'user', content: 'User' },
      { role: 'assistant', content: 'Assistant' },
    ];

    const result = extractSystemPrefix(messages, () => 2);

    expect(result.upto).toBe(2);
  });

  it('handles multipart content', () => {
    const messages = [
      {
        role: 'system',
        content: [
          { type: 'text', text: 'Part 1' },
          { type: 'text', text: 'Part 2' },
        ],
      },
    ];

    const result = extractSystemPrefix(messages, 'system-head');

    expect(result.upto).toBe(1);
    expect(result.text).toContain('Part 1');
    expect(result.text).toContain('Part 2');
  });
});
