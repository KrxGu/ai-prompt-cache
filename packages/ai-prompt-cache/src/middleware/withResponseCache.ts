/**
 * Response cache middleware
 * Caches full responses with optional streaming replay
 */

import type { LanguageModelMiddleware } from 'ai';
import type { ResponseCacheOptions, CacheReport, CacheStore } from '../types.js';
import { createCacheKey } from '../cache-key/index.js';

/**
 * In-flight request tracking for coalescing
 */
const inflightRequests = new Map<string, Promise<any>>();

/**
 * Create response cache middleware
 */
export function withResponseCache(
  options: ResponseCacheOptions,
): LanguageModelMiddleware {
  const {
    store,
    extraKeySalt,
    ttlSeconds = 3600,
    coalesceInflight = false,
    keyGenerator,
    telemetry,
    onCacheResult,
    debug = false,
  } = options;

  return {
    wrapGenerate: async ({ doGenerate, params }: any) => {
      const startTime = Date.now();
      const cacheKey = getCacheKey(params, keyGenerator, extraKeySalt);

      if (debug) {
        console.log(`[withResponseCache] Checking cache for key: ${cacheKey.substring(0, 16)}...`);
      }

      // Check cache
      const cached = await store.get(cacheKey);
      if (cached) {
        if (debug) {
          console.log('[withResponseCache] Cache HIT');
        }

        const result = JSON.parse(cached);
        
        // Call onCacheResult callback
        if (onCacheResult) {
          onCacheResult({
            hit: true,
            cacheKey,
            source: 'response-cache',
          });
        }
        
        // Call telemetry
        if (telemetry?.onFinish) {
          telemetry.onFinish({
            cacheKey,
            cacheReport: {
              provider: 'response-cache',
              eligible: true,
              cacheKey,
              hit: true,
              duration: Date.now() - startTime,
              source: 'response-cache',
            },
            duration: Date.now() - startTime,
          });
        }

        return result;
      }

      if (debug) {
        console.log('[withResponseCache] Cache MISS');
      }
      
      // Call onCacheResult callback for miss
      if (onCacheResult) {
        onCacheResult({
          hit: false,
          cacheKey,
          source: 'upstream',
        });
      }

      // Handle in-flight coalescing
      if (coalesceInflight && inflightRequests.has(cacheKey)) {
        if (debug) {
          console.log('[withResponseCache] Waiting for in-flight request');
        }
        return inflightRequests.get(cacheKey);
      }

      // Make the request
      const requestPromise = (async () => {
        try {
          const result = await doGenerate();

          // Cache the result
          const cacheValue = JSON.stringify({
            text: result.text,
            usage: result.usage,
            finishReason: result.finishReason,
            providerMetadata: result.providerMetadata,
          });
          await store.set(cacheKey, cacheValue, ttlSeconds);

          if (debug) {
            console.log('[withResponseCache] Cached response');
          }

          // Call telemetry
          if (telemetry?.onFinish) {
            telemetry.onFinish({
              cacheKey,
              cacheReport: {
                provider: 'response-cache',
                eligible: true,
                cacheKey,
                hit: false,
                duration: Date.now() - startTime,
                source: 'upstream',
              },
              duration: Date.now() - startTime,
            });
          }

          return result;
        } finally {
          inflightRequests.delete(cacheKey);
        }
      })();

      if (coalesceInflight) {
        inflightRequests.set(cacheKey, requestPromise);
      }

      return requestPromise;
    },

    wrapStream: async ({ doStream, params }: any) => {
      const startTime = Date.now();
      const cacheKey = getCacheKey(params, keyGenerator, extraKeySalt);

      if (debug) {
        console.log(`[withResponseCache] Checking stream cache for key: ${cacheKey.substring(0, 16)}...`);
      }

      // Check cache for stored stream chunks
      const cached = await store.get(`stream:${cacheKey}`);
      if (cached) {
        if (debug) {
          console.log('[withResponseCache] Stream cache HIT - replaying');
        }

        const chunks = JSON.parse(cached);
        
        // Create a simulated stream from cached chunks
        const replayStream = createReplayStream(chunks);

        // Call onCacheResult callback
        if (onCacheResult) {
          onCacheResult({
            hit: true,
            cacheKey,
            source: 'response-cache',
          });
        }

        // Call telemetry
        if (telemetry?.onFinish) {
          telemetry.onFinish({
            cacheKey,
            cacheReport: {
              provider: 'response-cache',
              eligible: true,
              cacheKey,
              hit: true,
              duration: Date.now() - startTime,
              source: 'response-cache',
            },
            duration: Date.now() - startTime,
          });
        }

        return {
          stream: replayStream,
          rawCall: { rawPrompt: params.prompt, rawSettings: {} },
        };
      }

      if (debug) {
        console.log('[withResponseCache] Stream cache MISS');
      }

      // Call onCacheResult callback for miss
      if (onCacheResult) {
        onCacheResult({
          hit: false,
          cacheKey,
          source: 'upstream',
        });
      }

      // Handle in-flight coalescing for streams
      // Note: Stream coalescing is more complex - we'd need to tee the stream
      // For now, we skip coalescing for streams

      // Make the request
      const result = await doStream();

      // Capture and cache stream chunks
      const chunks: any[] = [];
      const originalStream = result.stream;

      const captureStream = new TransformStream({
        transform(chunk, controller) {
          chunks.push(chunk);
          controller.enqueue(chunk);
        },
        async flush() {
          // Cache the chunks for replay
          try {
            await store.set(`stream:${cacheKey}`, JSON.stringify(chunks), ttlSeconds);
            if (debug) {
              console.log(`[withResponseCache] Cached ${chunks.length} stream chunks`);
            }
          } catch (err) {
            if (debug) {
              console.error('[withResponseCache] Failed to cache stream:', err);
            }
          }

          // Call telemetry
          if (telemetry?.onFinish) {
            telemetry.onFinish({
              cacheKey,
              cacheReport: {
                provider: 'response-cache',
                eligible: true,
                cacheKey,
                hit: false,
                duration: Date.now() - startTime,
                source: 'upstream',
              },
              duration: Date.now() - startTime,
            });
          }
        },
      });

      return {
        ...result,
        stream: originalStream.pipeThrough(captureStream),
      };
    },
  };
}

/**
 * Generate cache key for request
 */
function getCacheKey(
  params: any,
  keyGenerator?: (params: any) => string,
  extraKeySalt?: string,
): string {
  if (keyGenerator) {
    return keyGenerator(params);
  }

  // Use the same key generation as prompt cache
  const result = createCacheKey({
    messages: params.prompt || [],
    tools: params.tools,
    modelId: params.modelId,
    salt: extraKeySalt ? `response-cache:${extraKeySalt}` : 'response-cache',
  });

  return result.key;
}

/**
 * Create a replay stream from cached chunks
 * Uses a simple async generator pattern
 */
function createReplayStream(chunks: any[]): ReadableStream {
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index]);
        index++;
      } else {
        controller.close();
      }
    },
  });
}
