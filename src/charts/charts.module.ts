import { Module } from '@nestjs/common';

import { DailyEnergyModule } from '../daily-energy/daily-energy.module';
import { ChartsController } from './charts.controller';
import { ChartsService } from './charts.service';

@Module({
  imports: [DailyEnergyModule],
  controllers: [ChartsController],
  providers: [ChartsService],
  exports: [ChartsService],
})
export class ChartsModule {}
