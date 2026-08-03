import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeviceDto {
  @ApiProperty() pn!: string;
  @ApiProperty() sn!: string;
  @ApiProperty() devcode!: string;
  @ApiProperty() devaddr!: string;

  @ApiProperty({
    description: 'Human readable name, falling back to the product number',
  })
  alias!: string;

  @ApiPropertyOptional({ description: 'Plant id the device belongs to' })
  plantId?: string;

  @ApiPropertyOptional({ description: 'Battery state of charge in percent' })
  batterySoc?: number | null;

  @ApiPropertyOptional({ description: 'Energy generated today, in kWh' })
  energyToday?: number | null;

  @ApiPropertyOptional({ description: 'Current output power in W' })
  outputPower?: number | null;

  @ApiPropertyOptional({ description: 'Raw upstream status code' })
  status?: string;
}
