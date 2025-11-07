# @krishgupta/ai-prompt-cache

A tiny middleware for the Vercel AI SDK that sets deterministic prompt cache hints across providers. It automatically:

- Generates a stable SHA-256 digest for the reusable system prefix.
- Sets `promptCacheKey` for OpenAI models.
- Marks Anthropic messages with the `cacheControl` metadata they expect.

## Usage

```ts
import { wrapLanguageModel } from 'ai';
import { openai } from '@ai-sdk/openai';
import { withPromptCache } from '@krishgupta/ai-prompt-cache';

const model = wrapLanguageModel({
  model: openai('gpt-4o-mini'),
  middleware: withPromptCache({
    select: 'system-head',
    openai: { enable: true },
    anthropic: { enable: false },
    extraKeySalt: 'my-app',
  }),
});
```

### Provider notes

- **OpenAI** caches prompts once you pass 1024 tokens and reuses the cache in 128 token increments. Setting `promptCacheKey` greatly improves hit rate.
- **Anthropic** caches when the pre-user messages include `cacheControl` markers and you exceed the model's minimum token requirements (e.g. 1024 tokens for Claude 3.5 Sonnet). This middleware sets the markers on the head system messages.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `select` | `'system-head'` | Which prefix of messages to hash. Supply a custom function to control the split. |
| `openai.enable` | `true` | Toggle the OpenAI integration. |
| `anthropic.enable` | `true` | Toggle the Anthropic integration. |
| `anthropic.ttl` | `undefined` | Optional TTL for Anthropic's ephemeral cache. |
| `extraKeySalt` | `undefined` | Extra data mixed into the hash (use RAG chunk IDs here). |

## Observability

Use Vercel AI Gateway dashboards to track TTFT improvements, cache reads, and write volume. OpenAI responses also expose `providerMetadata.openai.cachedPromptTokens` when the cache is being hit.
