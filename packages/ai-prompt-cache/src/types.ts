/**
 * Core types for ai-prompt-cache
 */

// ============================================================================
// Cache Key Types
// ============================================================================

export type CacheSelect =
  | 'system-head'
  | 'tools+system'
  | ((messages: any[]) => number);

export interface ShardingOptions {
  /** Number of shards to distribute keys across */
  shards: number;
  /** Strategy for shard assignment */
  by: 'random' | 'round-robin' | 'user' | 'session';
  /** Token for consistent sharding (user id, session id, etc.) */
  token?: string;
}

export interface CacheKeyInput {
  messages: unknown[];
  tools?: unknown;
  modelId?: string;
  salt?: string;
  version?: string;
  sharding?: ShardingOptions;
}

export interface CacheKeyResult {
  /** Final cache key (possibly sharded) */
  key: string;
  /** Base key before sharding */
  baseKey: string;
  /** Debug information */
  debug: {
    chars: number;
    approxTokens: number;
    components: string[];
  };
}

// ============================================================================
// Eligibility Types
// ============================================================================

export interface EligibilityResult {
  eligible: boolean;
  reason: EligibilityReason | null;
  details?: {
    tokenCount: number;
    minRequired: number;
    provider: string;
  };
}

export type EligibilityReason =
  | 'below_min_tokens'
  | 'unsupported_model'
  | 'unsupported_provider'
  | 'no_cacheable_content'
  | 'disabled';

// ============================================================================
// Provider Types
// ============================================================================

export type ProviderName =
  | 'openai'
  | 'anthropic'
  | 'bedrock'
  | 'gemini'
  | 'openai-compatible';

export interface ProviderCacheInfo {
  cacheKey: string;
  retention?: string;
  ttl?: string;
}

export interface ProviderAdapter {
  name: ProviderName;
  /** Detect if this provider should handle the request */
  detect(params: any): boolean;
  /** Apply provider-specific cache hints to params */
  applyPromptCache(params: any, info: ProviderCacheInfo): any;
  /** Extract cache report from provider metadata */
  extractCacheReport(metadata: any, usage: any): Partial<CacheReport>;
  /** Get minimum token threshold for caching */
  getMinTokenThreshold(modelId?: string): number;
}

// ============================================================================
// Cache Report Types
// ============================================================================

export interface CacheReport {
  /** Provider that handled the request */
  provider: ProviderName | string;
  /** Whether caching was eligible */
  eligible: boolean;
  /** Reason if not eligible */
  eligibilityReason?: EligibilityReason;
  /** The cache key used */
  cacheKey: string;
  /** Whether this was a cache hit */
  hit: boolean;
  /** Number of tokens served from cache */
  cachedTokens?: number;
  /** Time to first token (ms) */
  ttft?: number;
  /** Total duration (ms) */
  duration?: number;
  /** Source of response */
  source: 'prompt-cache' | 'response-cache' | 'upstream';
}

// ============================================================================
// Telemetry Types
// ============================================================================

export interface TelemetryHooks {
  /** Called before making the request */
  onRequest?: (info: {
    cacheKey: string;
    provider: string;
    eligible: boolean;
    reason?: EligibilityReason;
  }) => void;
  /** Called after request completes */
  onFinish?: (info: {
    cacheKey: string;
    cacheReport: CacheReport;
    ttft?: number;
    duration: number;
  }) => void;
}

// ============================================================================
// Cache Store Types
// ============================================================================

export interface CacheStore {
  /** Get a value from the cache */
  get(key: string): Promise<string | null>;
  /** Set a value in the cache */
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  /** Delete a value from the cache */
  delete?(key: string): Promise<void>;
  /** Check if key exists */
  has?(key: string): Promise<boolean>;
}

// ============================================================================
// Middleware Options Types
// ============================================================================

export interface PromptCacheOptions {
  /** Which prefix of messages to hash */
  select?: CacheSelect;
  /** Extra data mixed into the hash */
  extraKeySalt?: string;
  /** Key sharding options */
  sharding?: ShardingOptions;
  /** Telemetry hooks (alternative to individual callbacks) */
  telemetry?: TelemetryHooks;
  /** Called after eligibility check */
  onEligibilityCheck?: (result: EligibilityResult & { tokensEstimated?: number; threshold?: number }) => void;
  /** Called after cache result is known */
  onCacheResult?: (report: CacheReport) => void;
  /** Strict eligibility checking */
  eligibility?: {
    strict?: boolean;
    minTokens?: number;
  };
  /** OpenAI-specific options */
  openai?: {
    enable?: boolean;
    retention?: '1h' | '24h';
  };
  /** Anthropic-specific options */
  anthropic?: {
    enable?: boolean;
    ttl?: string;
  };
  /** Bedrock-specific options */
  bedrock?: {
    enable?: boolean;
  };
  /** Gemini-specific options */
  gemini?: {
    enable?: boolean;
  };
  /** OpenAI-compatible provider options */
  openaiCompatible?: {
    enable?: boolean;
    providerName?: string;
  };
  /** Enable debug logging */
  debug?: boolean;
}

export interface ResponseCacheOptions {
  /** Cache store to use */
  store: CacheStore;
  /** Extra data mixed into the hash */
  extraKeySalt?: string;
  /** TTL in seconds */
  ttlSeconds?: number;
  /** Enable in-flight request coalescing */
  coalesceInflight?: boolean;
  /** Custom key generator */
  keyGenerator?: (params: any) => string;
  /** Telemetry hooks (alternative to individual callbacks) */
  telemetry?: TelemetryHooks;
  /** Called after cache result is known */
  onCacheResult?: (report: { hit: boolean; cacheKey: string; source: 'response-cache' | 'upstream' }) => void;
  /** Enable debug logging */
  debug?: boolean;
}

// ============================================================================
// Internal Types
// ============================================================================

export interface InternalCacheMetadata {
  baseKey: string;
  key: string;
  eligible: boolean;
  reason?: EligibilityReason;
  provider?: string;
  startTime?: number;
}
