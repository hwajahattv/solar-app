import { AsyncLocalStorage } from 'node:async_hooks';

import { UnauthorizedException } from '@nestjs/common';

import type { AuthPrincipal } from './auth.types';

const storage = new AsyncLocalStorage<AuthPrincipal>();

export function runWithAuth<T>(principal: AuthPrincipal, fn: () => T): T {
  return storage.run(principal, fn);
}

export function getAuthPrincipal(): AuthPrincipal | undefined {
  return storage.getStore();
}

export function requireAuthPrincipal(): AuthPrincipal {
  const principal = storage.getStore();
  if (!principal) {
    throw new UnauthorizedException('Authentication required');
  }
  return principal;
}
