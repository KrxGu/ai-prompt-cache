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
  const [userMessage, setUserMessage] = useState('What is prompt caching and why is it useful?');
  const [useCache, setUseCache] = useState(true);

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
        parts: [{ type: 'text', text: userMessage }],
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
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: 8 }}>Prompt Cache Demo</h1>
      <p style={{ maxWidth: 640, lineHeight: 1.5, color: '#555', fontSize: 14 }}>
        Type your message below and compare baseline vs cached calls.
        The system uses a large system prompt (~1200 lines) to demonstrate caching.
        Watch the measured TTFT drop once the cache is hot.
      </p>

      <section style={{ marginTop: 20, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 14 }}>
          Provider:
          <select
            value={provider}
            disabled={loading}
            onChange={(event) => setProvider(event.target.value as Provider)}
            style={{ padding: '6px 10px', marginLeft: 8, borderRadius: 4, border: '1px solid #ccc' }}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={useCache}
            onChange={(e) => setUseCache(e.target.checked)}
            disabled={loading}
          />
          Enable Cache
        </label>
      </section>

      <section style={{ marginTop: 16 }}>
        <textarea
          value={userMessage}
          onChange={(e) => setUserMessage(e.target.value)}
          disabled={loading}
          placeholder="Type your message here..."
          style={{
            width: '100%',
            minHeight: 80,
            padding: 12,
            borderRadius: 6,
            border: '1px solid #ccc',
            fontSize: 14,
            fontFamily: 'inherit',
            resize: 'vertical',
          }}
        />
      </section>

      <section style={{ marginTop: 12, display: 'flex', gap: 12 }}>
        <button
          type="button"
          disabled={loading || !userMessage.trim()}
          onClick={() => call(useCache ? 'chat-cache' : 'chat')}
          style={{
            padding: '10px 20px',
            borderRadius: 6,
            border: 'none',
            background: useCache ? '#10b981' : '#6366f1',
            color: 'white',
            cursor: loading ? 'wait' : 'pointer',
            fontWeight: 500,
            fontSize: 14,
          }}
        >
          {loading ? 'Sending...' : (useCache ? 'Send (With Cache)' : 'Send (Baseline)')}
        </button>
      </section>

      <section style={{ marginTop: 20, display: 'flex', gap: 32, fontSize: 14 }}>
        <div>
          <strong>Status:</strong>{' '}
          <span style={{ color: loading ? '#d97706' : '#059669' }}>
            {loading ? 'Streaming...' : 'Idle'}
          </span>
        </div>
        <div>
          <strong>TTFT:</strong>{' '}
          <span style={{ 
            fontWeight: 600, 
            color: ttft && ttft < 1500 ? '#059669' : ttft ? '#d97706' : '#666' 
          }}>
            {ttft !== null ? `${ttft.toFixed(0)} ms` : '—'}
          </span>
        </div>
      </section>

      <pre
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 6,
          background: '#1e293b',
          color: '#e2e8f0',
          whiteSpace: 'pre-wrap',
          minHeight: 180,
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {text || 'Response will appear here.'}
      </pre>

      <p style={{ marginTop: 12, fontSize: 12, color: '#888' }}>
        Tip: Send the same message multiple times to see cache improvements. 
        First request warms the cache, subsequent requests are faster.
      </p>
    </main>
  );
}

function largeSystemPrefix(): string {
  return Array.from({ length: 1200 }, (_, index) => {
    return `Guideline ${index + 1}: Respond concisely while retaining key facts.`;
  }).join('\n');
}
