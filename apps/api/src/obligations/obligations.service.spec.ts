import {
  ClientEntityType,
  MyDataTransmissionMode,
  ObligationRecurrence,
  ObligationType,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { ObligationsService } from './obligations.service';

const tenant: TenantContext = {
  accountingOfficeId: 'office-1',
  userId: 'user-1',
};

function company(id: string, accountingCategory: string) {
  return {
    id,
    accountingOfficeId: 'office-1',
    legalName: `Company ${id}`,
    tradeName: null,
    entityType: ClientEntityType.COMPANY,
    professionLabel: null,
    vatNumber: id === 'company-1' ? '111222333' : '444555666',
    taxOffice: null,
    activityCodes: null,
    address: null,
    email: null,
    phone: null,
    vatRegime: 'NORMAL',
    accountingCategory,
    myDataMode: MyDataTransmissionMode.ACCOUNTING_OFFICE_AUTHORIZED,
    myDataAuthorized: true,
    myDataCredentialRef: null,
    fiscalYearStart: 1,
    fiscalYearEnd: 12,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
  };
}

describe('ObligationsService', () => {
  it('generates monthly myDATA obligations and VAT based on books category', async () => {
    const prisma = {
      clientCompany: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            company('company-1', 'SIMPLE_BOOKS'),
            company('company-2', 'DOUBLE_ENTRY'),
          ]),
      },
      officeObligation: {
        upsert: jest.fn().mockImplementation(({ create }) =>
          Promise.resolve({
            id: `${create.clientCompanyId}-${create.type}`,
            ...create,
          }),
        ),
      },
    };
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const service = new ObligationsService(prisma as unknown as PrismaService, auditService);

    const result = await service.generateMonthly(tenant, { year: 2026, month: 7 });

    expect(result.generated).toBe(3);
    expect(prisma.officeObligation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          clientCompanyId: 'company-1',
          type: ObligationType.MYDATA_REVIEW,
          recurrence: ObligationRecurrence.MONTHLY,
        }),
      }),
    );
    expect(prisma.officeObligation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          clientCompanyId: 'company-2',
          type: ObligationType.VAT_RETURN,
          recurrence: ObligationRecurrence.MONTHLY,
        }),
      }),
    );
  });
});
