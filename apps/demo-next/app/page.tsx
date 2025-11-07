'use client';

import { useState } from 'react';

type Provider = 'openai' | 'anthropic';

type Endpoint = 'chat' | 'chat-cache';

const decoder = new TextDecoder();

export default function Page(): JSX.Element {
  const [provider, setProvider] = useState<Provider>('openai');
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [ttft, setTtft] = useState<number | null>(null);

  async function call(endpoint: Endpoint) {
    setLoading(true);
    setText('');
    setTtft(null);

    const start = performance.now();
    const messages = [
      {
        id: 'system-0',
        role: 'system',
        parts: [{ type: 'text', text: largeSystemPrefix() }],
      },
      {
        id: 'user-0',
        role: 'user',
        parts: [{ type: 'text', text: 'Summarize the key themes in 5 bullets.' }],
      },
    ];

    try {
      console.log(`[Frontend] Calling ${endpoint} with ${provider}`);
      const response = await fetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, messages }),
      });

      console.log(`[Frontend] Response status: ${response.status}, ok: ${response.ok}`);
      console.log(`[Frontend] Response headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Frontend] Error response:`, errorText);
        setText(`Error: ${response.status} - ${errorText}`);
        setLoading(false);
        return;
      }

      if (!response.body) {
        console.error('[Frontend] No response body!');
        setText('No response body');
        setLoading(false);
        return;
      }

      console.log('[Frontend] Starting to read stream...');
      const reader = response.body.getReader();
      let isFirstChunk = true;
      let aggregate = '';
      let chunkCount = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log(`[Frontend] Stream done`);
            break;
          }

          if (value && value.length > 0) {
            chunkCount++;
            const chunk = decoder.decode(value, { stream: !done });
            console.log(`[Frontend] Chunk ${chunkCount}: ${value.length} bytes, decoded: "${chunk.substring(0, 100)}..."`);
            
            if (isFirstChunk) {
              const firstTokenTime = performance.now() - start;
              setTtft(firstTokenTime);
              console.log(`[Frontend] TTFT: ${firstTokenTime.toFixed(0)}ms`);
              isFirstChunk = false;
            }
            
            aggregate += chunk;
            setText(aggregate);
          }
        }
      } finally {
        reader.releaseLock();
      }
      
      console.log(`[Frontend] Stream complete. Total chunks: ${chunkCount}, total length: ${aggregate.length}`);
    } catch (error) {
      console.error('[Frontend] Exception:', error);
      setText(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Prompt Cache Demo</h1>
      <p style={{ maxWidth: 640, lineHeight: 1.5 }}>
        Warm up the model with a long system prompt, then compare baseline vs cached calls.
        Watch the measured time to first token (TTFT) drop once the cache is hot.
      </p>

      <section style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>
          Provider:&nbsp;
          <select
            value={provider}
            disabled={loading}
            onChange={(event) => setProvider(event.target.value as Provider)}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </label>

        <button
          type="button"
          disabled={loading}
          onClick={() => call('chat')}
        >
          Baseline
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => call('chat-cache')}
        >
          With Prompt Cache
        </button>
      </section>

      <section style={{ marginTop: 16 }}>
        <strong>Status:</strong>&nbsp;
        {loading ? 'Streaming response…' : 'Idle'}
      </section>

      <section style={{ marginTop: 8 }}>
        <strong>Measured TTFT:</strong>&nbsp;
        {ttft !== null ? `${ttft.toFixed(0)} ms` : '—'}
      </section>

      <pre
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 8,
          background: '#0f172a',
          color: '#e2e8f0',
          whiteSpace: 'pre-wrap',
          minHeight: 200,
        }}
      >
        {text || 'Run a request to see the streamed response.'}
      </pre>
    </main>
  );
}

function largeSystemPrefix(): string {
  return Array.from({ length: 1200 }, (_, index) => {
    return `Guideline ${index + 1}: Respond concisely while retaining key facts.`;
  }).join('\n');
}
