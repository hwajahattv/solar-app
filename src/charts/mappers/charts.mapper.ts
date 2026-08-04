import type {
  ShineChartFieldRow,
  ShineChartFieldsDatPayload,
  ShineChartSample,
  ShineChartSeriesRow,
} from '../../shine/shine.types';
import type {
  ChartFieldDto,
  ChartPointDto,
  ChartSeriesDto,
} from '../dto/charts.dto';

const KNOWN_GROUPS = new Set(['V', 'A', 'KW', 'KWH', '%', 'HZ', 'W', 'WH']);

export function normalizeUnitGroup(unit: string): string {
  const trimmed = unit.trim();
  if (!trimmed) return 'other';

  const upper = trimmed.toUpperCase();
  if (upper === '%' || trimmed === '%') return '%';
  if (KNOWN_GROUPS.has(upper)) {
    if (upper === 'KW') return 'kW';
    if (upper === 'KWH') return 'kWh';
    if (upper === 'HZ') return 'Hz';
    if (upper === 'W') return 'W';
    if (upper === 'WH') return 'Wh';
    return upper === 'V' || upper === 'A' ? upper : trimmed;
  }
  return trimmed;
}

export function mapChartFields(rows: ShineChartFieldRow[] | undefined): ChartFieldDto[] {
  if (!Array.isArray(rows)) return [];

  const seen = new Set<string>();
  const fields: ChartFieldDto[] = [];

  for (const row of rows) {
    const id = row.e0?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const unit = (row.e3 ?? '').trim();
    fields.push({
      id,
      title: (row.e1 ?? id).trim() || id,
      unit,
      group: normalizeUnitGroup(unit),
    });
  }

  return fields.sort((a, b) => a.group.localeCompare(b.group) || a.title.localeCompare(b.title));
}

export function mapChartSeries(
  payload: ShineChartFieldsDatPayload | undefined,
  catalogById: Map<string, ChartFieldDto>,
  requestedIds: string[],
): ChartSeriesDto[] {
  const rows = payload?.date ?? [];
  const byPar = new Map<string, ShineChartSeriesRow>();
  for (const row of rows) {
    const id = row.par?.trim();
    if (!id) continue;
    // First occurrence wins if upstream duplicates a par.
    if (!byPar.has(id)) byPar.set(id, row);
  }

  return requestedIds.map((id) => {
    const meta = catalogById.get(id);
    const row = byPar.get(id);
    return {
      id,
      title: meta?.title ?? id,
      unit: meta?.unit ?? '',
      points: mapPoints(row?.paramter),
    };
  });
}

export interface ChartPointWithPadFlag extends ChartPointDto {
  /** True when upstream used a 1-decimal zero like "0.0" (typical day-padding). */
  paddedZero: boolean;
}

function mapPoints(samples: ShineChartSample[] | undefined): ChartPointDto[] {
  if (!Array.isArray(samples) || samples.length === 0) return [];

  const points: ChartPointWithPadFlag[] = [];
  for (const sample of samples) {
    const t = sample.key?.trim();
    if (!t) continue;
    const raw = sample.val;
    points.push({
      t,
      v: parseSampleValue(raw),
      paddedZero: isPaddedZeroRaw(raw),
    });
  }

  points.sort((a, b) => a.t.localeCompare(b.t));
  return stripTrailingPaddedZeros(points).map(({ t, v }) => ({ t, v }));
}

function parseSampleValue(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw).trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * DatNew often pads the remainder of a day with `"0.0"` (1 decimal) after the
 * last real sample (typically 4 decimals). Drop that trailing padded tail.
 */
export function stripTrailingPaddedZeros(
  points: ChartPointWithPadFlag[],
): ChartPointWithPadFlag[] {
  if (points.length === 0) return points;

  let end = points.length;
  while (end > 0 && points[end - 1]!.paddedZero) {
    end -= 1;
  }

  if (end === 0) return points;
  return points.slice(0, end);
}

function isPaddedZeroRaw(raw: string | number | null | undefined): boolean {
  if (raw === null || raw === undefined) return false;
  const text = String(raw).trim();
  return /^0\.0$/.test(text);
}
