import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ChartsService } from './charts.service';
import {
  ChartFieldsQueryDto,
  ChartFieldsResponseDto,
  ChartSeriesQueryDto,
  ChartSeriesResponseDto,
} from './dto/charts.dto';

@ApiTags('charts')
@Controller('charts')
export class ChartsController {
  constructor(private readonly charts: ChartsService) {}

  @Get('fields')
  @ApiOperation({
    summary: 'Chart quantity catalog for a device',
    description:
      'Lists plottable fields (id, title, unit) from ShineMonitor queryDeviceChartField.',
  })
  @ApiOkResponse({ type: ChartFieldsResponseDto })
  fields(@Query() query: ChartFieldsQueryDto): Promise<ChartFieldsResponseDto> {
    return this.charts.fields(query, query.lang);
  }

  @Get('series')
  @ApiOperation({
    summary: 'Time-series for one or more chart fields',
    description:
      'Wraps queryDeviceChartFieldsDatNew. Range max 7 days. Dedupes field ids and strips padded trailing zeros.',
  })
  @ApiOkResponse({ type: ChartSeriesResponseDto })
  series(@Query() query: ChartSeriesQueryDto): Promise<ChartSeriesResponseDto> {
    return this.charts.series(
      query,
      query.fields,
      query.from,
      query.to,
      query.precision,
    );
  }
}
