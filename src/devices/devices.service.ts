import { Injectable } from '@nestjs/common';

import { toNumber } from '../common/utils/numeric';
import { ShineApiService } from '../shine/shine-api.service';
import type { ShineDevice } from '../shine/shine.types';
import { DeviceDto } from './dto/device.dto';

@Injectable()
export class DevicesService {
  constructor(private readonly shine: ShineApiService) {}

  async list(): Promise<DeviceDto[]> {
    const payload = await this.shine.callOrThrow<{ device?: ShineDevice[] }>(
      'webQueryDeviceEs',
      {
        page: 0,
        pagesize: 10,
        i18n: this.shine.locale,
      },
    );

    return (payload.device ?? []).map((device) => this.toDto(device));
  }

  private toDto(device: ShineDevice): DeviceDto {
    return {
      pn: String(device.pn),
      sn: String(device.sn),
      devcode: String(device.devcode),
      devaddr: String(device.devaddr),
      alias: device.devalias?.trim() || String(device.pn),
      plantId: device.pid === undefined ? undefined : String(device.pid),
      batterySoc: toNumber(device.soc),
      energyToday: toNumber(device.energyToday),
      outputPower: toNumber(device.outpower),
      status: device.status === undefined ? undefined : String(device.status),
    };
  }
}
