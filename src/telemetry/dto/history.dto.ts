import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

import { DeviceRefDto } from '../../common/dto/device-ref.dto';

/**
 * Extends {@link DeviceRefDto} so pn/sn/devcode/devaddr survive the global
 * ValidationPipe whitelist (properties need class-validator decorators).
 */
export class HistoryQueryDto extends DeviceRefDto {
  @ApiPropertyOptional({ description: 'Zero-based page index', default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  page: number = 0;

  @ApiPropertyOptional({
    description: 'Rows per page',
    default: 15,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize: number = 15;

  @ApiPropertyOptional({
    description: 'Log day in YYYY-MM-DD form. Defaults to today.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be formatted as YYYY-MM-DD',
  })
  date?: string;
}

export class HistoryColumnDto {
  @ApiProperty({
    description: 'Position of the column in the raw upstream row',
  })
  index!: number;

  @ApiProperty() title!: string;

  @ApiProperty({
    description: 'True when every row on the page shares the same value',
  })
  constant!: boolean;

  @ApiProperty({
    description: 'True when the column carries no display value (ids, serials)',
  })
  hidden!: boolean;
}

export class HistoryRowDto {
  @ApiProperty() index!: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Value of the detected timestamp column',
  })
  timestamp!: string | null;

  @ApiProperty({
    type: [String],
    description: 'Cell values aligned with the columns array',
  })
  values!: Array<string | null>;
}

export class HistorySummaryItemDto {
  @ApiProperty() label!: string;
  @ApiProperty({ type: String, nullable: true }) value!: string | null;
}

export class HistoryPageDto {
  @ApiProperty() date!: string;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() total!: number;

  @ApiProperty({
    description: 'Index of the column that holds the log timestamp',
  })
  timestampColumnIndex!: number;

  @ApiProperty({ type: [HistoryColumnDto] }) columns!: HistoryColumnDto[];
  @ApiProperty({ type: [HistoryRowDto] }) rows!: HistoryRowDto[];

  @ApiProperty({
    type: [HistorySummaryItemDto],
    description: 'Values that are constant across the page',
  })
  summary!: HistorySummaryItemDto[];
}
