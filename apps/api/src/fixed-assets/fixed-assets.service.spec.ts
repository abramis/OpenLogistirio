import { FixedAssetCategory, FixedAssetStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { FixedAssetsService } from './fixed-assets.service';

const tenant: TenantContext = {
  accountingOfficeId: 'office-1',
  userId: 'user-1',
};

const asset = {
  id: 'asset-1',
  accountingOfficeId: 'office-1',
  clientCompanyId: 'company-1',
  code: 'FA-1',
  description: 'Laptop',
  category: FixedAssetCategory.EQUIPMENT,
  acquisitionDate: new Date('2026-07-02T00:00:00.000Z'),
  depreciationStartDate: new Date('2026-07-02T00:00:00.000Z'),
  acquisitionDocumentNumber: null,
  supplierName: null,
  netValue: new Prisma.Decimal('1200.00'),
  vatAmount: new Prisma.Decimal('288.00'),
  totalValue: new Prisma.Decimal('1488.00'),
  depreciationRate: new Prisma.Decimal('20.00'),
  accumulatedDepreciation: new Prisma.Decimal('0.00'),
  status: FixedAssetStatus.ACTIVE,
  disposalDate: null,
  notes: null,
  createdAt: new Date('2026-07-02T00:00:00.000Z'),
  updatedAt: new Date('2026-07-02T00:00:00.000Z'),
  clientCompany: {
    id: 'company-1',
    legalName: 'Demo Company',
    vatNumber: '123456789',
  },
  depreciationEntries: [],
};

describe('FixedAssetsService', () => {
  it('generates prorated annual depreciation and updates accumulated depreciation', async () => {
    const prisma = {
      fixedAsset: {
        findFirst: jest.fn().mockResolvedValue(asset),
        update: jest.fn().mockResolvedValue(asset),
      },
      fixedAssetDepreciationEntry: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'entry-1',
          fixedAssetId: 'asset-1',
          fiscalYear: 2026,
          amount: new Prisma.Decimal('120.00'),
          accumulatedAmount: new Prisma.Decimal('120.00'),
          bookValueAfter: new Prisma.Decimal('1080.00'),
        }),
      },
    };
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const service = new FixedAssetsService(prisma as unknown as PrismaService, auditService);

    await service.generateDepreciation(tenant, 'asset-1', 2026);

    expect(prisma.fixedAssetDepreciationEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fixedAssetId: 'asset-1',
        fiscalYear: 2026,
        amount: 120,
        accumulatedAmount: 120,
        bookValueAfter: 1080,
      }),
    });
    expect(prisma.fixedAsset.update).toHaveBeenCalledWith({
      where: { id: 'asset-1' },
      data: { accumulatedDepreciation: 120 },
    });
  });
});
