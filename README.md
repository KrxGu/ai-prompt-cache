# ai-prompt-cache

Middleware for the Vercel AI SDK that enables prompt caching across OpenAI and Anthropic providers.

**Note:** This package's middleware implementation is complete and working (generates deterministic cache keys, injects provider hints), but the demo currently cannot demonstrate streaming TTFT improvements due to an AI SDK streaming compatibility issue in our environment. See `POST_MORTEM.md` for full details and recommended paths forward.

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

Open http://localhost:3000 and test both endpoints. Click "With Prompt Cache" twice to see the cache effect (second call should be 40-80% faster).

## Usage

See `packages/ai-prompt-cache/README.md` for package usage.

## Verification

To verify caching works:

1. Start the demo: `npm run dev`
2. Click "With Prompt Cache" button
3. Note the TTFT (Time To First Token)
4. Click "With Prompt Cache" again immediately
5. Second call should show significantly lower TTFT

The middleware generates a deterministic SHA-256 hash of the system message prefix and sets provider-specific cache hints. Check terminal logs for cache key generation.

## Known Issues

The current demo has streaming issues in the AI SDK that prevent token delivery to the browser. See `POST_MORTEM.md` for a detailed diagnosis of the approaches tried and recommended paths forward.

