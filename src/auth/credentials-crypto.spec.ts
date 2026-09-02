import { decryptSecret, encryptSecret, hashToken } from './credentials-crypto';

describe('credentials-crypto', () => {
  const secret = 'unit-test-auth-secret';

  it('round-trips plaintext', () => {
    const blob = encryptSecret('shine-password', secret);
    expect(blob).not.toContain('shine-password');
    expect(decryptSecret(blob, secret)).toBe('shine-password');
  });

  it('rejects a different AUTH_SECRET', () => {
    const blob = encryptSecret('shine-password', secret);
    expect(() => decryptSecret(blob, 'other-secret')).toThrow();
  });

  it('hashes bearer tokens stably', () => {
    expect(hashToken('abc')).toHaveLength(64);
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });
});
