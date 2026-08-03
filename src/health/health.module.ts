import { Module } from '@nestjs/common';

import { CameraModule } from '../camera/camera.module';
import { HealthController } from './health.controller';

@Module({
  imports: [CameraModule],
  controllers: [HealthController],
})
export class HealthModule {}
