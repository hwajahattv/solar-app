import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  readonly enabled: boolean;

  constructor(config: ConfigService) {
    const databaseUrl = config.get<string>('database.url')?.trim() ?? '';
    super(
      databaseUrl
        ? { datasources: { db: { url: databaseUrl } } }
        : undefined,
    );
    this.enabled = databaseUrl.length > 0;
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.warn(
        'DATABASE_URL is not set — daily energy will not be persisted',
      );
      return;
    }

    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.enabled) await this.$disconnect();
  }
}
