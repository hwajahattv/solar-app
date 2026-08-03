/**
 * ShineMonitor returns measurements as strings that sometimes carry a unit or
 * stray whitespace ("236.4 V"). These helpers make the mappers tolerant of that.
 */

import { toIsoDateInTimeZone } from './timezone';

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

/** Converts an upstream timestamp to ISO-8601 UTC using the configured zone. */
export function toIsoDate(value: unknown, timeZone: string): string | null {
  return toIsoDateInTimeZone(value, timeZone);
}

export function round(value: number | null, decimals: number): number | null {
  if (value === null) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
