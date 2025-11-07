import { createHash } from 'node:crypto';

type JsonLike = string | number | boolean | null | JsonLike[] | { [key: string]: JsonLike };

function stable(value: unknown): JsonLike {
  if (Array.isArray(value)) {
    return value.map(stable) as JsonLike;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const result: Record<string, JsonLike> = {};
    for (const [key, val] of entries) {
      result[key] = stable(val);
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

export function sha256Hex(input: unknown): string {
  const serialized = JSON.stringify(stable(input));
  return createHash('sha256').update(serialized).digest('hex').slice(0, 32);
}
