import { todayInTimeZone, toIsoDateInTimeZone } from './timezone';

describe('timezone helpers', () => {
  it('formats today using the configured zone rather than UTC', () => {
    const instant = new Date('2026-08-03T20:30:00.000Z'); // 01:30 on Aug 4 in Karachi
    jest.useFakeTimers().setSystemTime(instant);

    expect(todayInTimeZone('Asia/Karachi')).toBe('2026-08-04');
    expect(todayInTimeZone('UTC')).toBe('2026-08-03');

    jest.useRealTimers();
  });

  it('parses wall-clock timestamps in the configured zone', () => {
    expect(toIsoDateInTimeZone('2026-08-03 18:30:00', 'Asia/Karachi')).toBe(
      '2026-08-03T13:30:00.000Z',
    );
  });

  it('passes epoch millisecond timestamps through unchanged', () => {
    const epoch = '1785520279619';
    expect(toIsoDateInTimeZone(epoch, 'Asia/Karachi')).toBe(
      new Date(Number(epoch)).toISOString(),
    );
  });
});
