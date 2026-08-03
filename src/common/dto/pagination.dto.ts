import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationDto {
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
}
