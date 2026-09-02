import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty()
  shineUid!: string;

  @ApiProperty()
  lastLoginAt!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiPropertyOptional({
    description: 'ISO timestamp of the last successful ShineMonitor token',
  })
  shineSessionIssuedAt?: string;
}
