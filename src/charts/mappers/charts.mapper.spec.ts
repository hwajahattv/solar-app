import {
  mapChartFields,
  mapChartSeries,
  normalizeUnitGroup,
  stripTrailingPaddedZeros,
} from './charts.mapper';

describe('charts.mapper', () => {
  it('normalizes common unit groups', () => {
    expect(normalizeUnitGroup('kW')).toBe('kW');
    expect(normalizeUnitGroup('%')).toBe('%');
    expect(normalizeUnitGroup('Hz')).toBe('Hz');
    expect(normalizeUnitGroup('')).toBe('other');
  });

  it('maps catalog rows and dedupes ids', () => {
    const fields = mapChartFields([
      { e0: 'output_power', e1: 'Input Power', e3: 'kW' },
      { e0: 'output_power', e1: 'dup', e3: 'kW' },
      { e0: 'bt_battery_capacity', e1: 'Battery Capacity', e3: '%' },
    ]);

    expect(fields).toHaveLength(2);
    expect(fields[0]?.group).toBe('%');
    expect(fields[1]?.id).toBe('output_power');
  });

  it('strips trailing padded 0.0 samples', () => {
    const stripped = stripTrailingPaddedZeros([
      { t: '2026-08-04 10:00:00', v: 1.2, paddedZero: false },
      { t: '2026-08-04 10:05:00', v: 0, paddedZero: false },
      { t: '2026-08-04 10:10:00', v: 0, paddedZero: true },
      { t: '2026-08-04 10:15:00', v: 0, paddedZero: true },
    ]);

    expect(stripped).toHaveLength(2);
    expect(stripped.at(-1)?.t).toBe('2026-08-04 10:05:00');
  });

  it('maps series by par and preserves request order', () => {
    const catalog = new Map(
      mapChartFields([
        { e0: 'a', e1: 'A', e3: 'kW' },
        { e0: 'b', e1: 'B', e3: 'kW' },
      ]).map((field) => [field.id, field]),
    );

    const series = mapChartSeries(
      {
        date: [
          {
            par: 'b',
            paramter: [
              { key: '2026-08-04 00:00:00', val: '1.0000' },
              { key: '2026-08-04 00:05:00', val: '0.0' },
            ],
          },
          {
            par: 'a',
            paramter: [{ key: '2026-08-04 00:00:00', val: '2.0000' }],
          },
        ],
      },
      catalog,
      ['a', 'b'],
    );

    expect(series.map((item) => item.id)).toEqual(['a', 'b']);
    expect(series[0]?.title).toBe('A');
    expect(series[1]?.points).toHaveLength(1);
  });
});
