const WALL_CLOCK_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/;

interface WallClockParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Calendar day in `YYYY-MM-DD` for the configured zone (not the server clock). */
export function todayInTimeZone(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Converts ShineMonitor timestamps to ISO-8601 UTC.
 *
 * Epoch milliseconds are passed through unchanged. Datetime strings without a
 * zone (for example `2026-08-03 18:30:00`) are treated as wall-clock time in
 * `timeZone`, which matches how the legacy dashboard displayed readings in the
 * user's locale while Vercel would otherwise interpret them as UTC.
 */
export function toIsoDateInTimeZone(
  value: unknown,
  timeZone: string,
): string | null {
  if (value === null || value === undefined || value === '') return null;

  const raw = String(value).trim();
  const epoch = Number(raw);

  if (Number.isFinite(epoch) && raw.length >= 10 && !raw.includes('-')) {
    const date = new Date(epoch);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const wallClock = parseWallClock(raw);
  if (!wallClock) return null;

  const date = wallClockToUtc(wallClock, timeZone);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseWallClock(raw: string): WallClockParts | null {
  const match = raw.match(WALL_CLOCK_PATTERN);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
}

function wallClockToUtc(parts: WallClockParts, timeZone: string): Date {
  const desiredUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  let utcMs = desiredUtc;

  // Two passes are enough to stabilise around DST boundaries.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const shown = readWallClockInZone(new Date(utcMs), timeZone);
    const shownUtc = Date.UTC(
      shown.year,
      shown.month - 1,
      shown.day,
      shown.hour,
      shown.minute,
      shown.second,
    );
    utcMs += desiredUtc - shownUtc;
  }

  return new Date(utcMs);
}

function readWallClockInZone(instant: Date, timeZone: string): WallClockParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const lookup = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  );

  return {
    year: Number(lookup['year']),
    month: Number(lookup['month']),
    day: Number(lookup['day']),
    hour: Number(lookup['hour'] === '24' ? '0' : lookup['hour']),
    minute: Number(lookup['minute']),
    second: Number(lookup['second']),
  };
}
