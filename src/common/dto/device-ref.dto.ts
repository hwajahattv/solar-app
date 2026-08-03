import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

import type { ShineParams } from '../../shine/shine.types';
import { stringify } from '../utils/numeric';

const asString = ({ value }: { value: unknown }): string => stringify(value);

/**
 * The four identifiers ShineMonitor needs to address a single inverter. Clients
 * obtain them from `GET /devices` and echo them back on every device-scoped call.
 */
export class DeviceRefDto {
  @ApiProperty({
    description: 'Datalogger product number',
    example: 'W0012345678',
  })
  @Transform(asString)
  @IsString()
  @IsNotEmpty()
  pn!: string;

  @ApiProperty({
    description: 'Inverter serial number',
    example: '96322210100123',
  })
  @Transform(asString)
  @IsString()
  @IsNotEmpty()
  sn!: string;

  @ApiProperty({ description: 'Device protocol code', example: '2451' })
  @Transform(asString)
  @IsString()
  @IsNotEmpty()
  devcode!: string;

  @ApiProperty({
    description: 'Device address on the datalogger bus',
    example: '1',
  })
  @Transform(asString)
  @IsString()
  @IsNotEmpty()
  devaddr!: string;
}

export function deviceParams(device: DeviceRefDto): ShineParams {
  return {
    pn: device.pn,
    sn: device.sn,
    devcode: device.devcode,
    devaddr: device.devaddr,
  };
}
