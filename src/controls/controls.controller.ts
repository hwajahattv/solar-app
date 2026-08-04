import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { DeviceRefDto } from '../common/dto/device-ref.dto';
import { ControlsAuthGuard } from './controls-auth.guard';
import { ControlsService } from './controls.service';
import {
  ApplyProfileDto,
  ControlFieldDto,
  ControlValueDto,
  ControlWriteResultDto,
  ProfileResultDto,
  SetControlValueDto,
} from './dto/control.dto';
import { PREFERRED_PROFILE } from './preferred-profile';

@ApiTags('controls')
@Controller('controls')
@UseGuards(ControlsAuthGuard)
export class ControlsController {
  constructor(private readonly controls: ControlsService) {}

  @Get('fields')
  @ApiOperation({
    summary: 'List writable inverter settings',
    description:
      'Each field carries the input type clients should render, so no client hard-codes inverter semantics.',
  })
  @ApiOkResponse({ type: [ControlFieldDto] })
  listFields(@Query() device: DeviceRefDto): Promise<ControlFieldDto[]> {
    return this.controls.listFields(device);
  }

  @Get('fields/:fieldId/value')
  @ApiOperation({ summary: 'Read the value currently stored on the inverter' })
  @ApiOkResponse({ type: ControlValueDto })
  readValue(
    @Param('fieldId') fieldId: string,
    @Query() device: DeviceRefDto,
  ): Promise<ControlValueDto> {
    return this.controls.readValue(device, fieldId);
  }

  @Put('fields/:fieldId/value')
  @ApiOperation({
    summary: 'Write a single inverter setting',
    description:
      'This changes physical hardware behaviour. Clients should confirm with the user before calling it.',
  })
  @ApiOkResponse({ type: ControlWriteResultDto })
  writeValue(
    @Param('fieldId') fieldId: string,
    @Body() body: SetControlValueDto,
  ): Promise<ControlWriteResultDto> {
    return this.controls.writeValue(body.device, fieldId, body.value);
  }

  @Get('profiles/preferred')
  @ApiOperation({
    summary: 'Describe the preferred profile without applying it',
  })
  describeProfile(): { steps: typeof PREFERRED_PROFILE } {
    return { steps: PREFERRED_PROFILE };
  }

  @Post('profiles/preferred')
  @ApiOperation({
    summary: 'Apply the preferred profile',
    description:
      'Writes the profile settings sequentially and reports the outcome of each step.',
  })
  @ApiOkResponse({ type: ProfileResultDto })
  applyProfile(@Body() body: ApplyProfileDto): Promise<ProfileResultDto> {
    return this.controls.applyPreferredProfile(body.device);
  }
}
