import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from '../../../src/health/health.controller';
import { PrismaService } from '../../../prisma/prisma.service';

describe('HealthController', () => {
  it('reports a healthy database', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const controller = new HealthController(prisma as unknown as PrismaService);

    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
  });

  it('does not expose database errors', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('secret')),
    };
    const controller = new HealthController(prisma as unknown as PrismaService);

    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
