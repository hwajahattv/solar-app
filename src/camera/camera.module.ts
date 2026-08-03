import { Module } from '@nestjs/common';

import { CameraController } from './camera.controller';
import { CameraService } from './camera.service';

/**
 * The only module that needs ffmpeg and LAN reachability. Keeping it isolated
 * lets the rest of the API run on a serverless platform while the camera is
 * served from a host that sits on the same network as the camera.
 */
@Module({
  controllers: [CameraController],
  providers: [CameraService],
  exports: [CameraService],
})
export class CameraModule {}
