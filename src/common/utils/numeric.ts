/**
 * ShineMonitor returns measurements as strings that sometimes carry a unit or
 * stray whitespace ("236.4 V"). These helpers make the mappers tolerant of that.
 */

/**
 * Safe stringification for values typed as `unknown`. Objects are serialised as
 * JSON rather than becoming "[object Object]", which would silently corrupt a
 * reading instead of failing visibly.
 */
export function stringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  )
    return String(value);

  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;

  const parsed = Number.parseFloat(stringify(value).replace(/[^0-9.-]/g, ''));
  return Number.isNaN(parsed) ? null : parsed;
}

export function toText(value: unknown): string {
  return stringify(value).trim();
}

/** Converts an upstream timestamp (epoch ms or "YYYY-MM-DD HH:mm:ss") to ISO-8601. */
export function toIsoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;

  const raw = stringify(value).trim();
  const epoch = Number(raw);
  const date =
    Number.isFinite(epoch) && raw.length >= 10 && !raw.includes('-')
      ? new Date(epoch)
      : new Date(raw.replace(' ', 'T'));

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function round(value: number | null, decimals: number): number | null {
  if (value === null) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
