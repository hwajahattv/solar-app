import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';

import { AuthGuard } from './auth.guard';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { AuthedRequest } from './auth.types';

function context(
  request: Partial<AuthedRequest>,
  isPublic = false,
): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe('AuthGuard', () => {
  it('allows public routes', () => {
    const reflector = {
      getAllAndOverride: (key: string) => key === IS_PUBLIC_KEY,
    } as unknown as Reflector;
    const guard = new AuthGuard(reflector);
    expect(guard.canActivate(context({}))).toBe(true);
  });

  it('allows an authenticated request', () => {
    const reflector = {
      getAllAndOverride: () => false,
    } as unknown as Reflector;
    const guard = new AuthGuard(reflector);
    expect(
      guard.canActivate(
        context({
          user: {
            sessionId: 's',
            userId: 'u',
            username: 'demo',
            shineUid: '1',
            gatewayExpiresAt: new Date(),
          },
        }),
      ),
    ).toBe(true);
  });

  it('rejects missing credentials', () => {
    const reflector = {
      getAllAndOverride: () => false,
    } as unknown as Reflector;
    const guard = new AuthGuard(reflector);
    expect(() => guard.canActivate(context({}))).toThrow(UnauthorizedException);
  });
});
