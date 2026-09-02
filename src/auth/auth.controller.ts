import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import type { AuthPrincipal } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { UserSummaryDto } from './dto/user-summary.dto';
import { Public } from './public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in with ShineMonitor credentials',
    description:
      'Validates the username and password against ShineMonitor, records the user, and returns a gateway Bearer token. Subsequent device and telemetry calls use this account.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  login(@Body() body: LoginDto): Promise<LoginResponseDto> {
    return this.auth.login(body.username.trim(), body.password);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the current gateway session' })
  async logout(
    @CurrentUser() user: AuthPrincipal | undefined,
  ): Promise<{ ok: true }> {
    await this.auth.logout(user);
    return { ok: true };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The ShineMonitor account bound to this session' })
  @ApiOkResponse({ type: UserSummaryDto })
  me(@CurrentUser() user: AuthPrincipal): Promise<UserSummaryDto> {
    return this.auth.currentUser(user);
  }

  @Get('users')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Accounts that have signed in through this gateway',
    description:
      'Does not include passwords, tokens or ShineMonitor secrets. Useful for an admin table of who has used the dashboard.',
  })
  @ApiOkResponse({ type: [UserSummaryDto] })
  users(): Promise<UserSummaryDto[]> {
    return this.auth.listUsers();
  }
}
