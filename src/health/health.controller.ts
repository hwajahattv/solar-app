import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CameraService } from '../camera/camera.service';
import { ShineSessionService } from '../shine/shine-session.service';

class HealthDto {
  status!: 'ok';
  uptimeSeconds!: number;
  shineConfigured!: boolean;
  cameraConfigured!: boolean;
  timestamp!: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly session: ShineSessionService,
    private readonly camera: CameraService,
  ) {}

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
      timestamp: new Date().toISOString(),
    };
  }
}
