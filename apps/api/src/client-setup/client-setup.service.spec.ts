import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { ClientSetupService } from './client-setup.service';

const tenant: TenantContext = {
  accountingOfficeId: 'office-1',
  userId: 'user-1',
};

describe('ClientSetupService', () => {
  let prisma: {
    clientCompany: {
      findFirst: jest.Mock;
    };
    clientSetupItem: {
      findMany: jest.Mock;
      upsert: jest.Mock;
    };
  };
  let auditService: jest.Mocked<AuditService>;
  let service: ClientSetupService;

  beforeEach(() => {
    prisma = {
      clientCompany: {
        findFirst: jest.fn().mockResolvedValue({ id: 'company-1' }),
      },
      clientSetupItem: {
        findMany: jest.fn(),
        upsert: jest.fn((args) =>
          Promise.resolve({
            id: `${args.create.kind}-${args.create.code}`,
            ...args.create,
          }),
        ),
      },
    };

    auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    service = new ClientSetupService(prisma as unknown as PrismaService, auditService);
  });

  it('lists available setup templates', () => {
    const templates = service.listTemplates();

    expect(templates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'SIMPLE_BOOKS_ELP',
          itemCount: expect.any(Number),
        }),
      ]),
    );
  });

  it('applies a setup template idempotently for a tenant company', async () => {
    const result = await service.applyTemplate(tenant, 'company-1', {
      templateId: 'SIMPLE_BOOKS_ELP',
      includeKinds: ['BOOK_SYSTEM', 'JOURNAL'],
    });

    expect(result.appliedCount).toBeGreaterThan(1);
    expect(prisma.clientSetupItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          clientCompanyId_kind_code: {
            clientCompanyId: 'company-1',
            kind: 'BOOK_SYSTEM',
            code: 'SIMPLE_BOOKS',
          },
        },
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant,
        action: AuditAction.CREATE,
        entityType: 'ClientSetup',
        entityId: 'company-1',
      }),
    );
  });

  it('rejects unknown templates', async () => {
    await expect(
      service.applyTemplate(tenant, 'company-1', { templateId: 'UNKNOWN' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns not found when company is outside the tenant', async () => {
    prisma.clientCompany.findFirst.mockResolvedValue(null);

    await expect(service.findItems(tenant, 'company-2')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('stores a line-targeted myDATA classification profile', async () => {
    const profile = await service.upsertMyDataClassificationProfile(tenant, 'company-1', {
      code: 'CONSULTING_24',
      name: 'Υπηρεσίες συμβουλευτικής 24%',
      documentType: 'SALES_INVOICE',
      movementCode: 'SALE_INVOICE',
      vatCategory: 'VAT_24',
      itemCode: 'CONSULTING',
      incomeClassificationType: 'E3_561_001',
      incomeClassificationCategory: 'category1_1',
      priority: 20,
    });

    expect(profile).toEqual(
      expect.objectContaining({ code: 'CONSULTING_24', kind: 'MYDATA_CLASSIFICATION_PROFILE' }),
    );
    expect(prisma.clientSetupItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          kind: 'MYDATA_CLASSIFICATION_PROFILE',
          metadata: expect.objectContaining({ itemCode: 'CONSULTING', priority: 20 }),
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'MyDataClassificationProfile' }),
    );
  });

  it('requires complete classification pairs in a profile', async () => {
    await expect(
      service.upsertMyDataClassificationProfile(tenant, 'company-1', {
        code: 'INVALID',
        name: 'Invalid',
        incomeClassificationType: 'E3_561_001',
      }),
    ).rejects.toThrow('Income classification type and category');
  });
});
