import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

import type { DailyEnergyTotals } from '../daily-energy/daily-energy.types';
import { DeviceRefDto } from '../common/dto/device-ref.dto';
import { PrismaService } from '../database/prisma.service';

export interface StoredDailyEnergy {
  day: string;
  generatedTodayKwh: number | null;
  consumedTodayKwh: number | null;
  batteryChargedTodayKwh: number | null;
  batteryDischargedTodayKwh: number | null;
  computedAt: string;
}

@Injectable()
export class DailyEnergyService {
  private readonly logger = new Logger(DailyEnergyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Upsert today's (or any day's) integrated totals for a device. */
  async save(device: DeviceRefDto, day: string, totals: DailyEnergyTotals): Promise<void> {
    if (!this.prisma.enabled) return;

    try {
      await this.prisma.dailyEnergyRecord.upsert({
        where: {
          pn_sn_devcode_devaddr_day: {
            pn: device.pn,
            sn: device.sn,
            devcode: device.devcode,
            devaddr: device.devaddr,
            day,
          },
        },
        create: {
          pn: device.pn,
          sn: device.sn,
          devcode: device.devcode,
          devaddr: device.devaddr,
          day,
          generatedTodayKwh: toDecimal(totals.generatedTodayKwh),
          consumedTodayKwh: toDecimal(totals.consumedTodayKwh),
          batteryChargedTodayKwh: toDecimal(totals.batteryChargedTodayKwh),
          batteryDischargedTodayKwh: toDecimal(totals.batteryDischargedTodayKwh),
        },
        update: {
          generatedTodayKwh: toDecimal(totals.generatedTodayKwh),
          consumedTodayKwh: toDecimal(totals.consumedTodayKwh),
          batteryChargedTodayKwh: toDecimal(totals.batteryChargedTodayKwh),
          batteryDischargedTodayKwh: toDecimal(totals.batteryDischargedTodayKwh),
        },
      });
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to persist daily energy ${day}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async findOne(device: DeviceRefDto, day: string): Promise<StoredDailyEnergy | null> {
    if (!this.prisma.enabled) return null;

    const row = await this.prisma.dailyEnergyRecord.findUnique({
      where: {
        pn_sn_devcode_devaddr_day: {
          pn: device.pn,
          sn: device.sn,
          devcode: device.devcode,
          devaddr: device.devaddr,
          day,
        },
      },
    });

    return row ? mapRow(row) : null;
  }

  async list(
    device: DeviceRefDto,
    fromDay: string,
    toDay: string,
  ): Promise<StoredDailyEnergy[]> {
    if (!this.prisma.enabled) return [];

    const rows = await this.prisma.dailyEnergyRecord.findMany({
      where: {
        pn: device.pn,
        sn: device.sn,
        devcode: device.devcode,
        devaddr: device.devaddr,
        day: { gte: fromDay, lte: toDay },
      },
      orderBy: { day: 'asc' },
    });

    return rows.map(mapRow);
  }
}

function toDecimal(value: number | null): Decimal | null {
  if (value === null || !Number.isFinite(value)) return null;
  return new Decimal(value);
}

function fromDecimal(value: Decimal | null): number | null {
  if (value === null) return null;
  const n = value.toNumber();
  return Number.isFinite(n) ? n : null;
}

function mapRow(row: {
  day: string;
  generatedTodayKwh: Decimal | null;
  consumedTodayKwh: Decimal | null;
  batteryChargedTodayKwh: Decimal | null;
  batteryDischargedTodayKwh: Decimal | null;
  computedAt: Date;
}): StoredDailyEnergy {
  return {
    day: row.day,
    generatedTodayKwh: fromDecimal(row.generatedTodayKwh),
    consumedTodayKwh: fromDecimal(row.consumedTodayKwh),
    batteryChargedTodayKwh: fromDecimal(row.batteryChargedTodayKwh),
    batteryDischargedTodayKwh: fromDecimal(row.batteryDischargedTodayKwh),
    computedAt: row.computedAt.toISOString(),
  };
}
