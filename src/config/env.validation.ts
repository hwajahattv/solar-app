import { plainToInstance } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty({
    message:
      'SHINE_USR is required — the server signs in to ShineMonitor on behalf of every client.',
  })
  SHINE_USR!: string;

  @IsString()
  @IsNotEmpty({
    message:
      'SHINE_PWD is required — the server signs in to ShineMonitor on behalf of every client.',
  })
  SHINE_PWD!: string;

  @IsOptional()
  @IsString()
  CAMERA_RTSP?: string;
}

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const parsed = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(parsed, {
    skipMissingProperties: false,
    whitelist: false,
  });

  if (errors.length > 0) {
    const details = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .map((message) => `  - ${message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return config;
}
