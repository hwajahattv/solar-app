import {
  EXPIRY_SAFETY_MARGIN_MS,
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
