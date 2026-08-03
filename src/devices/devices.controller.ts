import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { DevicesService } from './devices.service';
import { DeviceDto } from './dto/device.dto';

@ApiTags('devices')
@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  @ApiOperation({
    summary: 'List inverters on the account',
    description:
      'Returns the device identifiers every other endpoint expects as query parameters.',
  })
  @ApiOkResponse({ type: [DeviceDto] })
  list(): Promise<DeviceDto[]> {
    return this.devices.list();
  }
}
