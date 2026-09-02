import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'ShineMonitor username' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  username!: string;

  @ApiProperty({ description: 'ShineMonitor password' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  password!: string;
}
