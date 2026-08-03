import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { todayInTimeZone } from '../common/utils/timezone';
import { deviceParams, DeviceRefDto } from '../common/dto/device-ref.dto';
import { ShineApiService } from '../shine/shine-api.service';
import type {
  ShineHistoryPayload,
  ShineLastDataPayload,
} from '../shine/shine.types';
import { EnergyFlowDto } from './dto/energy-flow.dto';
import { HistoryPageDto } from './dto/history.dto';
import { mapEnergyFlow } from './mappers/energy-flow.mapper';
import { mapHistoryPage } from './mappers/history.mapper';

@Injectable()
export class TelemetryService {
  private readonly timeZone: string;

  constructor(
    private readonly shine: ShineApiService,
    config: ConfigService,
  ) {
    this.timeZone = config.getOrThrow<string>('timezone');
  }

  today(): string {
    return todayInTimeZone(this.timeZone);
  }

  async energyFlow(device: DeviceRefDto): Promise<EnergyFlowDto> {
    const payload = await this.shine.callOrThrow<ShineLastDataPayload>(
      'querySPDeviceLastData',
      {
        ...deviceParams(device),
        i18n: this.shine.locale,
      },
    );

    return mapEnergyFlow(payload, this.timeZone);
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
