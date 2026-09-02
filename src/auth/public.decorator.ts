import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Skip the gateway Bearer-token guard (health, login, optional session poll). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
