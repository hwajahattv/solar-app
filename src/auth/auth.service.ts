import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { Request } from 'express';
import type { User } from '@prisma/client';

import type { AuthConfig } from '../config/configuration';
import { PrismaService } from '../database/prisma.service';
import { ShineSessionService } from '../shine/shine-session.service';
import type { ShineSession } from '../shine/shine.types';
import { encryptSecret, hashToken } from './credentials-crypto';
import type { AuthPrincipal } from './auth.types';
import { LoginResponseDto } from './dto/login-response.dto';
import { UserSummaryDto } from './dto/user-summary.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly authConfig: AuthConfig;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly shineSession: ShineSessionService,
  ) {
    this.authConfig = config.getOrThrow<AuthConfig>('auth');
  }

  get isConfigured(): boolean {
    return this.prisma.enabled && Boolean(this.authConfig.secret);
  }

  async login(username: string, password: string): Promise<LoginResponseDto> {
    this.assertReady();

    const shine = await this.shineSession.authenticate(username, password);
    const user = await this.upsertUser(username, password, shine);
    this.shineSession.remember(user.id, shine);
    const { accessToken, expiresAt } = await this.issueSession(user.id);

    this.logger.log(
      `Gateway login for ${user.username} (uid ${user.shineUid})`,
    );

    return {
      accessToken,
      expiresAt: expiresAt.toISOString(),
      userId: user.id,
      username: user.username,
      shineUid: user.shineUid,
    };
  }

  async logout(principal: AuthPrincipal | undefined): Promise<void> {
    if (!principal || !this.prisma.enabled) return;

    await this.prisma.userSession.updateMany({
      where: { id: principal.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.shineSession.invalidate(principal.userId);
  }

  async listUsers(): Promise<UserSummaryDto[]> {
    this.assertReady();

    const users = await this.prisma.user.findMany({
      orderBy: { lastLoginAt: 'desc' },
    });

    return users.map((user) => this.toSummary(user));
  }

  async currentUser(principal: AuthPrincipal): Promise<UserSummaryDto> {
    this.assertReady();

    const user = await this.prisma.user.findUnique({
      where: { id: principal.userId },
    });
    if (!user) {
      throw new UnauthorizedException('Account is no longer registered');
    }
    return this.toSummary(user);
  }

  async resolveFromRequest(request: Request): Promise<AuthPrincipal | null> {
    const token = readAccessToken(request);
    if (!token || !this.prisma.enabled) return null;

    const tokenHash = hashToken(token);
    const session = await this.prisma.userSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      return null;
    }

    return {
      sessionId: session.id,
      userId: session.user.id,
      username: session.user.username,
      shineUid: session.user.shineUid,
      gatewayExpiresAt: session.expiresAt,
    };
  }

  async listActiveUsers(): Promise<AuthPrincipal[]> {
    this.assertReady();

    const users = await this.prisma.user.findMany({
      orderBy: { lastLoginAt: 'desc' },
    });

    return users.map((user) => ({
      sessionId: `cron:${user.id}`,
      userId: user.id,
      username: user.username,
      shineUid: user.shineUid,
      gatewayExpiresAt: new Date(Date.now() + this.authConfig.sessionTtlMs),
    }));
  }

  private async upsertUser(
    username: string,
    password: string,
    shine: ShineSession,
  ): Promise<User> {
    const passwordCipher = encryptSecret(password, this.authConfig.secret);
    const shineTokenCipher = encryptSecret(shine.token, this.authConfig.secret);
    const shineSecretCipher = encryptSecret(
      shine.secret,
      this.authConfig.secret,
    );
    const now = new Date();

    return this.prisma.user.upsert({
      where: { username },
      create: {
        username,
        shineUid: shine.uid,
        passwordCipher,
        shineTokenCipher,
        shineSecretCipher,
        shineExpireSeconds: shine.expire,
        shineIssuedAt: new Date(shine.issuedAt),
        lastLoginAt: now,
      },
      update: {
        shineUid: shine.uid,
        passwordCipher,
        shineTokenCipher,
        shineSecretCipher,
        shineExpireSeconds: shine.expire,
        shineIssuedAt: new Date(shine.issuedAt),
        lastLoginAt: now,
      },
    });
  }

  private async issueSession(
    userId: string,
  ): Promise<{ accessToken: string; expiresAt: Date }> {
    const accessToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.authConfig.sessionTtlMs);

    await this.prisma.userSession.create({
      data: {
        userId,
        tokenHash: hashToken(accessToken),
        expiresAt,
      },
    });

    return { accessToken, expiresAt };
  }

  private toSummary(user: User): UserSummaryDto {
    return {
      id: user.id,
      username: user.username,
      shineUid: user.shineUid,
      lastLoginAt: user.lastLoginAt.toISOString(),
      createdAt: user.createdAt.toISOString(),
      shineSessionIssuedAt: user.shineIssuedAt?.toISOString(),
    };
  }

  private assertReady(): void {
    if (!this.prisma.enabled) {
      throw new ServiceUnavailableException(
        'DATABASE_URL is not configured — user login cannot be stored',
      );
    }
    if (!this.authConfig.secret) {
      throw new ServiceUnavailableException(
        'AUTH_SECRET is not configured — user sessions cannot be issued',
      );
    }
  }
}

export function readAccessToken(request: Request): string | undefined {
  const header = request.header('authorization') ?? '';
  if (header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    if (token) return token;
  }

  const query = request.query?.access_token;
  if (typeof query === 'string' && query.trim()) {
    return query.trim();
  }

  return undefined;
}
