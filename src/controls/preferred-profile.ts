export interface PreferredProfileStep {
  id: string;
  name: string;
  value: string;
  label: string;
}

/**
 * The one-click "preferred" configuration. It lives on the server so the same
 * profile is applied identically from the web dashboard, a phone or the TV app,
 * and so it can be changed without shipping a new client build.
 */
export const PREFERRED_PROFILE: readonly PreferredProfileStep[] = [
  {
    id: 'bse_output_source_priority',
    name: 'Output Source Priority',
    value: '12337',
    label: 'Solar Utility Bat',
  },
  {
    id: 'bat_battery_type',
    name: 'Battery Type',
    value: '12344',
    label: 'Lib',
  },
  {
    id: 'bat_charging_source',
    name: 'Charging Source Priority',
    value: '12339',
    label: 'Only Solar Charging Permitted',
  },
  {
    id: 'std_lcd_display_ctrl_k',
    name: 'LCD Auto-return to Main Screen',
    value: '68',
    label: 'Disable',
  },
] as const;

/** Pause between writes so the inverter can settle before the next command. */
export const PROFILE_STEP_DELAY_MS = 650;
