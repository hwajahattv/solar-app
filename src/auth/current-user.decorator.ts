import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { AuthPrincipal, AuthedRequest } from './auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthPrincipal | undefined => {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    return request.user;
  },
);
