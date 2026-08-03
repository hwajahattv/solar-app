import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SessionStatusDto {
  @ApiProperty({
    description: 'Whether ShineMonitor credentials are present on the server',
  })
  configured!: boolean;

  @ApiProperty({
    description: 'Whether the server currently holds a valid upstream session',
  })
  authenticated!: boolean;

  @ApiPropertyOptional({ description: 'ShineMonitor account in use' })
  username?: string;

  @ApiPropertyOptional({ description: 'ShineMonitor user id' })
  uid?: string;

  @ApiPropertyOptional({
    description: 'ISO timestamp at which the upstream token expires',
  })
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Reason authentication is unavailable' })
  error?: string;
}
