import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async ready(): Promise<{ status: 'ok' | 'degraded'; checks: Record<string, boolean> }> {
    const checks: Record<string, boolean> = {};
    try {
      // Lightweight liveness probe — count rows of any table to exercise
      // the connection pool. On a fresh dev DB this is ~0.5ms.
      await this.prisma.$queryRawUnsafe('SELECT 1');
      checks.db = true;
    } catch {
      checks.db = false;
    }
    const status: 'ok' | 'degraded' = Object.values(checks).every((v) => v) ? 'ok' : 'degraded';
    return { status, checks };
  }
}
