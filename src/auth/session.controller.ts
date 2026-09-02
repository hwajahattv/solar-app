import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import type { AuthPrincipal } from './auth.types';
import { SessionStatusDto } from './dto/session-status.dto';
import { Public } from './public.decorator';
import { ShineSessionService } from '../shine/shine-session.service';

@ApiTags('session')
@Controller('session')
export class SessionController {
  constructor(
    private readonly auth: AuthService,
    private readonly shineSession: ShineSessionService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Report gateway and upstream session state',
    description:
      'Clients poll this on start-up. Without a Bearer token it reports unauthenticated so the login screen can be shown. No secrets are returned.',
  })
  @ApiOkResponse({ type: SessionStatusDto })
  async status(
    @CurrentUser() user: AuthPrincipal | undefined,
  ): Promise<SessionStatusDto> {
    return this.describeSession(user);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Force a new ShineMonitor login for the current user',
  })
  @ApiOkResponse({ type: SessionStatusDto })
  async refresh(@CurrentUser() user: AuthPrincipal): Promise<SessionStatusDto> {
    try {
      await this.shineSession.ensure(true);
    } catch {
      // describeSession reports the failure.
    }
    return this.describeSession(user);
  }

  private async describeSession(
    user: AuthPrincipal | undefined,
  ): Promise<SessionStatusDto> {
    if (!this.auth.isConfigured) {
      return {
        configured: false,
        authenticated: false,
        error: 'AUTH_SECRET / DATABASE_URL are not set on the server',
      };
    }

    if (!user) {
      return { configured: true, authenticated: false };
    }

    try {
      const session = await this.shineSession.ensure();
      return {
        configured: true,
        authenticated: true,
        username: session.usr,
        uid: session.uid,
        expiresAt: new Date(
          session.issuedAt + session.expire * 1000,
        ).toISOString(),
        gatewayExpiresAt: user.gatewayExpiresAt.toISOString(),
      };
    } catch (error) {
      return {
        configured: true,
        authenticated: Boolean(user),
        username: user?.username,
        uid: user?.shineUid,
        gatewayExpiresAt: user?.gatewayExpiresAt.toISOString(),
        error:
          error instanceof Error ? error.message : 'ShineMonitor login failed',
      };
    }
  }
}
