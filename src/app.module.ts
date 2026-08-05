import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AlarmsModule } from './alarms/alarms.module';
import { AuthModule } from './auth/auth.module';
import { CameraModule } from './camera/camera.module';
import { ChartsModule } from './charts/charts.module';
import { configuration } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { ControlsModule } from './controls/controls.module';
import { DatabaseModule } from './database/database.module';
import { DevicesModule } from './devices/devices.module';
import { DiagnosticsModule } from './diagnostics/diagnostics.module';
import { HealthModule } from './health/health.module';
import { ShineModule } from './shine/shine.module';
import { TelemetryModule } from './telemetry/telemetry.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    ShineModule,
    AuthModule,
    DevicesModule,
    TelemetryModule,
    ChartsModule,
    ControlsModule,
    AlarmsModule,
    CameraModule,
    DiagnosticsModule,
    HealthModule,
  ],
})
export class AppModule {}
