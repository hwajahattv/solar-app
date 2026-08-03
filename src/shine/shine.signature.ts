import { createHash } from 'node:crypto';

import type { ShineParams } from './shine.types';

/**
 * `source=1` is mandatory for this endpoint — omitting it makes login fail with
 * ERR_FORMAT_ERROR. It is part of the signed payload, so it cannot be added later.
 */
export const APP_SUFFIX = '&source=1';

export const sha1 = (input: string): string =>
  createHash('sha1').update(input, 'utf8').digest('hex');

/**
 * Builds the signed portion of a ShineMonitor query string. Order matters: the
 * signature is computed over this exact string, so it must be reused verbatim.
 */
export function buildData(action: string, params: ShineParams = {}): string {
  let data = `&action=${encodeURIComponent(action)}`;

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    data += `&${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
  }

  return data + APP_SUFFIX;
}

export function buildLoginData(username: string, companyKey: string): string {
  return `&action=authSource&usr=${encodeURIComponent(username)}&company-key=${companyKey}${APP_SUFFIX}`;
}

export function signLogin(
  salt: string,
  password: string,
  data: string,
): string {
  return sha1(salt + sha1(password) + data);
}

export function signCall(
  salt: string,
  secret: string,
  token: string,
  data: string,
): string {
  return sha1(salt + secret + token + data);
}

/** Strips the signature and token so a URL can be safely logged. */
export function redactUrl(url: string): string {
  return url
    .replace(/sign=[^&]*/, 'sign=***')
    .replace(/token=[^&]*/, 'token=***');
}
