export interface DailyEnergyTotals {
  generatedTodayKwh: number | null;
  consumedTodayKwh: number | null;
  batteryChargedTodayKwh: number | null;
  batteryDischargedTodayKwh: number | null;
}

/** Merge incoming totals with existing stored values, keeping the higher kWh reading. */
export function mergeMaxDailyEnergyTotals(
  existing: DailyEnergyTotals | null | undefined,
  incoming: DailyEnergyTotals,
): DailyEnergyTotals {
  return {
    generatedTodayKwh: maxNullable(
      existing?.generatedTodayKwh ?? null,
      incoming.generatedTodayKwh,
    ),
    consumedTodayKwh: maxNullable(
      existing?.consumedTodayKwh ?? null,
      incoming.consumedTodayKwh,
    ),
    batteryChargedTodayKwh: maxNullable(
      existing?.batteryChargedTodayKwh ?? null,
      incoming.batteryChargedTodayKwh,
    ),
    batteryDischargedTodayKwh: maxNullable(
      existing?.batteryDischargedTodayKwh ?? null,
      incoming.batteryDischargedTodayKwh,
    ),
  };
}

function maxNullable(a: number | null, b: number | null): number | null {
  if (a === null || !Number.isFinite(a)) return b;
  if (b === null || !Number.isFinite(b)) return a;
  return Math.max(a, b);
}
