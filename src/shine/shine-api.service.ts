import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { ShineConfig } from '../config/configuration';
import { ShineHttpService } from './shine-http.service';
import { ShineSessionService } from './shine-session.service';
import { buildData, signCall } from './shine.signature';
import type { ShineCallResult, ShineParams } from './shine.types';

/** Upstream descriptions that indicate the cached token is no longer accepted. */
const AUTH_ERROR_PATTERN = /auth|token|expire|forbid/i;

@Injectable()
export class ShineApiService {
  private readonly logger = new Logger(ShineApiService.name);
  private readonly config: ShineConfig;

  constructor(
    configService: ConfigService,
    private readonly http: ShineHttpService,
    private readonly session: ShineSessionService,
  ) {
    this.config = configService.getOrThrow<ShineConfig>('shine');
  }

  get locale(): string {
    return this.config.locale;
  }

  /** Performs one signed call, transparently re-authenticating once on token errors. */
  async call<T>(
    action: string,
    params: ShineParams = {},
  ): Promise<ShineCallResult<T>> {
    let result = await this.signedCall<T>(action, params);

    if (
      result.response.err !== 0 &&
      AUTH_ERROR_PATTERN.test(result.response.desc ?? '')
    ) {
      this.logger.warn(
        `${action} rejected (${result.response.desc}) — refreshing session and retrying`,
      );
      await this.session.ensure(true);
      result = await this.signedCall<T>(action, params);
    }

    return result;
  }

  /**
   * Like {@link call} but throws when the upstream reports a business error, so
   * feature services can assume a successful payload.
   */
  async callOrThrow<T>(action: string, params: ShineParams = {}): Promise<T> {
    const result = await this.call<T>(action, params);

    if (result.response.err !== 0) {
      throw new BadGatewayException(
        result.response.desc ??
          `ShineMonitor rejected ${action} (err ${result.response.err})`,
      );
    }

    return (result.response.dat ?? {}) as T;
  }

  /** Tries each action in order and returns the first successful response. */
  async callFirstSupported<T>(
    actions: string[],
    params: ShineParams = {},
  ): Promise<ShineCallResult<T>> {
    let lastResult: ShineCallResult<T> | null = null;

    for (const action of actions) {
      lastResult = await this.call<T>(action, params);
      if (lastResult.response.err === 0) return lastResult;

      const unsupported = /action|not found|can not found|forbid/i.test(
        lastResult.response.desc ?? '',
      );
      if (!unsupported) return lastResult;
    }

    return lastResult as ShineCallResult<T>;
  }

  private async signedCall<T>(
    action: string,
    params: ShineParams,
  ): Promise<ShineCallResult<T>> {
    const session = await this.session.ensure();
    const salt = Date.now().toString();
    const data = buildData(action, params);
    const sign = signCall(salt, session.secret, session.token, data);
    const url = `${this.http.baseUrl}?sign=${sign}&salt=${salt}&token=${encodeURIComponent(session.token)}${data}`;

    return this.http.get<T>(url);
  }
}
