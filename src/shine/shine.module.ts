import { Global, Module } from '@nestjs/common';

import { ShineApiService } from './shine-api.service';
import { ShineHttpService } from './shine-http.service';
import { ShineSessionService } from './shine-session.service';

/**
 * Global because every feature module talks to ShineMonitor through the same
 * authenticated session — there is exactly one upstream account per deployment.
 */
@Global()
@Module({
  providers: [ShineHttpService, ShineSessionService, ShineApiService],
  exports: [ShineApiService, ShineSessionService],
})
export class ShineModule {}
