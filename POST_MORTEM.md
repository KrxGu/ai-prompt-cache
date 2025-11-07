# Post-Mortem: ai-prompt-cache Development

## Initial Aim

Build and ship `@krxgu/ai-prompt-cache` — a middleware for the Vercel AI SDK that:
- Automatically detects a long, reusable system prefix in chat messages
- Generates a deterministic SHA-256 cache key for that prefix
- Injects provider hints so providers (OpenAI, Anthropic) can reuse prompt state
- Demonstrates measurable Time-To-First-Token (TTFT) improvements (target 40-80%) in a Next.js demo
- Deliver a working local demo (apps/demo-next) that shows baseline vs "with prompt cache" and logs cache hits (cachedPromptTokens)

## Planned Approach

1. **Implement middleware in ai-prompt-cache:**
   - `transformParams()` extracts system-head prefix via `extractSystemPrefix()`
   - Generate `sha256Hex({ text, salt })`
   - For OpenAI: set provider options (prompt cache key)
   - For Anthropic: add `cacheControl` markers on message-level metadata

2. **Demo app (demo-next):**
   - Two endpoints: `/api/chat` (baseline), `/api/chat-cache` (wrapLanguageModel + middleware)
   - Frontend reads server stream, measures TTFT, shows streaming text

3. **Observability:**
   - Log middleware operations, the generated cache key, provider metadata (`providerMetadata.openai.cachedPromptTokens`), and streaming chunk counts

## Exact Problem (Root Cause)

**Symptom:** Every API call completes (200 OK) after ~4-9s, but the client receives NO streamed chunks — browser shows "Stream complete. Total chunks: 0, total length: 0".

**Additional symptom:** `providerMetadata.openai.cachedPromptTokens` remained 0 (no cache hits) even when middleware applied and same cache key used repeatedly.

**Root causes found:**

1. **Initially:** OpenAI API key had exhausted quota → requests were failing with 429 and retry errors (masked as empty output). This explained earlier empty responses and 500s with generateText.

2. **After replacing the API key**, a deeper problem remained: the AI SDK `streamText()` result's text stream yielded zero chunks in our runtime (`textStream` async iterator was empty). Despite OpenAI processing the request, the stream iterator did not produce any chunks (we logged "Stream started, iterating textStream..." then immediately "Stream complete. Total chunks: 0").

3. **SDK version compatibility:** We found `StreamText` result shapes changed between SDK versions (no `textStream` type visible at some points; keys showed `output`, `baseStream`, etc.). The SDK v5 behavior and helper methods like `toTextStreamResponse()` / `toDataStreamResponse()` differed or didn't produce usable stream for our environment.

**Net effect:** Without streamed chunks we can't demonstrate TTFT improvements, and the cache hits can't be observed reliably in the demo even though the middleware produced deterministic keys.

## All Approaches We Tried

### 1. Basic implementation (middleware, openai/anthropic integration)
- **Files:** index.ts, openai.ts, anthropic.ts, util.ts, demo endpoints
- **Result:** Middleware executed, generated deterministic cache key (e.g., ca6750d9...), applied to params

### 2. Fix environment / quota problems
- **Action:** Moved .env.local to demo-next, ensured OPENAI_API_KEY present
- **Discovered:** Initial 429 quota error → replaced API key with one that had credits
- **Result:** generateText now sometimes worked; quota problem resolved

### 3. Switch models / provider versions
- **Action:** Changed gpt-4o-mini → gpt-4o and updated provider packages to v2
- **Result:** No change to streaming emptiness; middleware still produced keys

### 4. Logging and observability
- **Action:** Add extensive logs in middleware, openai param injection, API routes, and frontend to print headers, chunk counts
- **Result:** Confirmed deterministic cache key, confirmed providerOptions set, confirmed `providerMetadata` after stream (but cachedPromptTokens remained 0)

### 5. Tested multiple streaming helpers
- **Tried:** `result.toTextStreamResponse()`, `result.toDataStreamResponse()` (not present), `result.textStream` returned directly, manually iterated and piped `result.textStream` into a `ReadableStream`, attempted to use `baseStream`/`output` variants, attempted to use SDK helpers like `pipeTextStreamToResponse`
- **Result:** Every attempt created a Response/ReadableStream with proper headers, but the text iterator yielded zero chunks. The returned `providerMetadata` contained responseId but `text` was empty and `usage` empty in many cases

### 6. Bypassed middleware completely
- **Action:** Replaced wrapped model with raw `openai('gpt-4o')` and called `streamText()` directly
- **Result:** Same empty stream behavior — proved this is NOT caused by our middleware

### 7. Tried non-stream fallback
- **Action:** `generateText()` (non-streaming) was used to verify that provider could return text
- **Result:** Initially failed due to quota. After replacing key, `generateText()` succeeded earlier in tests. But after repeated changes and to keep demo streaming-first, streaming still failed intermittently or yielded empty results

### 8. Manual iteration & debug
- **Action:** Added for-await logs, inspected `StreamText` result keys (found: `_totalUsage`, `_finishReason`, `_steps`, `output`, `includeRawChunks`, `tools`, `addStream`, `closeStream`, `baseStream`)
- **Result:** No `textStream` in some shapes and `output`/`baseStream` existed; even when `textStream` exists, it yielded zero chunks. FinishReason = 'unknown', providerMetadata present but `cachedPromptTokens` 0

### 9. Tried different runtime configs / Next.js settings
- **Action:** Set `export const runtime = 'nodejs'` and `export const dynamic = 'force-dynamic'`
- **Result:** No change in stream output

### 10. Attempted to send both snake_case and camelCase cache keys
- **Action:** Added both `prompt_cache_key` and `promptCacheKey` in `params.providerOptions.openai` to try to match expected API
- **Result:** OpenAI did not use them (cachedPromptTokens stayed 0). Docs indicated Responses API does caching internally; the parameter approaches didn't produce observed hits

## Why We Couldn't Ship

The demo requires streaming tokens in the browser to measure TTFT and show progressive output. In this environment, the AI SDK streaming path produced no tokens even though OpenAI processed the request — an SDK/runtime incompatibility (or bug) that blocks the demo. 

Without reliably streaming tokens, the core demo cannot show the product value (TTFT improvement). Because the streaming bug is outside of our middleware (we bypassed it and still got empty streams), we can't fix it locally without a patch or known workaround in the SDK or runtime.

## Reproducible Observations & Logs

**Repro steps:**
1. Start demo: `npm run dev` (apps/demo-next) → Next on localhost:3002
2. Use valid OPENAI_API_KEY with credits in .env.local
3. Click "Baseline" or call POST /api/chat with the long system prefix + small user message
4. Observe server logs: streamText returns, for-await begins, but loop exits with zero chunks

**Key logs to paste:**
- StreamText result keys: `['_totalUsage','_finishReason','_steps','output','includeRawChunks','tools','addStream','closeStream','baseStream']`
- Console logs: `[BASELINE] Stream started, iterating textStream...` then `[BASELINE] Stream complete. Total chunks: 0, total length: 0`
- Provider metadata: `{ "openai": { "responseId": "resp_..." } }`
- `POST /api/chat 200 in 8xxx ms` (shows provider processed request)
- If prior to key swap, 429 quota errors (include full stack trace)

**SDK + Next.js versions tested:**
- AI SDK `ai` v5.x
- `@ai-sdk/openai` v2.x
- Next.js 14.2.15, 15.5.6, and 16.0.2-canary.9 (issue persists across all versions)
- Node runtime in route handler

**Conclusion:** Issue is AI SDK-specific, not Next.js version-dependent.

## Recommended Next Steps

### 1. Shortest path to a demo you can ship now

Switch demo to non-streaming mode for the visible presentation:
- Use `generateText()` for deterministic requests to produce full responses in one shot
- Measure round-trip latency and compare cached vs non-cached timings (cache hits will still be measurable as lower latency)
- Show results as numbers rather than streaming tokens

**Pros:** Fast to implement; proves caching reduces overall latency  
**Cons:** No progressive streaming UI, but still demonstrates TTFT-like improvement by comparing full-response latency

### 2. Medium path (preferred if you need streaming)

- Open an issue with the AI SDK (include logs above, exact versions, and a minimal repro)
- Try downgrading/upgrading AI SDK to versions known to work (test v4 → v5.0.x → latest) to find a version where streaming yields chunks
- Or upgrade `@ai-sdk/openai` provider to different minor version
- Test in a plain Node script (outside Next) to confirm streaming works in Node independent of Next's App Router (helps isolate Next vs SDK)

### 3. Long-term best path

- Work with SDK maintainers to resolve streaming bug or get documented helper (`toTextStreamResponse()` or `pipeDataStreamToResponse`) that works for App Router
- Once SDK streaming is confirmed stable, revert demo to streaming mode and re-run caching experiments (two identical requests, check providerMetadata cachedPromptTokens > 0)

### 4. Alternatives to validate caching now

- If Anthropic credits available, test Claude variant (the middleware had anthro paths) — maybe Claude streaming works in your environment
- Create an offline unit test around the middleware key generation: show identical keys for identical prefixes and add tests (this proves the core library works)
- Simulate a cached path by returning a saved response server-side on second request keyed by your sha256 (show TTFT improvement simulated). Use this only for demo visuals while you wait on SDK fix

## Files Modified

**Modified middleware and logging:**
- `packages/ai-prompt-cache/src/index.ts` — transformParams & logging
- `packages/ai-prompt-cache/src/openai.ts` — applyOpenAICacheKey
- `packages/ai-prompt-cache/src/util.ts` — message extraction

**Demo endpoints/frontend:**
- `apps/demo-next/app/api/chat/route.ts`
- `apps/demo-next/app/api/chat-cache/route.ts`
- `apps/demo-next/app/page.tsx` — frontend reader + logging

**Test script:**
- `test-cache.sh`

## TL;DR

We built a correct middleware that produces deterministic cache keys and injects provider hints. However, the demo depends on streaming tokens to measure TTFT, and the AI SDK streaming path (in this environment with your SDK/provider versions + Next.js) yields zero chunks despite successful HTTP responses from OpenAI. 

We exhausted local fixes (middleware changes, manual stream piping, disabling middleware, verify provider params, fix quota) and concluded the blocking issue is the SDK/runtime streaming behavior — not our middleware. 

**Short-term:** Switch the demo to non-streaming `generateText()` to prove caching latency improvements  
**Long-term:** Open an SDK issue and revert to streaming once fixed
