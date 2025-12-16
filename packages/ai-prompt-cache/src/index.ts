/**
 * @krishgupta/ai-prompt-cache
 * 
 * A production-grade prompt caching middleware suite for the Vercel AI SDK.
 * 
 * Features:
 * - Multi-provider prompt caching (OpenAI, Anthropic, Bedrock, Gemini, OpenAI-compatible)
 * - Response caching with streaming replay
 * - In-flight request coalescing
 * - Key sharding for high-QPS scenarios
 * - Observability hooks and telemetry
 */

// Main middleware exports
export { withPromptCache } from './middleware/withPromptCache.js';
export { withResponseCache } from './middleware/withResponseCache.js';

// Types
export type {
  // Core types
  PromptCacheOptions,
  ResponseCacheOptions,
  CacheReport,
  CacheStore,
  
  // Key types
  CacheKeyInput,
  CacheKeyResult,
  CacheSelect,
  ShardingOptions,
  
  // Eligibility types
  EligibilityResult,
  EligibilityReason,
  
  // Provider types
  ProviderName,
  ProviderAdapter,
  ProviderCacheInfo,
  
  // Telemetry types
  TelemetryHooks,
} from './types.js';

// Cache stores
export { MemoryStore, type MemoryStoreOptions } from './stores/memory.js';
export { FileStore, type FileStoreOptions } from './stores/file.js';

// Provider adapters (for advanced usage)
export {
  openaiAdapter,
  anthropicAdapter,
  bedrockAdapter,
  geminiAdapter,
  openaiCompatibleAdapter,
  createOpenAICompatibleAdapter,
  detectAdapter,
  getAdapter,
  applyOpenAICacheKey,
  applyAnthropicCacheControl,
} from './providers/index.js';

// Cache key utilities (for advanced usage)
export {
  createCacheKey,
  sha256Hex,
  extractSystemPrefix,
} from './cache-key/index.js';

// Utility functions (for advanced usage)
export {
  estimateTokens,
  getMinTokenThreshold,
  checkEligibility,
} from './utils/index.js';
