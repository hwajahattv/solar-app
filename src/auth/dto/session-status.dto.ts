import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SessionStatusDto {
  @ApiProperty({
    description:
      'Whether the gateway is configured to accept logins (AUTH_SECRET and DATABASE_URL)',
  })
  configured!: boolean;

  @ApiProperty({
    description:
      'Whether this request is authenticated with a valid Bearer token',
  })
  authenticated!: boolean;

  @ApiPropertyOptional({ description: 'ShineMonitor account in use' })
  username?: string;

  @ApiPropertyOptional({ description: 'ShineMonitor user id' })
  uid?: string;

  @ApiPropertyOptional({
    description:
      'ISO timestamp at which the upstream ShineMonitor token expires',
  })
  expiresAt?: string;

  @ApiPropertyOptional({
    description: 'ISO timestamp at which this gateway Bearer session expires',
  })
  gatewayExpiresAt?: string;

  @ApiPropertyOptional({ description: 'Reason authentication is unavailable' })
  error?: string;
}
