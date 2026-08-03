import { Injectable } from '@nestjs/common';

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
  constructor(private readonly shine: ShineApiService) {}

  async energyFlow(device: DeviceRefDto): Promise<EnergyFlowDto> {
    const payload = await this.shine.callOrThrow<ShineLastDataPayload>(
      'querySPDeviceLastData',
      {
        ...deviceParams(device),
        i18n: this.shine.locale,
      },
    );

    return mapEnergyFlow(payload);
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

  /** Local calendar day in the format the upstream expects. */
  static today(): string {
    const now = new Date();
    const pad = (value: number): string => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
}
