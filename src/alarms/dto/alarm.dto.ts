import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { DeviceRefDto } from '../../common/dto/device-ref.dto';

/** Same whitelist-safe pattern as {@link HistoryQueryDto}. */
export class AlarmQueryDto extends DeviceRefDto {
  @ApiPropertyOptional({ default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  page: number = 0;

  @ApiPropertyOptional({ default: 10, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize: number = 10;
}

export class AlarmDto {
  @ApiProperty() title!: string;

  @ApiPropertyOptional({ type: String, nullable: true }) description!:
    string | null;

  @ApiProperty({ description: 'True while the alarm has not been cleared' })
  active!: boolean;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'ISO timestamp when the alarm was raised',
  })
  startedAt!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'ISO timestamp when the alarm cleared',
  })
  clearedAt!: string | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description:
      'Duration in ms for cleared alarms. Null while active so clients can tick a live counter from startedAt.',
  })
  durationMs!: number | null;

  @ApiPropertyOptional({ type: String, nullable: true }) code!: string | null;
}

export class AlarmPageDto {
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() total!: number;
  @ApiProperty({ type: [AlarmDto] }) alarms!: AlarmDto[];
}
