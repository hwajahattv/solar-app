import type { ShineLastDataPayload } from '../../shine/shine.types';
import { mapEnergyFlow } from './energy-flow.mapper';

const payload = (
  parameters: Array<{ id: string; val: string | number }>,
): ShineLastDataPayload => ({
  gts: '2026-08-03 10:15:00',
  pars: { bt_: parameters },
});

describe('mapEnergyFlow', () => {
  it('treats a sub-threshold grid voltage as offline', () => {
    const flow = mapEnergyFlow(
      payload([{ id: 'bt_grid_voltage', val: '0.4' }]),
    );

    expect(flow.grid.online).toBe(false);
    expect(flow.activeSources).not.toContain('grid');
  });

  it('marks solar active when either power or current is present', () => {
    expect(
      mapEnergyFlow(payload([{ id: 'bt_output_power_1', val: '1250' }])).solar
        .active,
    ).toBe(true);
    expect(
      mapEnergyFlow(payload([{ id: 'pv_input_current', val: '2.4' }])).solar
        .active,
    ).toBe(true);
    expect(
      mapEnergyFlow(payload([{ id: 'pv_input_current', val: '0.05' }])).solar
        .active,
    ).toBe(false);
  });

  it('reports charging separately from discharging and excludes it from active sources', () => {
    const flow = mapEnergyFlow(
      payload([
        { id: 'bt_battery_voltage', val: '52.8' },
        { id: 'bt_battery_charging_current', val: '18' },
      ]),
    );

    expect(flow.battery.charging).toBe(true);
    expect(flow.battery.discharging).toBe(false);
    expect(flow.activeSources).not.toContain('battery');
    // Negative power means energy is flowing into the battery.
    expect(flow.battery.power).toBeLessThan(0);
  });

  it('derives load current from apparent power and the measured output voltage', () => {
    const flow = mapEnergyFlow(
      payload([
        { id: 'bt_ac_output_apparent_power', val: '2300' },
        { id: 'bt_ac_output_voltage', val: '230' },
      ]),
    );

    expect(flow.load.current).toBe(10);
  });

  it('falls back to a nominal voltage when the inverter reports none', () => {
    const flow = mapEnergyFlow(
      payload([{ id: 'bt_ac_output_apparent_power', val: '460' }]),
    );

    expect(flow.load.current).toBe(2);
  });

  it('summarises every source feeding the load', () => {
    const flow = mapEnergyFlow(
      payload([
        { id: 'bt_grid_voltage', val: '238' },
        { id: 'bt_output_power_1', val: '900' },
        { id: 'bt_battery_discharge_current', val: '5' },
        { id: 'bc_model', val: 'Line Mode' },
      ]),
    );

    expect(flow.activeSources).toEqual(['grid', 'solar', 'battery']);
    expect(flow.summary).toBe('Powered by Grid + Solar + Battery · Line Mode');
  });

  it('strips units from values that arrive as formatted strings', () => {
    const flow = mapEnergyFlow(
      payload([{ id: 'bt_battery_capacity', val: '87 %' }]),
    );

    expect(flow.battery.soc).toBe(87);
  });

  it('returns nulls instead of throwing when the payload is empty', () => {
    const flow = mapEnergyFlow({});

    expect(flow.grid.voltage).toBeNull();
    expect(flow.activeSources).toEqual([]);
    expect(flow.summary).toBe('Standby');
  });
});
