import { Module } from '@nestjs/common';

import { DailyEnergyService } from './daily-energy.service';

@Module({
  providers: [DailyEnergyService],
  exports: [DailyEnergyService],
})
export class DailyEnergyModule {}
