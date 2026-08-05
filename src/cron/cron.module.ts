import { Module } from '@nestjs/common';

import { ChartsModule } from '../charts/charts.module';
import { DevicesModule } from '../devices/devices.module';
import { DailyEnergyModule } from '../daily-energy/daily-energy.module';
import { CronAuthGuard } from './cron-auth.guard';
import { CronController } from './cron.controller';
import { DailyEnergySnapshotService } from './daily-energy-snapshot.service';

@Module({
  imports: [ChartsModule, DevicesModule, DailyEnergyModule],
  controllers: [CronController],
  providers: [DailyEnergySnapshotService, CronAuthGuard],
})
export class CronModule {}
