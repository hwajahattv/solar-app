import { readAccessToken } from './auth.service';
import type { Request } from 'express';

function fakeRequest(init: {
  authorization?: string;
  access_token?: string;
}): Request {
  return {
    header: (name: string) =>
      name.toLowerCase() === 'authorization' ? init.authorization : undefined,
    query: init.access_token ? { access_token: init.access_token } : {},
  } as unknown as Request;
}

describe('readAccessToken', () => {
  it('reads a Bearer header', () => {
    expect(
      readAccessToken(fakeRequest({ authorization: 'Bearer abc.def' })),
    ).toBe('abc.def');
  });

  it('reads an access_token query (camera <img> tags)', () => {
    expect(readAccessToken(fakeRequest({ access_token: 'tok' }))).toBe('tok');
  });

  it('prefers the Authorization header', () => {
    expect(
      readAccessToken(
        fakeRequest({
          authorization: 'Bearer from-header',
          access_token: 'from-query',
        }),
      ),
    ).toBe('from-header');
  });
});
