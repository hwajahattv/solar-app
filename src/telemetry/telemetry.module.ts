import { Module } from '@nestjs/common';

import { ChartsModule } from '../charts/charts.module';
import { DailyEnergyModule } from '../daily-energy/daily-energy.module';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';

@Module({
  imports: [ChartsModule, DailyEnergyModule],
  controllers: [TelemetryController],
  providers: [TelemetryService],
})
export class TelemetryModule {}
