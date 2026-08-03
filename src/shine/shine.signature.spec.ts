import {
  APP_SUFFIX,
  buildData,
  buildLoginData,
  redactUrl,
  sha1,
  signCall,
  signLogin,
} from './shine.signature';

describe('ShineMonitor signing', () => {
  it('always appends the mandatory source suffix', () => {
    expect(buildData('querySPDeviceLastData')).toBe(
      `&action=querySPDeviceLastData${APP_SUFFIX}`,
    );
  });

  it('skips empty parameters so they are not signed', () => {
    const data = buildData('ctrlDevice', {
      id: 'bat_battery_type',
      val: '',
      devaddr: undefined,
      pn: 'W1',
    });

    expect(data).toBe('&action=ctrlDevice&id=bat_battery_type&pn=W1&source=1');
  });

  it('url-encodes parameter values', () => {
    expect(buildData('x', { name: 'Output Source Priority' })).toContain(
      'name=Output%20Source%20Priority',
    );
  });

  it('signs logins as sha1(salt + sha1(password) + data)', () => {
    const data = buildLoginData('demo', 'company-key');

    expect(signLogin('1000', 'secret', data)).toBe(
      sha1('1000' + sha1('secret') + data),
    );
  });

  it('signs authenticated calls as sha1(salt + secret + token + data)', () => {
    const data = buildData('queryDeviceWarning');

    expect(signCall('1000', 'sec', 'tok', data)).toBe(
      sha1('1000sectok' + data),
    );
  });

  it('removes the signature and token before a URL is logged', () => {
    const redacted = redactUrl(
      'http://host/public/?sign=abc123&salt=1&token=zzz&action=x',
    );

    expect(redacted).toContain('sign=***');
    expect(redacted).toContain('token=***');
    expect(redacted).not.toContain('abc123');
  });
});
