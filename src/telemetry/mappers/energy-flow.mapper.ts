import { round, toIsoDate, toNumber, toText } from '../../common/utils/numeric';
import type {
  ShineLastDataPayload,
  ShineParameter,
} from '../../shine/shine.types';
import type { EnergyFlowDto, EnergySourceKind } from '../dto/energy-flow.dto';

/**
 * ShineMonitor parameter ids for an Axpert-style hybrid inverter. Keeping them in
 * one table means supporting another inverter family is a data change, not a
 * rewrite of the mapping logic.
 */
export const FLOW_PARAMETER_IDS = {
  gridVoltage: 'bt_grid_voltage',
  gridFrequency: 'bt_grid_frequency',
  pvVoltage: 'bt_voltage_1',
  pvCurrent: 'pv_input_current',
  pvPower: 'bt_output_power_1',
  batteryVoltage: 'bt_battery_voltage',
  batterySoc: 'bt_battery_capacity',
  batteryChargeCurrent: 'bt_battery_charging_current',
  batteryDischargeCurrent: 'bt_battery_discharge_current',
  outputVoltage: 'bt_ac_output_voltage',
  apparentPower: 'bt_ac_output_apparent_power',
  activePower: 'bt_load_active_power_sole',
  loadPercent: 'bt_output_load_percent',
  mode: 'bc_model',
  loadStatus: 'bc_load_status',
} as const;

/**
 * Noise floors below which a reading is treated as "off". Without these, a grid
 * reading of 0.3 V or a trickle of PV current would light up the whole diagram.
 */
const THRESHOLDS = {
  gridVolt: 1,
  pvWatt: 1,
  pvAmp: 0.1,
  batteryAmp: 0.1,
  loadWatt: 1,
} as const;

/** Nominal voltage used to derive load current when the inverter reports no output voltage. */
const FALLBACK_OUTPUT_VOLTAGE = 230;

/** Flattens `dat.pars` (grouped by prefix) into a single id -> parameter lookup. */
export function flattenParameters(
  payload: ShineLastDataPayload,
): Map<string, ShineParameter> {
  const lookup = new Map<string, ShineParameter>();

  for (const group of Object.values(payload.pars ?? {})) {
    if (!Array.isArray(group)) continue;
    for (const parameter of group) {
      if (parameter?.id) lookup.set(parameter.id, parameter);
    }
  }

  return lookup;
}

export function mapEnergyFlow(payload: ShineLastDataPayload): EnergyFlowDto {
  const parameters = flattenParameters(payload);
  const value = (id: string): number | null =>
    toNumber(parameters.get(id)?.val);
  const text = (id: string): string => toText(parameters.get(id)?.val);

  const gridVoltage = value(FLOW_PARAMETER_IDS.gridVoltage);
  const pvPower = value(FLOW_PARAMETER_IDS.pvPower);
  const pvCurrent = value(FLOW_PARAMETER_IDS.pvCurrent);
  const chargeCurrent = value(FLOW_PARAMETER_IDS.batteryChargeCurrent);
  const dischargeCurrent = value(FLOW_PARAMETER_IDS.batteryDischargeCurrent);
  const batteryVoltage = value(FLOW_PARAMETER_IDS.batteryVoltage);
  const outputVoltage = value(FLOW_PARAMETER_IDS.outputVoltage);
  const apparentPower = value(FLOW_PARAMETER_IDS.apparentPower);
  const activePower = value(FLOW_PARAMETER_IDS.activePower);
  const mode = text(FLOW_PARAMETER_IDS.mode);
  const loadStatus = text(FLOW_PARAMETER_IDS.loadStatus);

  const gridOnline = gridVoltage !== null && gridVoltage > THRESHOLDS.gridVolt;
  const solarActive =
    (pvPower !== null && pvPower > THRESHOLDS.pvWatt) ||
    (pvCurrent !== null && pvCurrent > THRESHOLDS.pvAmp);
  const charging =
    chargeCurrent !== null && chargeCurrent > THRESHOLDS.batteryAmp;
  const discharging =
    dischargeCurrent !== null && dischargeCurrent > THRESHOLDS.batteryAmp;
  const loadActive =
    (activePower !== null && activePower > THRESHOLDS.loadWatt) ||
    /on/i.test(loadStatus);

  // Prefer apparent power for current: it is what an AC clamp meter would read.
  const referenceVoltage = outputVoltage || FALLBACK_OUTPUT_VOLTAGE;
  const powerForCurrent = apparentPower ?? activePower;
  const loadCurrent =
    powerForCurrent === null ? null : powerForCurrent / referenceVoltage;

  // Signed so clients can render direction without re-deriving it.
  const batteryPower =
    batteryVoltage !== null && (charging || discharging)
      ? batteryVoltage * ((dischargeCurrent ?? 0) - (chargeCurrent ?? 0))
      : null;

  const activeSources: EnergySourceKind[] = [];
  if (gridOnline) activeSources.push('grid');
  if (solarActive) activeSources.push('solar');
  if (discharging) activeSources.push('battery');

  return {
    readingAt: toIsoDate(payload.gts),
    fetchedAt: new Date().toISOString(),
    mode: mode || null,
    activeSources,
    summary: buildSummary(activeSources, mode, charging),
    grid: {
      online: gridOnline,
      voltage: round(gridVoltage, 1),
      frequency: round(value(FLOW_PARAMETER_IDS.gridFrequency), 2),
    },
    solar: {
      active: solarActive,
      power: round(pvPower, 1),
      voltage: round(value(FLOW_PARAMETER_IDS.pvVoltage), 1),
      current: round(pvCurrent, 2),
    },
    battery: {
      active: charging || discharging,
      charging,
      discharging,
      soc: round(value(FLOW_PARAMETER_IDS.batterySoc), 0),
      voltage: round(batteryVoltage, 2),
      chargeCurrent: round(chargeCurrent, 1),
      dischargeCurrent: round(dischargeCurrent, 1),
      power: round(batteryPower, 1),
    },
    load: {
      active: loadActive,
      activePower: round(activePower, 1),
      apparentPower: round(apparentPower, 1),
      current: round(loadCurrent, 2),
      outputVoltage: round(outputVoltage, 1),
      loadPercent: round(value(FLOW_PARAMETER_IDS.loadPercent), 0),
    },
  };
}

const SOURCE_LABELS: Record<EnergySourceKind, string> = {
  grid: 'Grid',
  solar: 'Solar',
  battery: 'Battery',
};

function buildSummary(
  sources: EnergySourceKind[],
  mode: string,
  charging: boolean,
): string {
  const base = sources.length
    ? `Powered by ${sources.map((source) => SOURCE_LABELS[source]).join(' + ')}`
    : mode || 'Standby';

  const withMode = sources.length && mode ? `${base} · ${mode}` : base;
  return charging ? `${withMode} · battery charging` : withMode;
}
