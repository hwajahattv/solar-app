import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { runWithAuth } from '../auth/auth-context';
import { AuthService } from '../auth/auth.service';
import { ChartsService } from '../charts/charts.service';
import { todayInTimeZone } from '../common/utils/timezone';
import { DeviceRefDto } from '../common/dto/device-ref.dto';
import { DailyEnergyService } from '../daily-energy/daily-energy.service';
import { PrismaService } from '../database/prisma.service';
import { DevicesService } from '../devices/devices.service';
import type { CronRunDto } from './dto/daily-energy-snapshot.dto';
import type { DailyEnergySnapshotResultDto } from './dto/daily-energy-snapshot.dto';

export interface SnapshotInvocationMeta {
  trigger: 'vercel-cron' | 'manual';
  schedule?: string;
  userAgent?: string;
}

@Injectable()
export class DailyEnergySnapshotService {
  private readonly logger = new Logger(DailyEnergySnapshotService.name);
  private readonly timeZone: string;

  constructor(
    private readonly charts: ChartsService,
    private readonly devices: DevicesService,
    private readonly dailyEnergy: DailyEnergyService,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.timeZone = config.getOrThrow<string>('timezone');
  }

  /**
   * Recomputes daily energy for every device on every stored ShineMonitor
   * account (same logic as the dashboard) and persists using max-merge so the
   * stored row keeps the highest value seen for each metric that day.
   */
  async snapshotAll(
    dayOverride?: string,
    meta: SnapshotInvocationMeta = { trigger: 'manual' },
  ): Promise<DailyEnergySnapshotResultDto> {
    const startedAt = new Date();
    const day = dayOverride?.trim() || todayInTimeZone(this.timeZone);

    this.logger.log(
      `Daily energy snapshot starting day=${day} tz=${this.timeZone} trigger=${meta.trigger} schedule=${meta.schedule ?? '-'} ua=${meta.userAgent ?? '-'}`,
    );

    let users: Awaited<ReturnType<AuthService['listActiveUsers']>> = [];
    let note: string | undefined;
    let error: string | undefined;

    try {
      users = await this.auth.listActiveUsers();
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : String(err);
      this.logger.error(`Cannot list users for snapshot: ${error}`);
    }

    if (!error && users.length === 0) {
      note =
        'No users have logged in yet, so there are no ShineMonitor accounts to snapshot.';
      this.logger.warn(note);
    }

    const results: DailyEnergySnapshotResultDto['results'] = [];
    let saved = 0;
    let failed = 0;
    let devices = 0;

    for (const principal of users) {
      const outcome = await runWithAuth(principal, () =>
        this.snapshotUser(principal.username, day),
      );
      devices += outcome.devices;
      saved += outcome.saved;
      failed += outcome.failed;
      results.push(...outcome.results);
    }

    const finishedAt = new Date();
    this.logger.log(
      `Daily energy snapshot ${day}: ${saved}/${devices} saved, ${failed} failed (${users.length} accounts) in ${finishedAt.getTime() - startedAt.getTime()}ms`,
    );

    const runId = await this.persistRun({
      day,
      trigger: meta.trigger,
      schedule: meta.schedule,
      userAgent: meta.userAgent,
      startedAt,
      finishedAt,
      accounts: users.length,
      devices,
      saved,
      failed,
      error,
    });

    return {
      day,
      accounts: users.length,
      devices,
      saved,
      failed,
      results,
      runId,
      invokedAt: startedAt.toISOString(),
      trigger: meta.trigger,
      schedule: meta.schedule,
      note: note ?? error,
    };
  }

  async listRuns(limit = 20): Promise<CronRunDto[]> {
    if (!this.prisma.enabled) return [];

    const rows = await this.prisma.cronRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });

    return rows.map((row) => ({
      id: row.id,
      day: row.day,
      trigger: row.trigger,
      schedule: row.schedule,
      userAgent: row.userAgent,
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt.toISOString(),
      accounts: row.accounts,
      devices: row.devices,
      saved: row.saved,
      failed: row.failed,
      error: row.error,
    }));
  }

  private async persistRun(input: {
    day: string;
    trigger: string;
    schedule?: string;
    userAgent?: string;
    startedAt: Date;
    finishedAt: Date;
    accounts: number;
    devices: number;
    saved: number;
    failed: number;
    error?: string;
  }): Promise<string | undefined> {
    if (!this.prisma.enabled) return undefined;

    try {
      const row = await this.prisma.cronRun.create({
        data: {
          day: input.day,
          trigger: input.trigger,
          schedule: input.schedule,
          userAgent: input.userAgent,
          startedAt: input.startedAt,
          finishedAt: input.finishedAt,
          accounts: input.accounts,
          devices: input.devices,
          saved: input.saved,
          failed: input.failed,
          error: input.error,
        },
      });
      return row.id;
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to persist cron run: ${err instanceof Error ? err.message : String(err)}`,
      );
      return undefined;
    }
  }

  private async snapshotUser(
    username: string,
    day: string,
  ): Promise<DailyEnergySnapshotResultDto> {
    let deviceList: Awaited<ReturnType<DevicesService['list']>> = [];
    try {
      deviceList = await this.devices.list();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Daily energy snapshot skipped for ${username}: ${message}`,
      );
      return {
        day,
        accounts: 1,
        devices: 0,
        saved: 0,
        failed: 1,
        results: [
          {
            pn: username,
            sn: '-',
            success: false,
            error: message,
          },
        ],
      };
    }

    const results: DailyEnergySnapshotResultDto['results'] = [];
    let saved = 0;
    let failed = 0;

    for (const device of deviceList) {
      const ref: DeviceRefDto = {
        pn: device.pn,
        sn: device.sn,
        devcode: device.devcode,
        devaddr: device.devaddr,
      };

      try {
        const totals = await this.charts.dailyEnergyTotals(ref, {
          day,
          bypassCache: true,
        });
        await this.dailyEnergy.save(ref, day, totals);

        saved += 1;
        results.push({
          pn: device.pn,
          sn: device.sn,
          success: true,
          generatedTodayKwh: totals.generatedTodayKwh,
          consumedTodayKwh: totals.consumedTodayKwh,
        });
      } catch (error: unknown) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Daily energy snapshot failed for ${device.pn}: ${message}`,
        );
        results.push({
          pn: device.pn,
          sn: device.sn,
          success: false,
          error: message,
        });
      }
    }

    return {
      day,
      accounts: 1,
      devices: deviceList.length,
      saved,
      failed,
      results,
    };
  }
}
