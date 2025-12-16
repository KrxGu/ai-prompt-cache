import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  streamText,
  wrapLanguageModel,
  type UIMessage,
} from 'ai';
import { withPromptCache, type CacheReport } from '@krishgupta/ai-prompt-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type Provider = 'openai' | 'anthropic';

export async function POST(request: Request): Promise<Response> {
  const { messages, provider = 'openai' } = (await request.json()) as {
    messages: UIMessage[];
    provider?: Provider;
  };

  console.log(`[CACHE] Provider: ${provider}, Messages: ${messages.length}`);

  const baseModel =
    provider === 'openai'
      ? openai('gpt-4o')
      : anthropic('claude-3-5-sonnet-latest');

  // Use the new v0.2.0 API with observability hooks
  const model = wrapLanguageModel({
    model: baseModel,
    middleware: withPromptCache({
      select: 'system-head',
      extraKeySalt: 'demo-v1',
      
      // Observability hooks
      onEligibilityCheck: (result) => {
        console.log(`[CACHE] Eligibility: ${result.eligible ? 'ELIGIBLE' : 'INELIGIBLE'} (${result.reason})`);
        if (!result.eligible && result.tokensEstimated) {
          console.log(`[CACHE] Tokens estimated: ${result.tokensEstimated}, Threshold: ${result.threshold}`);
        }
      },
      onCacheResult: (report: CacheReport) => {
        if (report.hit) {
          console.log(`[CACHE] 🎯 HIT! ${report.cachedTokens} tokens from cache`);
        } else {
          console.log(`[CACHE] ❌ MISS - cache key: ${report.cacheKey}`);
        }
        console.log(`[CACHE] Provider: ${report.provider}, TTFT: ${report.ttft}ms`);
      },
    }),
  });

  console.log('[CACHE] Middleware enabled, calling streamText...');

  const convertedMessages = convertToModelMessages(messages);

  try {
    const result = streamText({
      model,
      messages: convertedMessages,
      onError: (error) => {
        console.error('[CACHE ERROR]', error);
      },
    });

    console.log('[CACHE] Returning text stream...');

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('[CACHE] ERROR in streamText:', error);
    throw error;
  }
}
