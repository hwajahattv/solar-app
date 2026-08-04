import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type EnergySourceKind = 'grid' | 'solar' | 'battery';

export class GridStateDto {
  @ApiProperty({ description: 'True when mains voltage is present and usable' })
  online!: boolean;

  @ApiPropertyOptional({ type: Number, nullable: true }) voltage!:
    number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) frequency!:
    number | null;
}

export class SolarStateDto {
  @ApiProperty({
    description: 'True when the array is producing measurable power',
  })
  active!: boolean;

  @ApiPropertyOptional({ type: Number, nullable: true }) power!: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) voltage!:
    number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) current!:
    number | null;
}

export class BatteryStateDto {
  @ApiProperty() active!: boolean;
  @ApiProperty() charging!: boolean;
  @ApiProperty() discharging!: boolean;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'State of charge in percent',
  })
  soc!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true }) voltage!:
    number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) chargeCurrent!:
    number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) dischargeCurrent!:
    number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description:
      'Signed power in W. Positive means the battery is supplying the load.',
  })
  power!: number | null;
}

export class LoadStateDto {
  @ApiProperty() active!: boolean;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Active power in W',
  })
  activePower!: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Apparent power in VA',
  })
  apparentPower!: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Derived load current in A',
  })
  current!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true }) outputVoltage!:
    number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) loadPercent!:
    number | null;
}

export class DailyEnergyDto {
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'PV generation today in kWh (integrated from PV power samples)',
  })
  generatedTodayKwh!: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Load consumption today in kWh (integrated from load power)',
  })
  consumedTodayKwh!: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Energy charged into the battery today in kWh',
  })
  batteryChargedTodayKwh!: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Energy supplied by the battery today in kWh',
  })
  batteryDischargedTodayKwh!: number | null;
}

export class EnergyFlowDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'ISO timestamp of the inverter reading',
  })
  readingAt!: string | null;

  @ApiProperty({
    description: 'ISO timestamp at which this payload was assembled',
  })
  fetchedAt!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Inverter operating mode reported by the device',
  })
  mode!: string | null;

  @ApiProperty({
    enum: ['grid', 'solar', 'battery'],
    isArray: true,
    description: 'Sources currently feeding the load',
  })
  activeSources!: EnergySourceKind[];

  @ApiProperty({
    description: 'Human readable summary, e.g. "Powered by Solar + Grid"',
  })
  summary!: string;

  @ApiProperty({ type: GridStateDto }) grid!: GridStateDto;
  @ApiProperty({ type: SolarStateDto }) solar!: SolarStateDto;
  @ApiProperty({ type: BatteryStateDto }) battery!: BatteryStateDto;
  @ApiProperty({ type: LoadStateDto }) load!: LoadStateDto;

  @ApiProperty({
    type: DailyEnergyDto,
    description: 'Daily energy totals derived from today’s chart power samples',
  })
  energy!: DailyEnergyDto;
}
