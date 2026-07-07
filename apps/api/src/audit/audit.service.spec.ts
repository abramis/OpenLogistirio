import { AuditAction } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { AuditService } from './audit.service';

const tenant: TenantContext = {
  accountingOfficeId: 'office-1',
  userId: 'user-1',
};

describe('AuditService', () => {
  it('lists audit logs only for the current accounting office', async () => {
    const prisma = {
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new AuditService(prisma as unknown as PrismaService);

    await service.findAll(tenant, {
      action: AuditAction.UPDATE,
      entityType: 'ClientCompany',
      entityId: 'company-1',
      userId: 'user-1',
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
      take: 25,
    });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        accountingOfficeId: 'office-1',
        action: AuditAction.UPDATE,
        entityType: 'ClientCompany',
        entityId: 'company-1',
        userId: 'user-1',
        createdAt: {
          gte: new Date('2026-07-01'),
          lte: new Date('2026-07-31'),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
  });

  it('records audit entries with the tenant context', async () => {
    const prisma = {
      auditLog: {
        create: jest.fn(),
      },
    };
    const service = new AuditService(prisma as unknown as PrismaService);

    await service.record({
      tenant,
      action: AuditAction.CREATE,
      entityType: 'ClientCompany',
      entityId: 'company-1',
      newValue: { id: 'company-1' },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        accountingOfficeId: 'office-1',
        userId: 'user-1',
        action: AuditAction.CREATE,
        entityType: 'ClientCompany',
        entityId: 'company-1',
        oldValue: expect.anything(),
        newValue: { id: 'company-1' },
      },
    });
  });
});
