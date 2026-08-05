import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ChartsService } from '../charts/charts.service';
import { todayInTimeZone } from '../common/utils/timezone';
import { DeviceRefDto } from '../common/dto/device-ref.dto';
import { DailyEnergyService } from '../daily-energy/daily-energy.service';
import { DevicesService } from '../devices/devices.service';
import type { DailyEnergySnapshotResultDto } from './dto/daily-energy-snapshot.dto';

@Injectable()
export class DailyEnergySnapshotService {
  private readonly logger = new Logger(DailyEnergySnapshotService.name);
  private readonly timeZone: string;

  constructor(
    private readonly charts: ChartsService,
    private readonly devices: DevicesService,
    private readonly dailyEnergy: DailyEnergyService,
    config: ConfigService,
  ) {
    this.timeZone = config.getOrThrow<string>('timezone');
  }

  /**
   * Recomputes daily energy for every registered device (same logic as the
   * dashboard) and persists using max-merge so the stored row keeps the
   * highest value seen for each metric that day.
   */
  async snapshotAll(dayOverride?: string): Promise<DailyEnergySnapshotResultDto> {
    const day = dayOverride?.trim() || todayInTimeZone(this.timeZone);
    const deviceList = await this.devices.list();

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
        this.logger.warn(`Daily energy snapshot failed for ${device.pn}: ${message}`);
        results.push({
          pn: device.pn,
          sn: device.sn,
          success: false,
          error: message,
        });
      }
    }

    this.logger.log(
      `Daily energy snapshot ${day}: ${saved}/${deviceList.length} saved, ${failed} failed`,
    );

    return {
      day,
      devices: deviceList.length,
      saved,
      failed,
      results,
    };
  }
}
