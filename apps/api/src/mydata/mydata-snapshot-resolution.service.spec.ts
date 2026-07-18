import {
  CounterpartyType,
  DocumentType,
  MyDataReconciliationStatus,
  MyDataSnapshotReviewStatus,
  MyDataSyncSource,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { AadeMyDataTestProvider } from './aade-mydata-test.provider';
import { MockMyDataProvider } from './mydata-mock.service';
import { MyDataMappingService } from './mydata-mapping.service';
import { MyDataService } from './mydata.service';
import { MyDataXmlValidationService } from './mydata-xml-validation.service';

const tenant: TenantContext = { accountingOfficeId: 'office-1', userId: 'user-1' };
const snapshot = {
  id: 'snapshot-1',
  accountingOfficeId: 'office-1',
  clientCompanyId: 'company-1',
  syncRunId: 'run-1',
  matchedDocumentId: null,
  source: MyDataSyncSource.REQUEST_DOCS,
  reconciliationStatus: MyDataReconciliationStatus.MISSING_INTERNAL,
  reconciliationIssues: { missing: ['internalDocument'] },
  reviewStatus: MyDataSnapshotReviewStatus.PENDING,
  reviewedById: null,
  reviewedAt: null,
  reviewNotes: null,
  mark: '4000012345',
  uid: 'uid-1',
  qrUrl: null,
  issuerVatNumber: '123456789',
  counterpartyVatNumber: '999888777',
  invoiceType: '1.1',
  series: 'A',
  documentNumber: '42',
  issueDate: new Date('2026-07-15T00:00:00.000Z'),
  netAmount: new Prisma.Decimal(100),
  vatAmount: new Prisma.Decimal(24),
  totalAmount: new Prisma.Decimal(124),
  rawPayload: {
    issuer: { vatNumber: '123456789', country: 'GR' },
    invoiceDetails: {
      lineNumber: 1,
      itemDescr: 'Επαγγελματική υπηρεσία',
      netValue: 100,
      vatCategory: 1,
      vatAmount: 24,
    },
    paymentMethods: { paymentMethodDetails: { type: 3, amount: 124 } },
  },
  fetchedAt: new Date(),
};

describe('MyDataService snapshot resolution', () => {
  function setup(overrides: { duplicate?: object | null; sourceSnapshot?: typeof snapshot } = {}) {
    const sourceSnapshot = overrides.sourceSnapshot ?? snapshot;
    const tx = {
      counterparty: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'supplier-1',
          name: 'Προμηθευτής ΑΦΜ 123456789',
          type: CounterpartyType.SUPPLIER,
        }),
        update: jest.fn(),
      },
      document: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'document-1', documentType: data.documentType, ...data }),
        ),
        update: jest.fn(),
      },
      myDataSnapshot: { update: jest.fn().mockResolvedValue({ id: 'snapshot-1' }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma = {
      myDataSnapshot: {
        findFirst: jest.fn().mockResolvedValue(sourceSnapshot),
        update: jest.fn(),
      },
      document: {
        findFirst: jest.fn().mockResolvedValue(overrides.duplicate ?? null),
        findMany: jest.fn(),
      },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new MyDataService(
      prisma as unknown as PrismaService,
      new MyDataMappingService(),
      { providerName: 'mock-mydata' } as MockMyDataProvider,
      { providerName: 'aade-mydata' } as AadeMyDataTestProvider,
      new MyDataXmlValidationService(),
    );
    return { service, prisma, tx };
  }

  it('creates a duplicate-safe purchase invoice and supplier from an incoming AADE snapshot', async () => {
    const { service, tx } = setup();

    const result = await service.createPurchaseFromSnapshot(tenant, 'snapshot-1');

    expect(result.document).toEqual(
      expect.objectContaining({
        documentType: DocumentType.PURCHASE_INVOICE,
        myDataMark: '4000012345',
        netAmount: new Prisma.Decimal(100),
        vatAmount: new Prisma.Decimal(24),
        totalAmount: 124,
      }),
    );
    expect(tx.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        movementCode: 'PURCHASE_INVOICE',
        journalCode: 'PURCHASES',
        classificationStatus: 'AADE_RECEIVED_PENDING_CLASSIFICATION',
        lines: {
          create: [
            expect.objectContaining({
              description: 'Επαγγελματική υπηρεσία',
              netAmount: 100,
              vatAmount: 24,
              vatCategory: 'VAT_24',
            }),
          ],
        },
      }),
      include: expect.any(Object),
    });
    expect(tx.myDataSnapshot.update).toHaveBeenCalledWith({
      where: { id: 'snapshot-1' },
      data: expect.objectContaining({
        matchedDocumentId: 'document-1',
        reconciliationStatus: MyDataReconciliationStatus.MATCHED,
        reviewStatus: MyDataSnapshotReviewStatus.RESOLVED,
        reviewedById: 'user-1',
      }),
    });
    expect(tx.auditLog.create).toHaveBeenCalled();
  });

  it('refuses automatic creation when a possible duplicate already exists', async () => {
    const { service, prisma } = setup({
      duplicate: { id: 'existing-1', series: 'A', documentNumber: '42' },
    });

    await expect(service.createPurchaseFromSnapshot(tenant, 'snapshot-1')).rejects.toThrow(
      'possible duplicate',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses automatic creation when AADE line totals do not match the summary', async () => {
    const inconsistent = {
      ...snapshot,
      rawPayload: {
        ...snapshot.rawPayload,
        invoiceDetails: {
          lineNumber: 1,
          itemDescr: 'Επαγγελματική υπηρεσία',
          netValue: 90,
          vatCategory: 1,
          vatAmount: 21.6,
        },
      },
    };
    const { service, prisma } = setup({ sourceSnapshot: inconsistent });

    await expect(service.createPurchaseFromSnapshot(tenant, 'snapshot-1')).rejects.toThrow(
      'total does not equal',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
