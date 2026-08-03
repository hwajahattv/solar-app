import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { ShineConfig } from '../config/configuration';
import { redactUrl } from './shine.signature';
import type { ShineEnvelope } from './shine.types';

interface RawResponse<T> {
  httpStatus: number;
  response: ShineEnvelope<T>;
  redactedUrl: string;
}

/**
 * Thin transport layer for the ShineMonitor endpoint. It owns timeouts, JSON
 * parsing and error translation only — signing and session handling live in
 * dedicated services so each concern can be tested in isolation.
 */
@Injectable()
export class ShineHttpService {
  private readonly logger = new Logger(ShineHttpService.name);
  private readonly config: ShineConfig;

  constructor(configService: ConfigService) {
    this.config = configService.getOrThrow<ShineConfig>('shine');
  }

  get baseUrl(): string {
    return this.config.upstreamUrl;
  }

  async get<T>(url: string): Promise<RawResponse<T>> {
    const redactedUrl = redactUrl(url);

    let httpResponse: Response;
    try {
      httpResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'KnoxSolarGateway/2.0',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Upstream request failed: ${reason} (${redactedUrl})`);
      throw new ServiceUnavailableException(
        `ShineMonitor is unreachable: ${reason}`,
      );
    }

    const body = await httpResponse.text();

    let response: ShineEnvelope<T>;
    try {
      response = JSON.parse(body) as ShineEnvelope<T>;
    } catch {
      this.logger.error(
        `Upstream returned non-JSON body (${redactedUrl}): ${body.slice(0, 200)}`,
      );
      throw new ServiceUnavailableException(
        'ShineMonitor returned an unreadable response',
      );
    }

    return { httpStatus: httpResponse.status, response, redactedUrl };
  }
}
