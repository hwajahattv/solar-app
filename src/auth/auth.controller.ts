import { Controller, Get, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ShineSessionService } from '../shine/shine-session.service';
import { SessionStatusDto } from './dto/session-status.dto';

@ApiTags('session')
@Controller('session')
export class AuthController {
  constructor(private readonly session: ShineSessionService) {}

  @Get()
  @ApiOperation({
    summary: 'Report upstream session state',
    description:
      'Clients poll this on start-up to decide whether the dashboard can be shown. No secrets are returned.',
  })
  @ApiOkResponse({ type: SessionStatusDto })
  async status(): Promise<SessionStatusDto> {
    return this.describeSession();
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Force a new ShineMonitor login' })
  @ApiOkResponse({ type: SessionStatusDto })
  async refresh(): Promise<SessionStatusDto> {
    if (this.session.isConfigured) {
      try {
        await this.session.ensure(true);
      } catch {
        // Fall through — describeSession reports the failure to the caller.
      }
    }
    return this.describeSession();
  }

  private async describeSession(): Promise<SessionStatusDto> {
    if (!this.session.isConfigured) {
      return {
        configured: false,
        authenticated: false,
        error: 'SHINE_USR / SHINE_PWD are not set on the server',
      };
    }

    try {
      const session = await this.session.ensure();
      return {
        configured: true,
        authenticated: true,
        username: session.usr,
        uid: session.uid,
        expiresAt: new Date(
          session.issuedAt + session.expire * 1000,
        ).toISOString(),
      };
    } catch (error) {
      return {
        configured: true,
        authenticated: false,
        error: error instanceof Error ? error.message : 'Login failed',
      };
    }
  }
}
