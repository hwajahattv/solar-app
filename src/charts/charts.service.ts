import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { todayInTimeZone } from '../common/utils/timezone';
import { deviceParams, DeviceRefDto } from '../common/dto/device-ref.dto';
import { DailyEnergyService } from '../daily-energy/daily-energy.service';
import type { DailyEnergyTotals } from '../daily-energy/daily-energy.types';
import { ShineApiService } from '../shine/shine-api.service';
import type {
  ShineChartFieldRow,
  ShineChartFieldsDatPayload,
  ShineKeyParameterOneDayPayload,
} from '../shine/shine.types';
import {
  ChartFieldDto,
  ChartFieldsResponseDto,
  ChartPointDto,
  ChartSeriesDto,
  ChartSeriesResponseDto,
} from './dto/charts.dto';
import {
  CALCULATED_CHART_FIELDS,
  FAULTY_UPSTREAM_ENERGY_FIELD_IDS,
  getCalculatedFieldDef,
  integratePowerKwToCumulativeKwh,
  isCalculatedChartField,
  resolvePowerSourceIds,
  spParameterForCalculatedField,
  spSamplesToPoints,
  sumPowerSeries,
  totalEnergyKwhFromPowerKw,
  totalEnergyKwhFromVoltageAndCurrent,
} from './energy-calc';
import { mapChartFields, mapChartSeries } from './mappers/charts.mapper';

/** Keep DatNew payloads small — large field lists trigger ERR_SYSTEM_EXCEPTION. */
const BATTERY_ENERGY_CHART_FIELDS = [
  'bt_battery_voltage',
  'bt_battery_charging_current',
  'bt_battery_discharge_current',
] as const;

const DAILY_ENERGY_CACHE_TTL_MS = 60_000;
/** Fallback when voltage series is missing (typical 48V LiFePO4 pack). */
const FALLBACK_BATTERY_VOLTAGE = 25.6;
/** Shine DatNew is unstable above ~2–3 fields; fetch in tiny batches. */
const DATNEW_FIELD_BATCH_SIZE = 2;

const MAX_FIELDS = 8;
const MAX_RANGE_MS = 7 * 24 * 60 * 60 * 1000;

export type { DailyEnergyTotals } from '../daily-energy/daily-energy.types';

export interface DailyEnergyComputeOptions {
  /** Calendar day YYYY-MM-DD; defaults to today in APP_TIMEZONE. */
  day?: string;
  /** Skip the in-memory cache (used by end-of-day cron snapshots). */
  bypassCache?: boolean;
}

@Injectable()
export class ChartsService {
  private readonly logger = new Logger(ChartsService.name);
  private readonly timeZone: string;
  private readonly dailyEnergyCache = new Map<
    string,
    { expiresAt: number; value: DailyEnergyTotals }
  >();

  constructor(
    private readonly shine: ShineApiService,
    private readonly dailyEnergy: DailyEnergyService,
    config: ConfigService,
  ) {
    this.timeZone = config.getOrThrow<string>('timezone');
  }

  async fields(device: DeviceRefDto, lang?: string): Promise<ChartFieldsResponseDto> {
    const upstream = await this.loadUpstreamCatalog(device, lang);
    return { fields: this.buildCatalog(upstream) };
  }

  async series(
    device: DeviceRefDto,
    fieldsCsv: string,
    fromRaw: string,
    toRaw: string,
    precision: number,
  ): Promise<ChartSeriesResponseDto> {
    const fieldIds = parseFieldIds(fieldsCsv);
    if (fieldIds.length === 0) {
      throw new BadRequestException('fields must list at least one chart field id');
    }
    if (fieldIds.length > MAX_FIELDS) {
      throw new BadRequestException(`fields supports at most ${MAX_FIELDS} ids`);
    }

    const from = expandRangeBound(fromRaw, 'start');
    const to = expandRangeBound(toRaw, 'end');
    assertRange(from, to);

    const catalog = this.buildCatalog(await this.loadUpstreamCatalog(device));
    const catalogById = new Map(catalog.map((field) => [field.id, field] as const));
    const catalogIds = new Set(catalog.map((field) => field.id));

    const nativeRequested = fieldIds.filter((id) => !isCalculatedChartField(id));
    const calculatedRequested = fieldIds.filter((id) => isCalculatedChartField(id));

    // SP OneDay is far more reliable than DatNew for PV/load energy curves.
    const calculatedFromSp = await this.buildCalculatedSeriesFromSp(
      device,
      calculatedRequested,
      from,
      to,
      catalogById,
    );

    const fetchIds = new Set(nativeRequested);
    for (const id of calculatedRequested) {
      if (calculatedFromSp.has(id)) continue;
      const def = getCalculatedFieldDef(id);
      if (!def) continue;
      for (const sourceId of resolvePowerSourceIds(def, catalogIds)) {
        fetchIds.add(sourceId);
      }
    }

    const payload = await this.fetchSeriesPayload(
      device,
      [...fetchIds],
      from,
      to,
      precision,
    );

    const nativeSeries = mapChartSeries(payload, catalogById, [...fetchIds]);
    const nativeById = new Map(nativeSeries.map((item) => [item.id, item]));

    const series: ChartSeriesDto[] = fieldIds.map((id) => {
      if (!isCalculatedChartField(id)) {
        return (
          nativeById.get(id) ?? {
            id,
            title: catalogById.get(id)?.title ?? id,
            unit: catalogById.get(id)?.unit ?? '',
            points: [],
          }
        );
      }

      const fromSp = calculatedFromSp.get(id);
      if (fromSp) return fromSp;

      const def = getCalculatedFieldDef(id)!;
      const sources = resolvePowerSourceIds(def, catalogIds)
        .map((sourceId) => nativeById.get(sourceId))
        .filter((item): item is ChartSeriesDto => Boolean(item));

      const power = sumPowerSeries(sources);
      return {
        id: def.id,
        title: def.title,
        unit: def.unit,
        points: integratePowerKwToCumulativeKwh(power),
      };
    });

    return {
      from,
      to,
      precisionMinutes: precision,
      series,
    };
  }

  /** Daily energy totals for the energy-flow dashboard (today in app timezone). */
  async dailyEnergyTotals(
    device: DeviceRefDto,
    options?: DailyEnergyComputeOptions,
  ): Promise<DailyEnergyTotals> {
    const day = options?.day?.trim() || todayInTimeZone(this.timeZone);
    const cacheKey = `${device.pn}|${device.sn}|${device.devcode}|${device.devaddr}|${day}`;
    if (!options?.bypassCache) {
      const cached = this.dailyEnergyCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
      }
    }

    const from = `${day} 00:00:00`;
    const to = `${day} 23:59:59`;

    // Gen/load from SP one-day (stable). Battery only from a small DatNew call —
    // large field lists and high poll rates both produce ERR_SYSTEM_EXCEPTION.
    const [pvSp, loadSp, batteryById] = await Promise.all([
      this.fetchSpOneDayPoints(device, day, 'PV_OUTPUT_POWER'),
      this.fetchSpOneDayPoints(device, day, 'LOAD_ACTIVE_POWER'),
      this.fetchBatteryChartSeries(device, from, to),
    ]);

    let voltage = batteryById.get('bt_battery_voltage')?.points ?? [];
    const chargeCurrent =
      batteryById.get('bt_battery_charging_current')?.points ?? [];
    const dischargeCurrent =
      batteryById.get('bt_battery_discharge_current')?.points ?? [];

    if (voltage.length === 0 && (chargeCurrent.length > 0 || dischargeCurrent.length > 0)) {
      voltage = synthesizeConstantVoltageSeries(
        [...chargeCurrent, ...dischargeCurrent],
        FALLBACK_BATTERY_VOLTAGE,
      );
    }

    const totals: DailyEnergyTotals = {
      generatedTodayKwh: totalEnergyKwhFromPowerKw(asKwPowerPoints(pvSp, 'kW')),
      consumedTodayKwh: totalEnergyKwhFromPowerKw(asKwPowerPoints(loadSp, 'kW')),
      batteryChargedTodayKwh: totalEnergyKwhFromVoltageAndCurrent(
        voltage,
        chargeCurrent,
      ),
      batteryDischargedTodayKwh: totalEnergyKwhFromVoltageAndCurrent(
        voltage,
        dischargeCurrent,
      ),
    };

    this.dailyEnergyCache.set(cacheKey, {
      expiresAt: Date.now() + DAILY_ENERGY_CACHE_TTL_MS,
      value: totals,
    });

    void this.dailyEnergy.save(device, day, totals);

    this.logger.debug(
      `Daily energy ${day}: gen=${totals.generatedTodayKwh} consumed=${totals.consumedTodayKwh} charged=${totals.batteryChargedTodayKwh} discharged=${totals.batteryDischargedTodayKwh}`,
    );

    return totals;
  }

  private async buildCalculatedSeriesFromSp(
    device: DeviceRefDto,
    calculatedIds: string[],
    from: string,
    to: string,
    catalogById: Map<string, ChartFieldDto>,
  ): Promise<Map<string, ChartSeriesDto>> {
    const result = new Map<string, ChartSeriesDto>();
    const days = enumerateCalendarDays(from, to);

    await Promise.all(
      calculatedIds.map(async (id) => {
        const parameter = spParameterForCalculatedField(id);
        const def = getCalculatedFieldDef(id);
        if (!parameter || !def) return;

        const powerPoints: ChartPointDto[] = [];
        for (const day of days) {
          const dayPoints = await this.fetchSpOneDayPoints(device, day, parameter);
          powerPoints.push(...dayPoints);
        }
        if (powerPoints.length === 0) return;

        const powerKw = asKwPowerPoints(powerPoints, 'kW');
        result.set(id, {
          id: def.id,
          title: catalogById.get(id)?.title ?? def.title,
          unit: def.unit,
          points: integratePowerKwToCumulativeKwh(powerKw),
        });
      }),
    );

    return result;
  }

  private async fetchSpOneDayPoints(
    device: DeviceRefDto,
    day: string,
    parameter: string,
  ): Promise<ChartPointDto[]> {
    try {
      const payload = await this.shine.callOrThrow<ShineKeyParameterOneDayPayload>(
        'querySPDeviceKeyParameterOneDay',
        {
          ...deviceParams(device),
          date: day,
          parameter,
          source: 1,
        },
      );
      return spSamplesToPoints(payload.detail);
    } catch (error: unknown) {
      this.logger.warn(
        `SP one-day ${parameter} unavailable: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }

  private async fetchBatteryChartSeries(
    device: DeviceRefDto,
    from: string,
    to: string,
  ): Promise<Map<string, ChartSeriesDto>> {
    // Try the full trio first; on empty/failed responses fall back to currents only.
    const attempts: string[][] = [
      [...BATTERY_ENERGY_CHART_FIELDS],
      ['bt_battery_charging_current', 'bt_battery_discharge_current'],
    ];

    for (const fields of attempts) {
      const payload = await this.fetchSeriesPayload(device, fields, from, to, 5);
      const catalogById = new Map<string, ChartFieldDto>(
        fields.map((id) => [
          id,
          {
            id,
            title: id,
            unit: id.includes('voltage') ? 'V' : 'A',
            group: id.includes('voltage') ? 'V' : 'A',
          },
        ]),
      );
      const series = mapChartSeries(payload, catalogById, fields);
      const byId = new Map(series.map((item) => [item.id, item]));
      const hasPoints = series.some((item) => item.points.length > 0);
      if (hasPoints) return byId;
    }

    return new Map();
  }

  private buildCatalog(upstreamRows: ShineChartFieldRow[]): ChartFieldDto[] {
    const upstream = mapChartFields(upstreamRows).filter(
      (field) => !FAULTY_UPSTREAM_ENERGY_FIELD_IDS.has(field.id),
    );
    const calculated: ChartFieldDto[] = CALCULATED_CHART_FIELDS.map((field) => ({
      id: field.id,
      title: field.title,
      unit: field.unit,
      group: field.group,
    }));
    return [...upstream, ...calculated].sort(
      (a, b) => a.group.localeCompare(b.group) || a.title.localeCompare(b.title),
    );
  }

  private async loadUpstreamCatalog(
    device: DeviceRefDto,
    lang?: string,
  ): Promise<ShineChartFieldRow[]> {
    const payload = await this.shine.callOrThrow<ShineChartFieldRow[]>(
      'queryDeviceChartField',
      {
        ...deviceParams(device),
        lang: lang?.trim() || this.shine.locale || 'en_US',
        source: 1,
      },
    );
    return Array.isArray(payload) ? payload : [];
  }

  /**
   * Fetch DatNew in small batches. Never throws — failed batches are skipped so
   * charts can still return SP-backed calculated series (and any successful natives).
   */
  private async fetchSeriesPayload(
    device: DeviceRefDto,
    fieldIds: string[],
    from: string,
    to: string,
    precision: number,
  ): Promise<ShineChartFieldsDatPayload> {
    if (fieldIds.length === 0) return { date: [] };

    const merged: NonNullable<ShineChartFieldsDatPayload['date']> = [];
    const seenPars = new Set<string>();

    for (let i = 0; i < fieldIds.length; i += DATNEW_FIELD_BATCH_SIZE) {
      const batch = fieldIds.slice(i, i + DATNEW_FIELD_BATCH_SIZE);
      const batchRows = await this.fetchDatNewBatch(device, batch, from, to, precision);
      for (const row of batchRows) {
        const par = row.par?.trim();
        if (!par || seenPars.has(par)) continue;
        seenPars.add(par);
        merged.push(row);
      }
    }

    return { date: merged };
  }

  private async fetchDatNewBatch(
    device: DeviceRefDto,
    fieldIds: string[],
    from: string,
    to: string,
    precision: number,
  ): Promise<NonNullable<ShineChartFieldsDatPayload['date']>> {
    if (fieldIds.length === 0) return [];

    try {
      const payload = await this.shine.callOrThrow<ShineChartFieldsDatPayload>(
        'queryDeviceChartFieldsDatNew',
        {
          ...deviceParams(device),
          precision,
          sdate: toShineDateTime(from),
          edate: toShineDateTime(to),
          field: fieldIds.join(','),
          source: 1,
        },
      );
      return payload.date ?? [];
    } catch (error: unknown) {
      this.logger.warn(
        `DatNew batch [${fieldIds.join(',')}] unavailable: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      if (fieldIds.length === 1) return [];

      // Retry each field alone — multi-field DatNew often trips ERR_SYSTEM_EXCEPTION.
      const rows: NonNullable<ShineChartFieldsDatPayload['date']> = [];
      for (const fieldId of fieldIds) {
        rows.push(
          ...(await this.fetchDatNewBatch(device, [fieldId], from, to, precision)),
        );
      }
      return rows;
    }
  }
}

export function parseFieldIds(csv: string): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const part of csv.split(',')) {
    const id = part.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function expandRangeBound(raw: string, edge: 'start' | 'end'): string {
  if (raw.includes('T')) {
    return raw.replace('T', ' ');
  }
  return edge === 'start' ? `${raw} 00:00:00` : `${raw} 23:59:59`;
}

function toShineDateTime(local: string): string {
  return local.includes(' ') ? local : local.replace('T', ' ');
}

function parseLocalWallTime(value: string): number {
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const ms = Date.parse(normalized);
  if (!Number.isFinite(ms)) {
    throw new BadRequestException(`Invalid datetime: ${value}`);
  }
  return ms;
}

function assertRange(from: string, to: string): void {
  const fromMs = parseLocalWallTime(from);
  const toMs = parseLocalWallTime(to);
  if (toMs < fromMs) {
    throw new BadRequestException('to must be on or after from');
  }
  if (toMs - fromMs > MAX_RANGE_MS) {
    throw new BadRequestException('date range must not exceed 7 days');
  }
}

/** Wrap raw points as a kW series for shared normalization/integration helpers. */
function asKwPowerPoints(points: ChartPointDto[], unit: string): ChartPointDto[] {
  if (points.length === 0) return [];
  return sumPowerSeries([
    {
      id: 'tmp',
      title: 'tmp',
      unit,
      points,
    },
  ]);
}

function synthesizeConstantVoltageSeries(
  referencePoints: ChartPointDto[],
  voltage: number,
): ChartPointDto[] {
  const timestamps = [...new Set(referencePoints.map((point) => point.t))].sort((a, b) =>
    a.localeCompare(b),
  );
  return timestamps.map((t) => ({ t, v: voltage }));
}

/** Inclusive calendar days covered by a local `YYYY-MM-DD[ HH:mm:ss]` range. */
export function enumerateCalendarDays(from: string, to: string): string[] {
  const start = from.slice(0, 10);
  const end = to.slice(0, 10);
  const days: string[] = [];
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  if (!Number.isFinite(cursor.getTime()) || !Number.isFinite(last.getTime())) {
    return start ? [start] : [];
  }
  while (cursor.getTime() <= last.getTime()) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}
