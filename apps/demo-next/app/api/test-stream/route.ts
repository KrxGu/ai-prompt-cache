// Simple test endpoint to verify streaming works
export const runtime = 'nodejs';

export async function POST(): Promise<Response> {
  console.log('[TEST] Creating test stream...');
  
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      console.log('[TEST] Stream started');
      
      // Send some test data
      for (let i = 0; i < 5; i++) {
        const text = `Chunk ${i}\n`;
        console.log('[TEST] Sending:', text);
        controller.enqueue(encoder.encode(text));
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log('[TEST] Stream closing');
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
