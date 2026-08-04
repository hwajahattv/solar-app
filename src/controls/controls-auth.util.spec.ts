import { createHmac } from 'node:crypto';

import { verifyControlsToken } from './controls-auth.util';

describe('controls-auth.util', () => {
  it('verifies a signed controls token', () => {
    const secret = 'unit-test-secret';
    const exp = Math.floor(Date.now() / 1000) + 60;
    const payload = String(exp);
    const sig = createHmac('sha256', secret)
      .update(payload)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    const token = `${payload}.${sig}`;

    expect(verifyControlsToken(token, secret)).toBe(true);
    expect(verifyControlsToken(token, 'other-secret')).toBe(false);
    expect(verifyControlsToken(undefined, secret)).toBe(false);
  });
});
