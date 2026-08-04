import type { ChartPointDto, ChartSeriesDto } from './dto/charts.dto';

export const FAULTY_UPSTREAM_ENERGY_FIELD_IDS = new Set([
  'energy_today',
  'energy_total',
]);

export interface CalculatedChartFieldDef {
  id: string;
  title: string;
  unit: string;
  group: string;
  /** Preferred power field ids (kW) summed at each timestamp. */
  sourcePowerFields: string[];
  /** Used when none of the preferred sources appear in the catalog. */
  fallbackPowerFields: string[];
}

/** Synthetic fields derived by integrating power over time. */
export const CALCULATED_CHART_FIELDS: CalculatedChartFieldDef[] = [
  {
    id: 'calc_pv_generation_kwh',
    title: 'PV Generation (calculated)',
    unit: 'kWh',
    group: 'kWh',
    sourcePowerFields: ['bt_output_power_1', 'bt_input_power_1'],
    fallbackPowerFields: ['output_power'],
  },
  {
    id: 'calc_load_consumption_kwh',
    title: 'Load Consumption (calculated)',
    unit: 'kWh',
    group: 'kWh',
    sourcePowerFields: ['bt_load_active_power_sole'],
    fallbackPowerFields: [],
  },
];

/** Shine `querySPDeviceKeyParameterOneDay` parameter for a calculated field. */
export function spParameterForCalculatedField(id: string): string | null {
  if (id === 'calc_pv_generation_kwh') return 'PV_OUTPUT_POWER';
  if (id === 'calc_load_consumption_kwh') return 'LOAD_ACTIVE_POWER';
  return null;
}

export function isCalculatedChartField(id: string): boolean {
  return CALCULATED_CHART_FIELDS.some((field) => field.id === id);
}

export function getCalculatedFieldDef(id: string): CalculatedChartFieldDef | undefined {
  return CALCULATED_CHART_FIELDS.find((field) => field.id === id);
}

/**
 * Resolve which upstream power fields to fetch for a calculated series,
 * preferring sources that exist in the device catalog.
 */
export function resolvePowerSourceIds(
  def: CalculatedChartFieldDef,
  catalogIds: Set<string>,
): string[] {
  const preferred = def.sourcePowerFields.filter((id) => catalogIds.has(id));
  if (preferred.length > 0) return preferred;
  const fallback = def.fallbackPowerFields.filter((id) => catalogIds.has(id));
  if (fallback.length > 0) return fallback;
  // Catalog missing/empty — still try the preferred ids against DatNew.
  return def.sourcePowerFields.length > 0
    ? def.sourcePowerFields
    : def.fallbackPowerFields;
}

/** Convert SP OneDay `{ ts, val }` samples into chart points. */
export function spSamplesToPoints(
  samples: Array<{ ts?: string; val?: string | number | null }> | undefined,
): ChartPointDto[] {
  if (!Array.isArray(samples) || samples.length === 0) return [];
  return samples
    .map((sample) => {
      const t = sample.ts?.trim();
      if (!t) return null;
      const raw = sample.val;
      if (raw === null || raw === undefined || raw === '') {
        return { t, v: null as number | null };
      }
      const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw).trim());
      return { t, v: Number.isFinite(n) ? n : null };
    })
    .filter((point): point is ChartPointDto => point !== null)
    .sort((a, b) => a.t.localeCompare(b.t));
}

/** Last finite numeric sample — useful for cumulative ENERGY_TODAY readings. */
export function lastFiniteValue(points: ChartPointDto[]): number | null {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const value = points[i]?.v;
    if (value !== null && value !== undefined && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

/** Normalize a power series to kW using the declared unit (with W/kW heuristic). */
export function normalizePowerSeriesToKw(series: ChartSeriesDto): ChartPointDto[] {
  const points = series.points;
  const scale = powerScaleToKw(series.unit, points);
  if (scale === 1) return points.slice();
  return points.map((point) => ({
    t: point.t,
    v: point.v === null ? null : point.v * scale,
  }));
}

/**
 * Chart catalog often labels power as kW while values look like watts (e.g. 900).
 * If the declared unit is kW but peaks exceed 50, treat samples as W.
 */
export function powerScaleToKw(unit: string, points: ChartPointDto[]): number {
  const normalized = unit.trim().toLowerCase();
  if (normalized === 'w') return 0.001;
  if (normalized === 'kw') {
    const peak = points.reduce((max, point) => Math.max(max, point.v ?? 0), 0);
    return peak > 50 ? 0.001 : 1;
  }
  // Unknown unit — assume kW if small, otherwise W.
  const peak = points.reduce((max, point) => Math.max(max, point.v ?? 0), 0);
  return peak > 50 ? 0.001 : 1;
}

/** Sum multiple power series on a shared timestamp grid (missing → 0), result in kW. */
export function sumPowerSeries(seriesList: ChartSeriesDto[]): ChartPointDto[] {
  if (seriesList.length === 0) return [];

  const normalized = seriesList.map((series) => ({
    ...series,
    points: normalizePowerSeriesToKw(series),
  }));

  if (normalized.length === 1) return normalized[0]!.points.slice();

  const timestamps = new Set<string>();
  for (const series of normalized) {
    for (const point of series.points) timestamps.add(point.t);
  }

  const maps = normalized.map((series) => {
    const map = new Map<string, number>();
    for (const point of series.points) {
      if (point.v !== null) map.set(point.t, point.v);
    }
    return map;
  });

  return [...timestamps]
    .sort((a, b) => a.localeCompare(b))
    .map((t) => ({
      t,
      v: maps.reduce((sum, map) => sum + (map.get(t) ?? 0), 0),
    }));
}

/**
 * Convert a power time series (kW) into a cumulative energy series (kWh)
 * using rectangular integration between consecutive samples.
 */
export function integratePowerKwToCumulativeKwh(
  powerPoints: ChartPointDto[],
): ChartPointDto[] {
  if (powerPoints.length === 0) return [];

  const sorted = [...powerPoints].sort((a, b) => a.t.localeCompare(b.t));
  const result: ChartPointDto[] = [];
  let cumulative = 0;

  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i]!;
    const powerKw = current.v ?? 0;

    if (i > 0) {
      const previous = sorted[i - 1]!;
      const dtHours = wallClockDeltaHours(previous.t, current.t);
      if (dtHours > 0 && dtHours < 6) {
        // Use average power across the interval (trapezoid) when both ends exist.
        const prevKw = previous.v ?? 0;
        cumulative += ((prevKw + powerKw) / 2) * dtHours;
      }
    }

    result.push({ t: current.t, v: roundKwh(cumulative) });
  }

  return result;
}

/** Total energy in kWh for a power series (last cumulative point). */
export function totalEnergyKwhFromPowerKw(powerPoints: ChartPointDto[]): number | null {
  const cumulative = integratePowerKwToCumulativeKwh(powerPoints);
  if (cumulative.length === 0) return null;
  return cumulative[cumulative.length - 1]!.v;
}

/**
 * Integrate battery electrical power (W) from voltage × current series into kWh.
 * `currentPoints` should already be signed positively for the direction of interest.
 */
export function totalEnergyKwhFromVoltageAndCurrent(
  voltagePoints: ChartPointDto[],
  currentPoints: ChartPointDto[],
): number | null {
  const vMap = new Map(
    voltagePoints.filter((p) => p.v !== null).map((p) => [p.t, p.v as number]),
  );
  const iMap = new Map(
    currentPoints.filter((p) => p.v !== null).map((p) => [p.t, p.v as number]),
  );

  if (iMap.size === 0 || vMap.size === 0) return null;

  const timestamps = [...new Set([...vMap.keys(), ...iMap.keys()])].sort((a, b) =>
    a.localeCompare(b),
  );

  let lastVoltage: number | undefined;
  const powerKwPoints: ChartPointDto[] = timestamps.map((t) => {
    const sampledVoltage = vMap.get(t);
    if (sampledVoltage !== undefined) lastVoltage = sampledVoltage;
    const current = iMap.get(t) ?? 0;
    if (lastVoltage === undefined) return { t, v: 0 };
    // W → kW
    return { t, v: (lastVoltage * Math.max(0, current)) / 1000 };
  });

  return totalEnergyKwhFromPowerKw(powerKwPoints);
}

function wallClockDeltaHours(from: string, to: string): number {
  const a = Date.parse(from.includes('T') ? from : from.replace(' ', 'T'));
  const b = Date.parse(to.includes('T') ? to : to.replace(' ', 'T'));
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return (b - a) / 3_600_000;
}

function roundKwh(value: number): number {
  return Math.round(value * 1000) / 1000;
}
