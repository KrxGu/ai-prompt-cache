import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  streamText,
  wrapLanguageModel,
  type UIMessage,
} from 'ai';
import { 
  withPromptCache, 
  withResponseCache, 
  MemoryStore,
  type CacheReport,
} from '@krishgupta/ai-prompt-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type Provider = 'openai' | 'anthropic';

// Shared response cache store (in production, use Redis or similar)
const responseStore = new MemoryStore({ maxSize: 100 });

export async function POST(request: Request): Promise<Response> {
  const { messages, provider = 'openai' } = (await request.json()) as {
    messages: UIMessage[];
    provider?: Provider;
  };

  console.log(`[RESPONSE-CACHE] Provider: ${provider}, Messages: ${messages.length}`);

  const baseModel =
    provider === 'openai'
      ? openai('gpt-4o')
      : anthropic('claude-3-5-sonnet-latest');

  // Use both prompt caching and response caching for maximum performance
  const model = wrapLanguageModel({
    model: baseModel,
    middleware: [
      // Layer 1: Prompt caching (reduces TTFT by 26-69%)
      withPromptCache({
        select: 'system-head',
        extraKeySalt: 'demo-v2',
        onCacheResult: (report: CacheReport) => {
          console.log(`[PROMPT-CACHE] ${report.hit ? '🎯 HIT' : '❌ MISS'} - ${report.cachedTokens || 0} tokens`);
        },
      }),
      // Layer 2: Response caching (instant replay for identical requests)
      withResponseCache({
        store: responseStore,
        extraKeySalt: 'demo-responses',
        onCacheResult: (report) => {
          if (report.hit) {
            console.log(`[RESPONSE-CACHE] 🎯 HIT! Replaying cached response`);
          } else {
            console.log(`[RESPONSE-CACHE] ❌ MISS - will cache response`);
          }
        },
      }),
    ],
  });

  console.log('[RESPONSE-CACHE] Middleware stack enabled...');

  const convertedMessages = convertToModelMessages(messages);

  try {
    const result = streamText({
      model,
      messages: convertedMessages,
      onError: (error) => {
        console.error('[RESPONSE-CACHE ERROR]', error);
      },
    });

    console.log('[RESPONSE-CACHE] Returning text stream...');

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('[RESPONSE-CACHE] ERROR in streamText:', error);
    throw error;
  }
}
