import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';

import { DeviceRefDto } from '../../common/dto/device-ref.dto';

/**
 * How a client should render the field. Derived server-side from the option
 * count so web, mobile and TV clients stay visually consistent.
 */
export type ControlInputType = 'toggle' | 'select' | 'text';

export class ControlOptionDto {
  @ApiProperty({ description: 'Value to send back when applying the setting' })
  value!: string;

  @ApiProperty({ description: 'Localised label from the inverter' })
  label!: string;
}

export class ControlFieldDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;

  @ApiPropertyOptional({ type: String, nullable: true }) hint!: string | null;

  @ApiProperty({ enum: ['toggle', 'select', 'text'] })
  inputType!: ControlInputType;

  @ApiProperty({ type: [ControlOptionDto] })
  options!: ControlOptionDto[];
}

export class ControlValueDto {
  @ApiProperty() fieldId!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Current raw value reported by the inverter',
  })
  value!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Matching option label when the value is an enum',
  })
  label!: string | null;
}

export class SetControlValueDto {
  @ApiProperty({ type: DeviceRefDto })
  @ValidateNested()
  @Type(() => DeviceRefDto)
  device!: DeviceRefDto;

  @ApiProperty({
    description: 'Option value or raw text to write to the inverter',
  })
  @IsString()
  @IsNotEmpty()
  value!: string;
}

export class ApplyProfileDto {
  @ApiProperty({ type: DeviceRefDto })
  @ValidateNested()
  @Type(() => DeviceRefDto)
  device!: DeviceRefDto;
}

export class ControlWriteResultDto {
  @ApiProperty() fieldId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() value!: string;

  @ApiPropertyOptional({ type: String, nullable: true }) label!: string | null;

  @ApiProperty() success!: boolean;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Upstream description when the write failed',
  })
  message!: string | null;
}

export class ProfileResultDto {
  @ApiProperty() applied!: number;
  @ApiProperty() total!: number;
  @ApiProperty({ type: [ControlWriteResultDto] })
  steps!: ControlWriteResultDto[];
}
