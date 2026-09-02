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
      'AUTH_SECRET is required — used to encrypt stored ShineMonitor passwords and bind gateway sessions.',
  })
  AUTH_SECRET!: string;

  @IsString()
  @IsNotEmpty({
    message:
      'DATABASE_URL is required — logged-in users and gateway sessions are stored in Postgres.',
  })
  DATABASE_URL!: string;

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
