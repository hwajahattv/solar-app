import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CameraService } from '../camera/camera.service';
import { ShineSessionService } from '../shine/shine-session.service';

class HealthDto {
  status!: 'ok';
  uptimeSeconds!: number;
  shineConfigured!: boolean;
  cameraConfigured!: boolean;
  timezone!: string;
  timestamp!: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly timeZone: string;

  constructor(
    private readonly session: ShineSessionService,
    private readonly camera: CameraService,
    config: ConfigService,
  ) {
    this.timeZone = config.getOrThrow<string>('timezone');
  }

  @Get()
  @ApiOperation({
    summary: 'Liveness probe for load balancers and uptime monitors',
  })
  @ApiOkResponse({ type: HealthDto })
  check(): HealthDto {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      shineConfigured: this.session.isConfigured,
      cameraConfigured: this.camera.isConfigured,
      timezone: this.timeZone,
      timestamp: new Date().toISOString(),
    };
  }
}
