import {
  integratePowerKwToCumulativeKwh,
  sumPowerSeries,
  totalEnergyKwhFromPowerKw,
} from './energy-calc';

describe('energy-calc', () => {
  it('sums power series on a shared timeline', () => {
    const summed = sumPowerSeries([
      {
        id: 'a',
        title: 'A',
        unit: 'kW',
        points: [
          { t: '2026-08-04 10:00:00', v: 1 },
          { t: '2026-08-04 10:05:00', v: 2 },
        ],
      },
      {
        id: 'b',
        title: 'B',
        unit: 'kW',
        points: [
          { t: '2026-08-04 10:00:00', v: 0.5 },
          { t: '2026-08-04 10:05:00', v: 0.5 },
        ],
      },
    ]);

    expect(summed).toEqual([
      { t: '2026-08-04 10:00:00', v: 1.5 },
      { t: '2026-08-04 10:05:00', v: 2.5 },
    ]);
  });

  it('integrates kW samples into cumulative kWh', () => {
    const cumulative = integratePowerKwToCumulativeKwh([
      { t: '2026-08-04 10:00:00', v: 2 },
      { t: '2026-08-04 11:00:00', v: 2 },
      { t: '2026-08-04 12:00:00', v: 0 },
    ]);

    expect(cumulative[0]?.v).toBe(0);
    // 1h at avg 2 kW → +2; 1h at avg 1 kW → +1
    expect(cumulative[1]?.v).toBe(2);
    expect(cumulative[2]?.v).toBe(3);
    expect(totalEnergyKwhFromPowerKw([
      { t: '2026-08-04 10:00:00', v: 2 },
      { t: '2026-08-04 11:00:00', v: 2 },
      { t: '2026-08-04 12:00:00', v: 0 },
    ])).toBe(3);
  });
});
