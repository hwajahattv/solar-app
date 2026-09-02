import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { PrismaService } from '../database/prisma.service';
import type { ShineHttpService } from './shine-http.service';
import {
  EXPIRY_SAFETY_MARGIN_MS,
  ShineSessionService,
  isShineSessionFresh,
} from './shine-session.service';
import type { ShineSession } from './shine.types';

function session(overrides: Partial<ShineSession> = {}): ShineSession {
  return {
    secret: 's',
    token: 't',
    uid: '1',
    usr: 'demo',
    expire: 3600,
    issuedAt: Date.now(),
    ...overrides,
  };
}

function serviceWithHttp(get: ShineHttpService['get']): ShineSessionService {
  const config = {
    getOrThrow: (key: string) => {
      if (key === 'shine') {
        return { companyKey: 'ck', locale: 'en_US' };
      }
      if (key === 'auth') {
        return { secret: 'test-secret', sessionTtlMs: 1000 };
      }
      throw new Error(`unexpected ${key}`);
    },
  } as unknown as ConfigService;

  const http = {
    baseUrl: 'http://shine.test/',
    get,
  } as unknown as ShineHttpService;

  const prisma = { enabled: false } as PrismaService;
  return new ShineSessionService(config, http, prisma);
}

describe('isShineSessionFresh', () => {
  it('is fresh when expiry is well in the future', () => {
    expect(isShineSessionFresh(session({ expire: 3600 }))).toBe(true);
  });

  it('is stale inside the safety margin', () => {
    const now = Date.now();
    expect(
      isShineSessionFresh(
        session({
          issuedAt: now - 3600 * 1000 + EXPIRY_SAFETY_MARGIN_MS / 2,
          expire: 3600,
        }),
        now,
      ),
    ).toBe(false);
  });
});

describe('ShineSessionService.authenticate', () => {
  it('returns a session when ShineMonitor accepts the credentials', async () => {
    const get = jest.fn().mockResolvedValue({
      response: {
        err: 0,
        dat: {
          secret: 'sec',
          token: 'tok',
          uid: 42,
          usr: 'alice',
          expire: 3600,
        },
      },
    });
    const svc = serviceWithHttp(get);
    const result = await svc.authenticate('alice', 'password');
    expect(result).toMatchObject({
      secret: 'sec',
      token: 'tok',
      uid: '42',
      usr: 'alice',
      expire: 3600,
    });
    expect(get).toHaveBeenCalledTimes(1);
    expect(String(get.mock.calls[0][0])).toContain('action=authSource');
    expect(String(get.mock.calls[0][0])).toContain('usr=alice');
  });

  it('rejects invalid ShineMonitor credentials', async () => {
    const svc = serviceWithHttp(
      jest.fn().mockResolvedValue({
        response: { err: 1, desc: 'ERR_PASSWORD' },
      }),
    );
    await expect(svc.authenticate('alice', 'wrong')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
