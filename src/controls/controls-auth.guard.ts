import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import {
  readControlsToken,
  verifyControlsToken,
} from './controls-auth.util';

@Injectable()
export class ControlsAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const password = this.config.get<string>('controls.password') ?? '';
    const secret = this.config.get<string>('controls.secret') ?? '';

    // Local/dev deployments can omit the password; production should set it.
    if (!password || !secret) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const headerToken = request.header('x-knox-controls-token');
    const cookieToken = readControlsToken(request.headers.cookie);
    const token = headerToken ?? cookieToken;

    if (!verifyControlsToken(token, secret)) {
      throw new UnauthorizedException('Controls access required');
    }

    return true;
  }
}
