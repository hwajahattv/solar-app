import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { ShineConfig } from '../config/configuration';
import { ShineHttpService } from './shine-http.service';
import { buildLoginData, signLogin } from './shine.signature';
import type { ShineSession } from './shine.types';

/** Refresh the token this many ms before the upstream expiry to avoid races. */
const EXPIRY_SAFETY_MARGIN_MS = 60_000;

interface LoginPayload {
  secret: string;
  token: string;
  uid: string;
  usr: string;
  expire: number;
}

/**
 * Owns the single upstream session shared by all clients. Credentials never
 * leave this process, so browsers, mobile apps and TV clients all authenticate
 * against our own API instead of handling ShineMonitor secrets themselves.
 */
@Injectable()
export class ShineSessionService {
  private readonly logger = new Logger(ShineSessionService.name);
  private readonly config: ShineConfig;
  private session: ShineSession | null = null;
  private loginInFlight: Promise<ShineSession> | null = null;

  constructor(
    configService: ConfigService,
    private readonly http: ShineHttpService,
  ) {
    this.config = configService.getOrThrow<ShineConfig>('shine');
  }

  get isConfigured(): boolean {
    return Boolean(this.config.username && this.config.password);
  }

  get current(): ShineSession | null {
    return this.session;
  }

  /** Returns a valid session, logging in or refreshing when required. */
  async ensure(forceRefresh = false): Promise<ShineSession> {
    if (!forceRefresh && this.session && this.isFresh(this.session)) {
      return this.session;
    }

    // De-duplicate concurrent logins so a burst of requests triggers one call.
    this.loginInFlight ??= this.login().finally(() => {
      this.loginInFlight = null;
    });

    return this.loginInFlight;
  }

  invalidate(): void {
    this.session = null;
  }

  private isFresh(session: ShineSession): boolean {
    const expiresAt =
      session.issuedAt + session.expire * 1000 - EXPIRY_SAFETY_MARGIN_MS;
    return Date.now() < expiresAt;
  }

  private async login(): Promise<ShineSession> {
    if (!this.isConfigured) {
      throw new UnauthorizedException(
        'SHINE_USR / SHINE_PWD are not configured on the server',
      );
    }

    const salt = Date.now().toString();
    const data = buildLoginData(this.config.username, this.config.companyKey);
    const sign = signLogin(salt, this.config.password, data);
    const url = `${this.http.baseUrl}?sign=${sign}&salt=${salt}${data}`;

    this.logger.log(`Signing in to ShineMonitor as ${this.config.username}`);
    const { response } = await this.http.get<LoginPayload>(url);

    if (response.err !== 0 || !response.dat?.token) {
      throw new UnauthorizedException(
        `ShineMonitor login failed: ${response.desc ?? `err ${response.err}`}`,
      );
    }

    const payload = response.dat;
    this.session = {
      secret: payload.secret,
      token: payload.token,
      uid: String(payload.uid),
      usr: payload.usr,
      expire: Number(payload.expire),
      issuedAt: Date.now(),
    };

    this.logger.log(
      `Signed in as ${this.session.usr} (uid ${this.session.uid})`,
    );
    return this.session;
  }
}
