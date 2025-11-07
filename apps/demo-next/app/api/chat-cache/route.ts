import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  streamText,
  wrapLanguageModel,
  type UIMessage,
  pipeTextStreamToResponse,
} from 'ai';
import { withPromptCache } from '@krxgu/ai-prompt-cache';

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

  // TEMPORARILY BYPASS MIDDLEWARE FOR TESTING
  const model = baseModel;
  
  /*
  const model = wrapLanguageModel({
    model: baseModel,
    middleware: withPromptCache({
      select: 'system-head',
      extraKeySalt: 'demo-v1',
      openai: { enable: false },  // Disable for now - OpenAI caches automatically
      anthropic: { enable: provider === 'anthropic', ttl: '1h' },
    }),
  });
  */

  console.log('[CACHE] Middleware BYPASSED, calling streamText directly...');

  const convertedMessages = convertToModelMessages(messages);
  console.log('[CACHE] Converted messages:', JSON.stringify(convertedMessages.map(m => ({
    role: m.role,
    contentLength: typeof m.content === 'string' ? m.content.length : m.content?.length || 0,
    contentType: typeof m.content,
    contentPreview: typeof m.content === 'string' ? m.content.substring(0, 50) : JSON.stringify(m.content).substring(0, 100)
  })), null, 2));

  try {
    const result = streamText({
      model,
      messages: convertedMessages,
    });

    console.log('[CACHE] StreamText result keys:', Object.keys(result));

    // Log cache hits after stream completes
    result.providerMetadata.then(meta => {
      console.log('[CACHE] Full providerMetadata:', JSON.stringify(meta, null, 2));
      const cachedTokens = (meta?.openai?.cachedPromptTokens as number) ?? 0;
      console.log(`[CACHE] ✅ cachedPromptTokens: ${cachedTokens}`);
      if (cachedTokens > 0) {
        console.log(`[CACHE] 🎯 CACHE HIT! ${cachedTokens} tokens served from cache`);
      } else {
        console.log(`[CACHE] ❌ CACHE MISS - writing to cache`);
      }
    }).catch(err => {
      console.error('[CACHE] Error reading providerMetadata:', err);
    });

    // Log when text is generated
    result.text.then(text => {
      console.log(`[CACHE] Final text generated: ${text.length} chars`);
      if (text.length === 0) {
        console.error('[CACHE] ⚠️ OpenAI returned EMPTY response!');
      } else {
        console.log(`[CACHE] Text preview: ${text.substring(0, 100)}...`);
      }
    }).catch(err => {
      console.error('[CACHE] Error generating text:', err);
    });

    // Also log finishReason and usage
    result.finishReason.then(reason => {
      console.log(`[CACHE] Finish reason: ${reason}`);
    }).catch(err => {
      console.error('[CACHE] Error getting finish reason:', err);
    });

    result.usage.then(usage => {
      console.log(`[CACHE] Usage:`, JSON.stringify(usage, null, 2));
    }).catch(err => {
      console.error('[CACHE] Error getting usage:', err);
    });

    console.log('[CACHE] Returning text stream...');

    // Manually pipe the textStream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const textPart of result.textStream) {
            controller.enqueue(encoder.encode(textPart));
          }
          controller.close();
        } catch (error) {
          console.error('[CACHE] Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[CACHE] ERROR in streamText:', error);
    throw error;
  }
}
