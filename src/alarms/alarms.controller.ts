import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AlarmsService } from './alarms.service';
import { AlarmPageDto, AlarmQueryDto } from './dto/alarm.dto';

@ApiTags('alarms')
@Controller('alarms')
export class AlarmsController {
  constructor(private readonly alarms: AlarmsService) {}

  @Get()
  @ApiOperation({
    summary: 'List inverter alarms',
    description:
      'Timestamps are normalised to ISO-8601 so clients can format them for any locale or timezone.',
  })
  @ApiOkResponse({ type: AlarmPageDto })
  list(@Query() query: AlarmQueryDto): Promise<AlarmPageDto> {
    return this.alarms.list(query, query.page, query.pageSize);
  }
}
