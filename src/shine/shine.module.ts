import { Global, Module } from '@nestjs/common';

import { ShineApiService } from './shine-api.service';
import { ShineHttpService } from './shine-http.service';
import { ShineSessionService } from './shine-session.service';

/**
 * Global because every feature module talks to ShineMonitor through
 * ShineApiService. The upstream session is now per authenticated user.
 */
@Global()
@Module({
  providers: [ShineHttpService, ShineSessionService, ShineApiService],
  exports: [ShineApiService, ShineSessionService],
})
export class ShineModule {}
