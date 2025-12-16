# @krishgupta/ai-prompt-cache

A production-grade prompt caching middleware suite for the Vercel AI SDK. Reduce TTFT by 26-69% with multi-provider support.

## Features

- **Multi-provider prompt caching**: OpenAI, Anthropic, Bedrock, Gemini, OpenAI-compatible
- **Response caching**: Full response caching with streaming replay
- **In-flight coalescing**: Deduplicate concurrent identical requests
- **Key sharding**: Distribute cache keys for high-QPS scenarios
- **Observability hooks**: Track eligibility, cache hits, and TTFT

## Installation

```bash
npm install @krishgupta/ai-prompt-cache
```

## Quick Start

```ts
import { wrapLanguageModel, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { withPromptCache } from '@krishgupta/ai-prompt-cache';

const model = wrapLanguageModel({
  model: openai('gpt-4o'),
  middleware: withPromptCache({
    select: 'system-head',
    extraKeySalt: 'my-app-v1',
    onCacheResult: (report) => {
      console.log(`Cache ${report.hit ? 'HIT' : 'MISS'}: ${report.cachedTokens || 0} tokens`);
    },
  }),
});

const result = await streamText({
  model,
  messages: [
    { role: 'system', content: 'You are a helpful assistant...' },
    { role: 'user', content: 'Hello!' },
  ],
});
```

## Response Caching

For even faster responses, add full response caching:

```ts
import { withPromptCache, withResponseCache, MemoryStore } from '@krishgupta/ai-prompt-cache';

const responseStore = new MemoryStore({ maxSize: 1000 });

const model = wrapLanguageModel({
  model: openai('gpt-4o'),
  middleware: [
    withPromptCache({ select: 'system-head' }),
    withResponseCache({
      store: responseStore,
      ttlSeconds: 3600,
      onCacheResult: ({ hit }) => console.log(hit ? 'Response HIT' : 'Response MISS'),
    }),
  ],
});
```

## Provider Support

| Provider | Status | Cache Mechanism |
| --- | --- | --- |
| OpenAI | ✅ | `promptCacheKey` with retention options |
| Anthropic | ✅ | `cacheControl` markers with TTL |
| AWS Bedrock | ✅ | `cachePoint` for Claude models |
| Google Gemini | ✅ | Implicit caching (context caching) |
| OpenAI-compatible | ✅ | Same as OpenAI |

## Options

### withPromptCache

| Option | Default | Description |
| --- | --- | --- |
| `select` | `'system-head'` | Which prefix to cache: `'system-head'`, `'tools+system'`, or custom function |
| `extraKeySalt` | `undefined` | Extra data mixed into cache key (RAG chunk IDs, version) |
| `sharding.shards` | `undefined` | Number of shards for high-QPS scenarios |
| `sharding.by` | `'random'` | Sharding strategy: `'random'`, `'round-robin'`, `'user'`, `'session'` |
| `onEligibilityCheck` | `undefined` | Callback after eligibility check |
| `onCacheResult` | `undefined` | Callback with cache report after completion |
| `eligibility.strict` | `false` | Skip caching if below provider's minimum tokens |
| `debug` | `false` | Enable debug logging |

### withResponseCache

| Option | Default | Description |
| --- | --- | --- |
| `store` | required | Cache store (MemoryStore, FileStore, or custom) |
| `ttlSeconds` | `3600` | Time-to-live for cached responses |
| `coalesceInflight` | `false` | Deduplicate concurrent identical requests |
| `keyGenerator` | `undefined` | Custom cache key generator |
| `onCacheResult` | `undefined` | Callback with hit/miss status |
| `debug` | `false` | Enable debug logging |

## Cache Stores

### MemoryStore (built-in)

```ts
import { MemoryStore } from '@krishgupta/ai-prompt-cache';
const store = new MemoryStore({ maxSize: 1000 }); // LRU cache
```

### FileStore (development)

```ts
import { FileStore } from '@krishgupta/ai-prompt-cache';
const store = new FileStore({ directory: '.cache' });
```

### Custom Store

Implement the `CacheStore` interface:

```ts
interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  delete?(key: string): Promise<void>;
}
```

## Observability

Track cache performance with callbacks:

```ts
withPromptCache({
  onEligibilityCheck: (result) => {
    if (!result.eligible) {
      console.log(`Ineligible: ${result.reason}, tokens: ${result.tokensEstimated}`);
    }
  },
  onCacheResult: (report) => {
    metrics.record({
      provider: report.provider,
      hit: report.hit,
      cachedTokens: report.cachedTokens,
      ttft: report.ttft,
    });
  },
});
```

## Provider Notes

- **OpenAI**: Caches prompts ≥1024 tokens, reuses in 128-token increments. `promptCacheKey` improves hit rate.
- **Anthropic**: Requires `cacheControl` markers and minimum tokens (1024 for Sonnet, 2048 for Haiku).
- **Bedrock**: Uses `cachePoint` for Claude models on AWS Bedrock.
- **Gemini**: Uses implicit context caching (no explicit markers needed).

## License

MIT
