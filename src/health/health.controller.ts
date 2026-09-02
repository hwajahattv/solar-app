import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AuthService } from '../auth/auth.service';
import { Public } from '../auth/public.decorator';
import { CameraService } from '../camera/camera.service';

class HealthDto {
  status!: 'ok';
  uptimeSeconds!: number;
  authConfigured!: boolean;
  /** @deprecated Same as authConfigured. Kept so existing health checks keep working. */
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
    private readonly auth: AuthService,
    private readonly camera: CameraService,
    config: ConfigService,
  ) {
    this.timeZone = config.getOrThrow<string>('timezone');
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Liveness probe for load balancers and uptime monitors',
  })
  @ApiOkResponse({ type: HealthDto })
  check(): HealthDto {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      authConfigured: this.auth.isConfigured,
      shineConfigured: this.auth.isConfigured,
      cameraConfigured: this.camera.isConfigured,
      timezone: this.timeZone,
      timestamp: new Date().toISOString(),
    };
  }
}
