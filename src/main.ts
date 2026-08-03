import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const timeZone = config.getOrThrow<string>('timezone');
  process.env.TZ = timeZone;
  logger.log(`Using application timezone ${timeZone}`);

  // crossOriginResourcePolicy is relaxed so the MJPEG stream can be embedded by
  // the SPA (and later the mobile/TV clients) served from another origin.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());

  app.enableCors({
    origin: config.getOrThrow<string[]>('corsOrigins'),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: false,
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  const openApi = new DocumentBuilder()
    .setTitle('Knox Solar Gateway API')
    .setDescription(
      'Device-agnostic API for the Knox solar inverter dashboard. All ShineMonitor credentials, signing and response normalisation happen here so web, mobile and TV clients stay thin.',
    )
    .setVersion('1.0')
    .build();

  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, openApi),
    {
      swaggerOptions: { persistAuthorization: true },
    },
  );

  const port = config.getOrThrow<number>('port');
  await app.listen(port);

  logger.log(`API listening on http://localhost:${port}/api/v1`);
  logger.log(`OpenAPI explorer at http://localhost:${port}/api/docs`);
}

void bootstrap();
