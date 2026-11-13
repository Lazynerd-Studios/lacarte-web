/**
 * Shared, defensive JSON parsing helpers ported from lib/utils/json_parse.dart.
 *
 * The LaCarte backend occasionally sends numbers as strings, omits optional
 * fields, or returns a single malformed row inside a list. These helpers
 * normalize such values instead of throwing, so one unexpected field never
 * blanks an entire screen.
 */

export function asStr(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  const s = String(value);
  return s === '' ? fallback : s;
}

export function asInt(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function asIntOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function asDouble(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function asDoubleOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

export function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return fallback;
  const s = String(value).toLowerCase().trim();
  if (s === 'true') return true;
  if (s === 'false') return false;
  return fallback;
}

export function asDate(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function asDateOr(value: unknown, fallback?: string): string {
  return asDate(value) ?? fallback ?? new Date(0).toISOString();
}

export function asMap(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function extractList(
  decoded: unknown,
  keys: string[] = ['data', 'tiers', 'items', 'bins'],
): unknown[] {
  if (Array.isArray(decoded)) return decoded;
  const map = asMap(decoded);
  if (map) {
    for (const key of keys) {
      if (Array.isArray(map[key])) {
        return map[key] as unknown[];
      }
    }
  }
  return [];
}

export function asList<T>(
  raw: unknown,
  parser: (json: Record<string, unknown>) => T,
  context?: string,
): T[] {
  if (!Array.isArray(raw)) return [];
  const label = context ? `asList:${context}` : 'asList';
  const result: T[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = asMap(raw[i]);
    if (!item) {
      console.warn(`[${label}] skipping non-object element at index ${i}`);
      continue;
    }
    try {
      result.push(parser(item));
    } catch (err) {
      console.warn(`[${label}] skipping malformed element at index ${i}:`, err);
    }
  }
  return result;
}

