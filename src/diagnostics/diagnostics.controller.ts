import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ShineApiService } from '../shine/shine-api.service';
import type { ShineCallResult } from '../shine/shine.types';
import { RawCallDto } from './dto/raw-call.dto';

@ApiTags('diagnostics')
@Controller('diagnostics')
export class DiagnosticsController {
  constructor(private readonly shine: ShineApiService) {}

  @Post('shine-call')
  @ApiOperation({
    summary: 'Signed passthrough to any ShineMonitor action',
    description:
      'Escape hatch for exploring endpoints that do not yet have a typed route. Intended for support and development, not for production clients.',
  })
  call(@Body() body: RawCallDto): Promise<ShineCallResult> {
    return this.shine.call(body.action, body.params ?? {});
  }
}
