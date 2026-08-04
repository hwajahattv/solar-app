import { createHmac, timingSafeEqual } from 'node:crypto';

export const CONTROLS_COOKIE = 'knox_controls';

function toBase64Url(bytes: Buffer): string {
  return bytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/** Verify `{exp}.{hmac}` token issued by the frontend controls gate. */
export function verifyControlsToken(
  token: string | undefined | null,
  secret: string,
): boolean {
  if (!token || !secret) return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [payload, sigB64] = parts;
  if (!payload || !sigB64) return false;

  const exp = Number(payload);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;

  const expected = toBase64Url(
    createHmac('sha256', secret).update(payload).digest(),
  );

  const a = Buffer.from(expected);
  const b = Buffer.from(sigB64);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

export function readControlsToken(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey === CONTROLS_COOKIE) return rest.join('=');
  }

  return undefined;
}

export function resolveControlsSecret(
  password: string,
  explicitSecret: string,
): string {
  if (explicitSecret.trim()) return explicitSecret.trim();
  if (password.trim()) return `knox-controls-fallback:${password.trim()}`;
  return '';
}
