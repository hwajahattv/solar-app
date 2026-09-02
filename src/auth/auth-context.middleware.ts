import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';

import { runWithAuth } from './auth-context';
import { AuthService } from './auth.service';
import type { AuthedRequest } from './auth.types';

@Injectable()
export class AuthContextMiddleware implements NestMiddleware {
  constructor(private readonly auth: AuthService) {}

  async use(
    request: AuthedRequest,
    _response: Response,
    next: NextFunction,
  ): Promise<void> {
    const principal = await this.auth.resolveFromRequest(request);
    if (!principal) {
      next();
      return;
    }

    request.user = principal;
    runWithAuth(principal, () => next());
  }
}
