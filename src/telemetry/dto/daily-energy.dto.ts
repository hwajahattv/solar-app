import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

import { DeviceRefDto } from '../../common/dto/device-ref.dto';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class DailyEnergyQueryDto extends DeviceRefDto {
  @ApiPropertyOptional({
    description: 'Start day (inclusive), YYYY-MM-DD in application timezone',
    example: '2026-08-01',
  })
  @IsOptional()
  @IsString()
  @Matches(DAY_PATTERN)
  from?: string;

  @ApiPropertyOptional({
    description: 'End day (inclusive), YYYY-MM-DD in application timezone',
    example: '2026-08-05',
  })
  @IsOptional()
  @IsString()
  @Matches(DAY_PATTERN)
  to?: string;
}

export class DailyEnergyRecordDto {
  @ApiProperty({ example: '2026-08-04' })
  day!: string;

  @ApiProperty({ nullable: true, example: 6.556 })
  generatedTodayKwh!: number | null;

  @ApiProperty({ nullable: true, example: 5.548 })
  consumedTodayKwh!: number | null;

  @ApiProperty({ nullable: true, example: 1.2 })
  batteryChargedTodayKwh!: number | null;

  @ApiProperty({ nullable: true, example: 0.8 })
  batteryDischargedTodayKwh!: number | null;

  @ApiProperty({ example: '2026-08-04T10:15:00.000Z' })
  computedAt!: string;
}

export class DailyEnergyHistoryDto {
  @ApiProperty({ example: '2026-08-01' })
  from!: string;

  @ApiProperty({ example: '2026-08-05' })
  to!: string;

  @ApiProperty({ type: [DailyEnergyRecordDto] })
  records!: DailyEnergyRecordDto[];
}
