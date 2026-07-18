import { PrismaService } from '../common/prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('reports ready when MySQL and Redis are reachable', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ value: 1 }]) };
    const config = {
      get: jest.fn((key: string, fallback: string) =>
        key === 'APP_VERSION' ? '1.0.0-rc.1' : fallback,
      ),
      getOrThrow: jest.fn().mockReturnValue('redis://localhost:6379'),
    };
    const service = new HealthService(prisma as unknown as PrismaService, config as never);
    const internal = service as unknown as {
      redis: { status: string; ping: jest.Mock; disconnect: jest.Mock };
    };
    internal.redis = {
      status: 'ready',
      ping: jest.fn().mockResolvedValue('PONG'),
      disconnect: jest.fn(),
    };

    await expect(service.readiness()).resolves.toEqual(
      expect.objectContaining({
        status: 'ok',
        version: '1.0.0-rc.1',
        gitSha: 'unknown',
        dependencies: expect.objectContaining({
          database: expect.objectContaining({ status: 'ok' }),
          redis: expect.objectContaining({ status: 'ok' }),
        }),
      }),
    );
    await service.onModuleDestroy();
  });

  it('reports degraded when a dependency fails', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('Database unavailable')) };
    const config = {
      get: jest.fn((_key: string, fallback: string) => fallback),
      getOrThrow: jest.fn().mockReturnValue('redis://localhost:6379'),
    };
    const service = new HealthService(prisma as unknown as PrismaService, config as never);
    const internal = service as unknown as {
      redis: { status: string; ping: jest.Mock; disconnect: jest.Mock };
    };
    internal.redis = {
      status: 'ready',
      ping: jest.fn().mockResolvedValue('PONG'),
      disconnect: jest.fn(),
    };

    await expect(service.readiness()).resolves.toEqual(
      expect.objectContaining({
        status: 'degraded',
        dependencies: expect.objectContaining({
          database: expect.objectContaining({ status: 'error' }),
        }),
      }),
    );
    await service.onModuleDestroy();
  });
});
