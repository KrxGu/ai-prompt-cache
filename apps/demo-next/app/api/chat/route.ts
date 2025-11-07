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

  console.log('[BASELINE] Calling streamText...');
  
  const result = streamText({
    model,
    messages: convertToModelMessages(messages),
  });

  console.log('[BASELINE] streamText returned');
  console.log('[BASELINE] Result type:', typeof result);
  console.log('[BASELINE] Has textStream:', 'textStream' in result);
  console.log('[BASELINE] textStream type:', typeof result.textStream);

  // Return the stream directly without wrapping
  return result.toTextStreamResponse();
}
