import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../common/prisma/prisma.service';

export interface DependencyHealth {
  status: 'ok' | 'error';
  latencyMs?: number;
  error?: string;
}

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly version: string;
  private readonly gitSha: string;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.version = configService.get<string>('APP_VERSION', 'development');
    this.gitSha = configService.get<string>('GIT_SHA', 'unknown');
    this.redis = new Redis(configService.getOrThrow<string>('REDIS_URL'), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 3000,
    });
  }

  async readiness() {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    return {
      status: database.status === 'ok' && redis.status === 'ok' ? 'ok' : 'degraded',
      service: 'open-logistirio-api',
      ...this.metadata(),
      dependencies: { database, redis },
    };
  }

  metadata() {
    return { version: this.version, gitSha: this.gitSha };
  }

  async onModuleDestroy() {
    this.redis.disconnect();
  }

  private async checkDatabase(): Promise<DependencyHealth> {
    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', latencyMs: Date.now() - startedAt };
    } catch (error) {
      return { status: 'error', error: healthError(error) };
    }
  }

  private async checkRedis(): Promise<DependencyHealth> {
    const startedAt = Date.now();
    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }
      await this.redis.ping();
      return { status: 'ok', latencyMs: Date.now() - startedAt };
    } catch (error) {
      return { status: 'error', error: healthError(error) };
    }
  }
}

function healthError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 200) : 'Unknown dependency error.';
}
