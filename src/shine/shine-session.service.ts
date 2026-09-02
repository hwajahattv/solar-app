import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { requireAuthPrincipal } from '../auth/auth-context';
import { decryptSecret, encryptSecret } from '../auth/credentials-crypto';
import type { AuthConfig, ShineConfig } from '../config/configuration';
import { PrismaService } from '../database/prisma.service';
import { ShineHttpService } from './shine-http.service';
import { buildLoginData, signLogin } from './shine.signature';
import type { ShineSession } from './shine.types';

/** Refresh the token this many ms before the upstream expiry to avoid races. */
export const EXPIRY_SAFETY_MARGIN_MS = 60_000;

interface LoginPayload {
  secret: string;
  token: string;
  uid: string;
  usr: string;
  expire: number;
}

export function isShineSessionFresh(
  session: ShineSession,
  now = Date.now(),
): boolean {
  const expiresAt =
    session.issuedAt + session.expire * 1000 - EXPIRY_SAFETY_MARGIN_MS;
  return now < expiresAt;
}

/**
 * Owns per-user upstream ShineMonitor sessions. Credentials stay on the server
 * (encrypted at rest). Each API request runs in an auth context so telemetry
 * and device calls use that user's token, not a shared env account.
 */
@Injectable()
export class ShineSessionService {
  private readonly logger = new Logger(ShineSessionService.name);
  private readonly shineConfig: ShineConfig;
  private readonly authConfig: AuthConfig;
  private readonly cache = new Map<string, ShineSession>();
  private readonly loginInFlight = new Map<string, Promise<ShineSession>>();

  constructor(
    configService: ConfigService,
    private readonly http: ShineHttpService,
    private readonly prisma: PrismaService,
  ) {
    this.shineConfig = configService.getOrThrow<ShineConfig>('shine');
    this.authConfig = configService.getOrThrow<AuthConfig>('auth');
  }

  remember(userId: string, session: ShineSession): void {
    this.cache.set(userId, session);
  }

  invalidate(userId?: string): void {
    if (userId) {
      this.cache.delete(userId);
      return;
    }
    this.cache.clear();
  }

  /** Returns a valid ShineMonitor session for the request's authenticated user. */
  async ensure(forceRefresh = false): Promise<ShineSession> {
    const principal = requireAuthPrincipal();
    const userId = principal.userId;

    if (!forceRefresh) {
      const cached = this.cache.get(userId);
      if (cached && isShineSessionFresh(cached)) return cached;
    }

    const inflight = this.loginInFlight.get(userId);
    if (inflight) return inflight;

    const task = this.ensureForUser(userId, forceRefresh).finally(() => {
      this.loginInFlight.delete(userId);
    });
    this.loginInFlight.set(userId, task);
    return task;
  }

  /**
   * Validates ShineMonitor credentials and returns a fresh upstream session.
   * Does not persist — callers (login) own the User row.
   */
  async authenticate(
    username: string,
    password: string,
  ): Promise<ShineSession> {
    const salt = Date.now().toString();
    const data = buildLoginData(username, this.shineConfig.companyKey);
    const sign = signLogin(salt, password, data);
    const url = `${this.http.baseUrl}?sign=${sign}&salt=${salt}${data}`;

    this.logger.log(`Signing in to ShineMonitor as ${username}`);
    const { response } = await this.http.get<LoginPayload>(url);

    if (response.err !== 0 || !response.dat?.token) {
      throw new UnauthorizedException(
        `ShineMonitor login failed: ${response.desc ?? `err ${response.err}`}`,
      );
    }

    const payload = response.dat;
    const session: ShineSession = {
      secret: payload.secret,
      token: payload.token,
      uid: String(payload.uid),
      usr: payload.usr ?? username,
      expire: Number(payload.expire),
      issuedAt: Date.now(),
    };

    this.logger.log(`Signed in as ${session.usr} (uid ${session.uid})`);
    return session;
  }

  private async ensureForUser(
    userId: string,
    forceRefresh: boolean,
  ): Promise<ShineSession> {
    const stored = await this.loadStored(userId);

    if (
      !forceRefresh &&
      stored.session &&
      isShineSessionFresh(stored.session)
    ) {
      this.cache.set(userId, stored.session);
      return stored.session;
    }

    const session = await this.authenticate(stored.username, stored.password);
    await this.persistSession(userId, session);
    this.cache.set(userId, session);
    return session;
  }

  private async loadStored(userId: string): Promise<{
    username: string;
    password: string;
    session: ShineSession | null;
  }> {
    if (!this.prisma.enabled) {
      throw new UnauthorizedException(
        'DATABASE_URL is not configured — cannot restore a ShineMonitor session',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Unknown user');
    }

    let password: string;
    try {
      password = decryptSecret(user.passwordCipher, this.authConfig.secret);
    } catch {
      throw new UnauthorizedException(
        'Stored credentials cannot be decrypted — sign in again',
      );
    }

    if (
      !user.shineTokenCipher ||
      !user.shineSecretCipher ||
      !user.shineExpireSeconds ||
      !user.shineIssuedAt
    ) {
      return { username: user.username, password, session: null };
    }

    try {
      return {
        username: user.username,
        password,
        session: {
          secret: decryptSecret(user.shineSecretCipher, this.authConfig.secret),
          token: decryptSecret(user.shineTokenCipher, this.authConfig.secret),
          uid: user.shineUid,
          usr: user.username,
          expire: user.shineExpireSeconds,
          issuedAt: user.shineIssuedAt.getTime(),
        },
      };
    } catch {
      return { username: user.username, password, session: null };
    }
  }

  private async persistSession(
    userId: string,
    session: ShineSession,
  ): Promise<void> {
    if (!this.prisma.enabled) return;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        shineUid: session.uid,
        shineTokenCipher: encryptSecret(session.token, this.authConfig.secret),
        shineSecretCipher: encryptSecret(
          session.secret,
          this.authConfig.secret,
        ),
        shineExpireSeconds: session.expire,
        shineIssuedAt: new Date(session.issuedAt),
      },
    });
  }
}
