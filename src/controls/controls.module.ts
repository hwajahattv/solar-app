import { Module } from '@nestjs/common';

import { ControlsAuthGuard } from './controls-auth.guard';
import { ControlsController } from './controls.controller';
import { ControlsService } from './controls.service';

@Module({
  controllers: [ControlsController],
  providers: [ControlsService, ControlsAuthGuard],
})
export class ControlsModule {}
