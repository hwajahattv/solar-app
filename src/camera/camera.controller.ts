import { Controller, Get, Header, Req, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { CameraService } from './camera.service';

@ApiTags('camera')
@Controller('camera')
export class CameraController {
  constructor(private readonly camera: CameraService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Report camera availability',
    description:
      'Clients call this before showing the camera panel, since serverless deployments have no ffmpeg or LAN access.',
  })
  @ApiOkResponse({
    schema: {
      properties: {
        configured: { type: 'boolean' },
        activeStreams: { type: 'number' },
        maxStreams: { type: 'number' },
      },
    },
  })
  status(): { configured: boolean; activeStreams: number; maxStreams: number } {
    return this.camera.status;
  }

  @Get('stream')
  @ApiOperation({
    summary:
      'Live MJPEG stream suitable for an <img> tag or a native image view',
  })
  @ApiProduces('multipart/x-mixed-replace')
  stream(@Req() request: Request, @Res() response: Response): void {
    this.camera.stream(response, (release) => {
      request.on('close', release);
      response.on('close', release);
    });
  }

  @Get('snapshot')
  @ApiOperation({ summary: 'Single JPEG frame' })
  @ApiProduces('image/jpeg')
  @Header('Cache-Control', 'no-cache')
  @Header('Content-Type', 'image/jpeg')
  async snapshot(@Res() response: Response): Promise<void> {
    const frame = await this.camera.snapshot();
    response.end(frame);
  }
}
