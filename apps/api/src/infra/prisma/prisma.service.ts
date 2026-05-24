/**
 * Thin Prisma client wrapper with lifecycle hooks. The service is global,
 * so any module can inject it without re-importing PrismaModule.
 */
import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Prisma');

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
