import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

import { DeviceRefDto } from '../../common/dto/device-ref.dto';

export class ChartFieldsQueryDto extends DeviceRefDto {
  @ApiPropertyOptional({
    description: 'Locale for field titles',
    default: 'en_US',
    example: 'en_US',
  })
  @IsOptional()
  @IsString()
  lang?: string;
}

export class ChartSeriesQueryDto extends DeviceRefDto {
  @ApiProperty({
    description:
      'Comma-separated chart field ids from GET /charts/fields (max 8, deduped)',
    example: 'output_power,bt_load_active_power_sole',
  })
  @IsString()
  @IsNotEmpty()
  fields!: string;

  @ApiProperty({
    description:
      'Range start as YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss (local wall time)',
    example: '2026-08-04',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$/, {
    message: 'from must be YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss',
  })
  from!: string;

  @ApiProperty({
    description:
      'Range end as YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss (local wall time)',
    example: '2026-08-04',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$/, {
    message: 'to must be YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss',
  })
  to!: string;

  @ApiPropertyOptional({
    description: 'Sampling interval in minutes',
    default: 5,
    minimum: 1,
    maximum: 60,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  @IsOptional()
  precision: number = 5;
}

export class ChartFieldDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() unit!: string;
  @ApiProperty({
    description: 'Normalized unit bucket for picker grouping',
    example: 'kW',
  })
  group!: string;
}

export class ChartFieldsResponseDto {
  @ApiProperty({ type: [ChartFieldDto] })
  fields!: ChartFieldDto[];
}

export class ChartPointDto {
  @ApiProperty({ description: 'Local wall-time timestamp YYYY-MM-DD HH:mm:ss' })
  t!: string;

  @ApiProperty({ nullable: true, type: Number })
  v!: number | null;
}

export class ChartSeriesDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() unit!: string;
  @ApiProperty({ type: [ChartPointDto] })
  points!: ChartPointDto[];
}

export class ChartSeriesResponseDto {
  @ApiProperty() from!: string;
  @ApiProperty() to!: string;
  @ApiProperty() precisionMinutes!: number;
  @ApiProperty({ type: [ChartSeriesDto] })
  series!: ChartSeriesDto[];
}
