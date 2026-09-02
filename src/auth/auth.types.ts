import type { Request } from 'express';

export interface AuthPrincipal {
  sessionId: string;
  userId: string;
  username: string;
  shineUid: string;
  gatewayExpiresAt: Date;
}

export type AuthedRequest = Request & { user?: AuthPrincipal };
