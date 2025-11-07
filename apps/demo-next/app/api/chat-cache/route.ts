import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  streamText,
  wrapLanguageModel,
  type UIMessage,
  pipeTextStreamToResponse,
} from 'ai';
import { withPromptCache } from '@krishgupta/ai-prompt-cache';

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

  // Re-enable middleware now that we have a working API key
  const model = wrapLanguageModel({
    model: baseModel,
    middleware: withPromptCache({
      select: 'system-head',
      extraKeySalt: 'demo-v1',
      openai: { enable: provider === 'openai' },
      anthropic: { enable: provider === 'anthropic', ttl: '1h' },
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

    // Log cache hits after stream completes
    result.providerMetadata.then(meta => {
      const cachedTokens = (meta?.openai?.cachedPromptTokens as number) ?? 0;
      console.log(`[CACHE] cachedPromptTokens: ${cachedTokens}`);
      if (cachedTokens > 0) {
        console.log(`[CACHE] 🎯 CACHE HIT! ${cachedTokens} tokens served from cache`);
      } else {
        console.log(`[CACHE] CACHE MISS - writing to cache`);
      }
    }).catch(err => {
      console.error('[CACHE] Error reading providerMetadata:', err);
    });

    console.log('[CACHE] Returning text stream...');

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('[CACHE] ERROR in streamText:', error);
    throw error;
  }
}
