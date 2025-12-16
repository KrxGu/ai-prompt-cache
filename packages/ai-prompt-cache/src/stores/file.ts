/**
 * File-based cache store for development
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { CacheStore } from '../types.js';

interface CacheFileContent {
  value: string;
  expiresAt?: number;
}

export interface FileStoreOptions {
  /** Directory to store cache files */
  directory?: string;
}

export class FileStore implements CacheStore {
  private directory: string;

  constructor(options: FileStoreOptions = {}) {
    this.directory = options.directory ?? '.cache/ai-prompt-cache';
    
    // Ensure directory exists
    if (!existsSync(this.directory)) {
      mkdirSync(this.directory, { recursive: true });
    }
  }

  private getFilePath(key: string): string {
    // Sanitize key for filesystem
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return join(this.directory, `${safeKey}.json`);
  }

  async get(key: string): Promise<string | null> {
    const filePath = this.getFilePath(key);
    
    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      const entry: CacheFileContent = JSON.parse(content);

      // Check expiration
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        await this.delete(key);
        return null;
      }

      return entry.value;
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const filePath = this.getFilePath(key);
    
    const entry: CacheFileContent = {
      value,
      expiresAt: ttlSeconds ? Date.now() + (ttlSeconds * 1000) : undefined,
    };

    writeFileSync(filePath, JSON.stringify(entry), 'utf-8');
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key);
    
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }
}
