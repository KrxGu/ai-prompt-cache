# @krishgupta/ai-prompt-cache

Middleware for the Vercel AI SDK that enables prompt caching across providers. Tested improvements show 50%+ reduction in time-to-first-token (TTFT).

## Features

- Multi-provider prompt caching (OpenAI, Anthropic, Bedrock, Gemini)
- Full response caching with streaming replay
- In-flight request coalescing to deduplicate concurrent calls
- Key sharding for high-QPS scenarios
- Observability hooks for tracking cache hits and TTFT

## Installation

```bash
npm install @krishgupta/ai-prompt-cache
```

## Usage

```ts
import { wrapLanguageModel, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { withPromptCache } from '@krishgupta/ai-prompt-cache';

const model = wrapLanguageModel({
  model: openai('gpt-4o'),
  middleware: withPromptCache({
    select: 'system-head',
    extraKeySalt: 'my-app-v1',
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

## Benchmark Results

Tested with OpenAI gpt-4o and a ~1200 line system prompt:

| Request | Mode | TTFT |
|---------|------|------|
| 1 | Baseline | 2223 ms |
| 2 | With Cache | 1090 ms |

**Result: 51% faster TTFT**

Server-side metrics showed consistent cache key generation and TTFT dropping from 377ms to 337ms on subsequent cached requests.

## Supported Providers

- OpenAI (via promptCacheKey)
- Anthropic (via cacheControl markers)
- AWS Bedrock (via cachePoint)
- Google Gemini (implicit caching)
- OpenAI-compatible APIs

## Options

| Option | Default | Description |
|--------|---------|-------------|
| select | system-head | Which prefix to cache. Options: system-head, tools+system, or a custom function |
| extraKeySalt | undefined | Additional data to include in cache key (useful for RAG chunk IDs) |
| onCacheResult | undefined | Callback with cache report after request completes |
| debug | false | Enable debug logging |

## Response Caching

For full response caching with streaming replay:

```ts
import { withPromptCache, withResponseCache, MemoryStore } from '@krishgupta/ai-prompt-cache';

const store = new MemoryStore({ maxSize: 1000 });

const model = wrapLanguageModel({
  model: openai('gpt-4o'),
  middleware: [
    withPromptCache({ select: 'system-head' }),
    withResponseCache({ store, ttlSeconds: 3600 }),
  ],
});
```

## Cache Stores

Built-in stores:

```ts
// In-memory LRU cache
import { MemoryStore } from '@krishgupta/ai-prompt-cache';
const store = new MemoryStore({ maxSize: 1000 });

// File-based cache (for development)
import { FileStore } from '@krishgupta/ai-prompt-cache';
const store = new FileStore({ directory: '.cache' });
```

Custom stores need to implement:

```ts
interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
}
```

## How It Works

The middleware generates a stable SHA-256 hash of the cacheable prefix (system prompt by default) and passes it to the provider:

- OpenAI: Sets promptCacheKey in provider options
- Anthropic: Adds cacheControl markers to messages
- Bedrock: Inserts cachePoint for Claude models

OpenAI caches prompts with 1024+ tokens and reuses them in 128-token increments. Anthropic requires similar minimum thresholds depending on the model.

## Provider Requirements

| Provider | Minimum Tokens |
|----------|----------------|
| OpenAI | 1024 |
| Anthropic Claude Sonnet | 1024 |
| Anthropic Claude Haiku | 2048 |

## License

MIT
