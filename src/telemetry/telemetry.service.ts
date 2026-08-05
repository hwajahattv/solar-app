import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ChartsService } from '../charts/charts.service';
import { todayInTimeZone } from '../common/utils/timezone';
import { deviceParams, DeviceRefDto } from '../common/dto/device-ref.dto';
import { DailyEnergyService } from '../daily-energy/daily-energy.service';
import { ShineApiService } from '../shine/shine-api.service';
import type {
  ShineHistoryPayload,
  ShineLastDataPayload,
} from '../shine/shine.types';
import { DailyEnergyHistoryDto } from './dto/daily-energy.dto';
import { EnergyFlowDto } from './dto/energy-flow.dto';
import { HistoryPageDto } from './dto/history.dto';
import { mapEnergyFlow } from './mappers/energy-flow.mapper';
import { mapHistoryPage } from './mappers/history.mapper';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);
  private readonly timeZone: string;

  constructor(
    private readonly shine: ShineApiService,
    private readonly charts: ChartsService,
    private readonly dailyEnergy: DailyEnergyService,
    config: ConfigService,
  ) {
    this.timeZone = config.getOrThrow<string>('timezone');
  }

  today(): string {
    return todayInTimeZone(this.timeZone);
  }

  async energyFlow(device: DeviceRefDto): Promise<EnergyFlowDto> {
    const [payload, dailyEnergy] = await Promise.all([
      this.shine.callOrThrow<ShineLastDataPayload>('querySPDeviceLastData', {
        ...deviceParams(device),
        i18n: this.shine.locale,
      }),
      this.charts.dailyEnergyTotals(device).catch((error: unknown) => {
        this.logger.warn(
          `Daily energy totals unavailable: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return null;
      }),
    ]);

    return mapEnergyFlow(payload, this.timeZone, dailyEnergy);
  }

  async dailyEnergyHistory(
    device: DeviceRefDto,
    fromRaw?: string,
    toRaw?: string,
  ): Promise<DailyEnergyHistoryDto> {
    const to = toRaw?.trim() || todayInTimeZone(this.timeZone);
    const from = fromRaw?.trim() || to;
    const records = await this.dailyEnergy.list(device, from, to);
    return { from, to, records };
  }

  async history(
    device: DeviceRefDto,
    date: string,
    page: number,
    pageSize: number,
  ): Promise<HistoryPageDto> {
    const payload = await this.shine.callOrThrow<ShineHistoryPayload>(
      'queryDeviceDataOneDayPaging',
      {
        ...deviceParams(device),
        date,
        page,
        pagesize: pageSize,
        i18n: this.shine.locale,
        source: 1,
      },
    );

    return mapHistoryPage(payload, { date, page, pageSize });
  }
}
