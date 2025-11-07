export type CacheSelect =
  | 'system-head'
  | ((messages: any[]) => number);

export function extractSystemPrefix(
  messages: any[],
  selector: CacheSelect,
): { upto: number; text: string } {
  if (typeof selector === 'function') {
    const upto = clampIndex(selector(messages), messages.length);
    return { upto, text: joinText(messages.slice(0, upto)) };
  }

  let upto = 0;
  while (upto < messages.length && messages[upto].role === 'system') {
    upto += 1;
  }
  return { upto, text: joinText(messages.slice(0, upto)) };
}

function clampIndex(value: number, max: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > max) return max;
  return Math.floor(value);
}

function joinText(messages: any[]): string {
  const parts: string[] = [];
  for (const message of messages) {
    const content = message.content;
    if (typeof content === 'string') {
      parts.push(content);
      continue;
    }

    if (Array.isArray(content)) {
      for (const chunk of content) {
        if (chunk && typeof chunk === 'object' && chunk.type === 'text') {
          const text = chunk.text;
          if (typeof text === 'string') {
            parts.push(text);
          }
        }
      }
    }
  }
  return parts.join('\n');
}
