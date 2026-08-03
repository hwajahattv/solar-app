import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { DeviceRefDto } from '../common/dto/device-ref.dto';
import { EnergyFlowDto } from './dto/energy-flow.dto';
import { HistoryPageDto, HistoryQueryDto } from './dto/history.dto';
import { TelemetryService } from './telemetry.service';

@ApiTags('telemetry')
@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetry: TelemetryService) {}

  @Get('energy-flow')
  @ApiOperation({
    summary: 'Current energy flow snapshot',
    description:
      'Returns a device-independent view of grid, solar, battery and load state. All thresholds and unit conversions are applied server-side so every client renders identical numbers.',
  })
  @ApiOkResponse({ type: EnergyFlowDto })
  energyFlow(@Query() device: DeviceRefDto): Promise<EnergyFlowDto> {
    return this.telemetry.energyFlow(device);
  }

  @Get('history')
  @ApiOperation({
    summary: 'Paginated data logger history for one day',
    description:
      'Columns are annotated so clients know which ones are constant or should stay hidden.',
  })
  @ApiOkResponse({ type: HistoryPageDto })
  history(@Query() query: HistoryQueryDto): Promise<HistoryPageDto> {
    const date = query.date ?? TelemetryService.today();
    return this.telemetry.history(query, date, query.page, query.pageSize);
  }
}
