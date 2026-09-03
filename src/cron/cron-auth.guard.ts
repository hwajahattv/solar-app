import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class CronAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get<string>('cron.secret')?.trim() ?? '';
    if (!secret) {
      throw new UnauthorizedException(
        'CRON_SECRET is not set on the server. Add it in Vercel Project Settings → Environment Variables (Production) and redeploy. Vercel then sends Authorization: Bearer <CRON_SECRET>.',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.header('authorization') ?? '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const explicit = request.header('x-cron-secret')?.trim() ?? '';

    if (bearer === secret || explicit === secret) return true;

    throw new UnauthorizedException(
      'Invalid cron credentials. Send Authorization: Bearer <CRON_SECRET> (Vercel Cron does this automatically when CRON_SECRET is set).',
    );
  }
}
