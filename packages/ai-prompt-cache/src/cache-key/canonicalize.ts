/**
 * Canonicalization utilities for cache keys
 * Ensures consistent keys even with formatting differences
 */

type JsonLike = string | number | boolean | null | JsonLike[] | { [key: string]: JsonLike };

/**
 * Normalize whitespace in a string
 * - Trim leading/trailing whitespace
 * - Collapse multiple spaces/newlines into single space
 */
export function normalizeWhitespace(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Stable JSON serialization with sorted keys
 * Ensures identical objects produce identical strings
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(stableSort(value));
}

/**
 * Recursively sort object keys for stable serialization
 */
function stableSort(value: unknown): JsonLike {
  if (Array.isArray(value)) {
    return value.map(stableSort) as JsonLike;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const result: Record<string, JsonLike> = {};
    for (const [key, val] of entries) {
      result[key] = stableSort(val);
    }
    return result;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  ) {
    return value;
  }

  return String(value);
}

/**
 * Extract text content from messages in a normalized form
 */
export function extractNormalizedText(messages: any[]): string {
  const parts: string[] = [];

  for (const message of messages) {
    const content = message.content;
    
    if (typeof content === 'string') {
      parts.push(normalizeWhitespace(content));
      continue;
    }

    if (Array.isArray(content)) {
      for (const chunk of content) {
        if (chunk && typeof chunk === 'object') {
          if (chunk.type === 'text' && typeof chunk.text === 'string') {
            parts.push(normalizeWhitespace(chunk.text));
          } else if (chunk.type === 'image') {
            // For images, include a hash of the image data/URL for consistency
            const imageId = chunk.image?.url || chunk.image?.data || 'image';
            parts.push(`[image:${typeof imageId === 'string' ? imageId.slice(0, 32) : 'data'}]`);
          }
        }
      }
    }
  }

  return parts.join('\n');
}

/**
 * Canonicalize tool definitions for consistent hashing
 */
export function canonicalizeTools(tools: unknown): string {
  if (!tools) return '';
  return stableStringify(tools);
}
