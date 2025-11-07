import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from 'ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type Provider = 'openai' | 'anthropic';

export async function POST(request: Request): Promise<Response> {
  const { messages, provider = 'openai' } = (await request.json()) as {
    messages: UIMessage[];
    provider?: Provider;
  };

  const model =
    provider === 'openai'
      ? openai('gpt-4o')
      : anthropic('claude-3-5-sonnet-latest');

  console.log('[BASELINE] Calling streamText with converted messages...');
  
  const result = streamText({
    model,
    messages: convertToModelMessages(messages),
    onError: (error) => {
      console.error('[BASELINE ERROR]', error);
    },
  });

  console.log('[BASELINE] streamText returned');

  // Return text stream response
  return result.toTextStreamResponse();
}
