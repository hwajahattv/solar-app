import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

import type { ShineParams } from '../../shine/shine.types';

export class RawCallDto {
  @ApiProperty({
    description: 'ShineMonitor action name',
    example: 'querySPDeviceLastData',
  })
  @IsString()
  @IsNotEmpty()
  action!: string;

  @ApiPropertyOptional({
    description: 'Query parameters merged into the signed payload',
  })
  @IsObject()
  @IsOptional()
  params?: ShineParams;
}
