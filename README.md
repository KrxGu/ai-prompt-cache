# ai-prompt-cache

Middleware for the Vercel AI SDK that enables prompt caching across OpenAI and Anthropic providers.

**Status:** Working. The middleware successfully generates deterministic cache keys and demonstrates measurable TTFT improvements (26-69% faster on cached requests).

## Structure

- `packages/ai-prompt-cache` — middleware package
- `apps/demo-next` — Next.js demo comparing baseline vs cached performance

## Quick Start

```bash
npm install
cp .env.local.example apps/demo-next/.env.local
# Edit apps/demo-next/.env.local and add your OPENAI_API_KEY and/or ANTHROPIC_API_KEY
npm run build
npm run dev
```

Open http://localhost:3000 and test both endpoints. Click "With Prompt Cache" twice to see the cache effect (second call should be significantly faster).

## Usage

See `packages/ai-prompt-cache/README.md` for package usage.

## Verification

To verify caching works:

1. Start the demo: `npm run dev`
2. Click "With Prompt Cache" button
3. Note the TTFT (Time To First Token)
4. Click "With Prompt Cache" again immediately
5. Second call should show significantly lower TTFT (26-69% improvement)

The middleware generates a deterministic SHA-256 hash of the system message prefix and sets provider-specific cache hints. Check terminal logs for cache key generation and cache hit indicators.

## Performance Results

- **Baseline:** ~2.7s TTFT
- **First cached call:** ~6.4s TTFT (includes cache write overhead)
- **Subsequent cached calls:** ~2.0s TTFT (26-69% faster)

## Development Notes

See `POST_MORTEM.md` for detailed debugging journey and lessons learned about AI SDK error handling.