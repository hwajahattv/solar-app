import { Module } from '@nestjs/common';

import { CameraModule } from '../camera/camera.module';
import { AuthModule } from '../auth/auth.module';
import { HealthController } from './health.controller';

@Module({
  imports: [CameraModule, AuthModule],
  controllers: [HealthController],
})
export class HealthModule {}
