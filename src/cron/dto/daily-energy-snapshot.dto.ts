import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DailyEnergySnapshotDeviceResultDto {
  @ApiProperty()
  pn!: string;

  @ApiProperty()
  sn!: string;

  @ApiProperty()
  success!: boolean;

  @ApiPropertyOptional({ example: 6.556 })
  generatedTodayKwh?: number | null;

  @ApiPropertyOptional({ example: 5.548 })
  consumedTodayKwh?: number | null;

  @ApiPropertyOptional()
  error?: string;
}

export class DailyEnergySnapshotResultDto {
  @ApiProperty({ example: '2026-08-05' })
  day!: string;

  @ApiProperty({ example: 1 })
  devices!: number;

  @ApiProperty({ example: 1 })
  saved!: number;

  @ApiProperty({ example: 0 })
  failed!: number;

  @ApiProperty({ type: [DailyEnergySnapshotDeviceResultDto] })
  results!: DailyEnergySnapshotDeviceResultDto[];
}
