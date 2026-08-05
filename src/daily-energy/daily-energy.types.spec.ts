import { mergeMaxDailyEnergyTotals } from './daily-energy.types';

describe('mergeMaxDailyEnergyTotals', () => {
  it('keeps the higher value for each metric', () => {
    expect(
      mergeMaxDailyEnergyTotals(
        {
          generatedTodayKwh: 6.5,
          consumedTodayKwh: 5.0,
          batteryChargedTodayKwh: 1.0,
          batteryDischargedTodayKwh: 0.5,
        },
        {
          generatedTodayKwh: 6.556,
          consumedTodayKwh: 4.9,
          batteryChargedTodayKwh: null,
          batteryDischargedTodayKwh: 0.8,
        },
      ),
    ).toEqual({
      generatedTodayKwh: 6.556,
      consumedTodayKwh: 5.0,
      batteryChargedTodayKwh: 1.0,
      batteryDischargedTodayKwh: 0.8,
    });
  });
});
