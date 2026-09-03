import {
  Controller,
  Get,
  Header,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { Public } from '../auth/public.decorator';
import { CronAuthGuard } from './cron-auth.guard';
import { DailyEnergySnapshotService } from './daily-energy-snapshot.service';
import {
  CronRunDto,
  DailyEnergySnapshotResultDto,
} from './dto/daily-energy-snapshot.dto';

@ApiTags('cron')
@Controller('cron')
@Public()
@UseGuards(CronAuthGuard)
export class CronController {
  constructor(private readonly snapshots: DailyEnergySnapshotService) {}

  @Get('daily-energy-snapshot')
  @Post('daily-energy-snapshot')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Snapshot daily energy totals for all devices',
    description:
      'Intended for Vercel Cron (or any scheduler) shortly before local midnight (APP_TIMEZONE). ' +
      'Vercel always evaluates the schedule in UTC. Requires Authorization: Bearer CRON_SECRET.',
  })
  @ApiOkResponse({ type: DailyEnergySnapshotResultDto })
  dailyEnergySnapshot(
    @Req() request: Request,
    @Query('day') day?: string,
  ): Promise<DailyEnergySnapshotResultDto> {
    const userAgent = request.header('user-agent') ?? undefined;
    const schedule = request.header('x-vercel-cron-schedule') ?? undefined;
    const trigger = userAgent?.includes('vercel-cron')
      ? 'vercel-cron'
      : 'manual';

    return this.snapshots.snapshotAll(day, { trigger, schedule, userAgent });
  }

  @Get('runs')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Recent daily-energy snapshot invocations',
    description:
      'Use this after a Vercel Cron run (or a Postman trigger) to confirm the job actually executed.',
  })
  @ApiOkResponse({ type: [CronRunDto] })
  runs(@Query('limit') limit?: number): Promise<CronRunDto[]> {
    return this.snapshots.listRuns(limit);
  }
}
