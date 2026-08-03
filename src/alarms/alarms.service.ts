import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { deviceParams, DeviceRefDto } from '../common/dto/device-ref.dto';
import { toIsoDate } from '../common/utils/numeric';
import { ShineApiService } from '../shine/shine-api.service';
import type { ShineWarningRow } from '../shine/shine.types';
import { AlarmDto, AlarmPageDto } from './dto/alarm.dto';

/** The upstream has used all of these keys for the alarm collection over time. */
const ALARM_COLLECTION_KEYS = ['warning', 'alarm', 'list', 'row'] as const;

interface WarningPayload extends Record<string, unknown> {
  total?: number | string;
}

@Injectable()
export class AlarmsService {
  private readonly timeZone: string;

  constructor(
    private readonly shine: ShineApiService,
    config: ConfigService,
  ) {
    this.timeZone = config.getOrThrow<string>('timezone');
  }

  async list(
    device: DeviceRefDto,
    page: number,
    pageSize: number,
  ): Promise<AlarmPageDto> {
    const result = await this.shine.call<WarningPayload>('queryDeviceWarning', {
      ...deviceParams(device),
      page,
      pagesize: pageSize,
      i18n: this.shine.locale,
      lang: this.shine.locale,
    });

    // An empty alarm list is a healthy system, not an error — report it as such.
    if (result.response.err !== 0) {
      return { page, pageSize, total: 0, alarms: [] };
    }

    const payload = result.response.dat ?? {};
    const rows = extractRows(payload);

    return {
      page,
      pageSize,
      total:
        Number.parseInt(String(payload.total ?? rows.length), 10) ||
        rows.length,
      alarms: rows.map((row) => toAlarmDto(row, this.timeZone)),
    };
  }
}

function extractRows(payload: WarningPayload): ShineWarningRow[] {
  for (const key of ALARM_COLLECTION_KEYS) {
    const value = payload[key];
    if (Array.isArray(value)) return value as ShineWarningRow[];
  }
  return [];
}

function toAlarmDto(row: ShineWarningRow, timeZone: string): AlarmDto {
  const startedAt = toIsoDate(row.gts, timeZone);
  const clearedAt = toIsoDate(row.cts, timeZone);

  return {
    title: row.title?.trim() || 'Alarm',
    description: row.desc?.trim() || null,
    active: !clearedAt,
    startedAt,
    clearedAt,
    durationMs:
      startedAt && clearedAt
        ? new Date(clearedAt).getTime() - new Date(startedAt).getTime()
        : null,
    code: row.code === undefined ? null : String(row.code),
  };
}
