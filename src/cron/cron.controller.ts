import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CronAuthGuard } from './cron-auth.guard';
import { DailyEnergySnapshotService } from './daily-energy-snapshot.service';
import { DailyEnergySnapshotResultDto } from './dto/daily-energy-snapshot.dto';

@ApiTags('cron')
@Controller('cron')
@UseGuards(CronAuthGuard)
export class CronController {
  constructor(private readonly snapshots: DailyEnergySnapshotService) {}

  @Get('daily-energy-snapshot')
  @Post('daily-energy-snapshot')
  @ApiOperation({
    summary: 'Snapshot daily energy totals for all devices',
    description:
      'Intended for Vercel Cron (or any scheduler) shortly before local midnight. ' +
      'Recomputes the same totals as the dashboard and stores the maximum value ' +
      'seen for each kWh metric that day. Requires Authorization: Bearer CRON_SECRET.',
  })
  @ApiOkResponse({ type: DailyEnergySnapshotResultDto })
  dailyEnergySnapshot(
    @Query('day') day?: string,
  ): Promise<DailyEnergySnapshotResultDto> {
    return this.snapshots.snapshotAll(day);
  }
}
