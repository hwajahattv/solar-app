import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({
    description: 'Bearer token for subsequent API calls',
  })
  accessToken!: string;

  @ApiProperty({ description: 'When this gateway session expires (ISO)' })
  expiresAt!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty()
  shineUid!: string;
}
