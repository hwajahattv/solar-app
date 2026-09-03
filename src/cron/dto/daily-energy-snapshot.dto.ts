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

  @ApiProperty({
    example: 1,
    description: 'ShineMonitor accounts included in this run',
  })
  accounts!: number;

  @ApiProperty({ example: 1 })
  devices!: number;

  @ApiProperty({ example: 1 })
  saved!: number;

  @ApiProperty({ example: 0 })
  failed!: number;

  @ApiProperty({ type: [DailyEnergySnapshotDeviceResultDto] })
  results!: DailyEnergySnapshotDeviceResultDto[];

  @ApiPropertyOptional()
  runId?: string;

  @ApiPropertyOptional({
    description: 'ISO timestamp when this invocation started',
  })
  invokedAt?: string;

  @ApiPropertyOptional({
    description: 'vercel-cron when Vercel called the route; manual otherwise',
  })
  trigger?: string;

  @ApiPropertyOptional({
    description: 'x-vercel-cron-schedule header, when present',
  })
  schedule?: string;

  @ApiPropertyOptional()
  note?: string;
}

export class CronRunDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  day!: string;

  @ApiProperty()
  trigger!: string;

  @ApiPropertyOptional()
  schedule?: string | null;

  @ApiPropertyOptional()
  userAgent?: string | null;

  @ApiProperty()
  startedAt!: string;

  @ApiProperty()
  finishedAt!: string;

  @ApiProperty()
  accounts!: number;

  @ApiProperty()
  devices!: number;

  @ApiProperty()
  saved!: number;

  @ApiProperty()
  failed!: number;

  @ApiPropertyOptional()
  error?: string | null;
}
