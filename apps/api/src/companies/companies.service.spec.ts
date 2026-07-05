import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditAction, ClientEntityType, MyDataTransmissionMode } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { CompaniesService } from './companies.service';
import { VatNumberValidatorService } from './vat-number-validator.service';

const tenant: TenantContext = {
  accountingOfficeId: 'office-1',
  userId: 'user-1',
};

const company = {
  id: 'company-1',
  accountingOfficeId: 'office-1',
  legalName: 'Demo Company',
  tradeName: null,
  entityType: ClientEntityType.COMPANY,
  professionLabel: null,
  vatNumber: '123456789',
  taxOffice: 'Α Αθηνών',
  activityCodes: ['69200000'],
  address: null,
  email: null,
  phone: null,
  vatRegime: 'NORMAL',
  accountingCategory: 'SIMPLE_BOOKS',
  myDataMode: MyDataTransmissionMode.ACCOUNTING_OFFICE_AUTHORIZED,
  myDataAuthorized: true,
  myDataCredentialRef: null,
  fiscalYearStart: 1,
  fiscalYearEnd: 12,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null,
};

describe('CompaniesService', () => {
  let prisma: {
    clientCompany: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let auditService: jest.Mocked<AuditService>;
  let vatValidator: jest.Mocked<VatNumberValidatorService>;
  let service: CompaniesService;

  beforeEach(() => {
    prisma = {
      clientCompany: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    vatValidator = {
      isValidGreekVatNumber: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<VatNumberValidatorService>;

    service = new CompaniesService(prisma as unknown as PrismaService, auditService, vatValidator);
  });

  it('lists companies only for the current accounting office', async () => {
    prisma.clientCompany.findMany.mockResolvedValue([company]);

    const result = await service.findAll(tenant);

    expect(result).toEqual([company]);
    expect(prisma.clientCompany.findMany).toHaveBeenCalledWith({
      where: {
        accountingOfficeId: 'office-1',
        deletedAt: null,
      },
      orderBy: [{ legalName: 'asc' }],
    });
  });

  it('creates a company and records an audit entry', async () => {
    prisma.clientCompany.create.mockResolvedValue(company);

    const result = await service.create(tenant, {
      legalName: 'Demo Company',
      vatNumber: '123456789',
    });

    expect(result).toEqual(company);
    expect(vatValidator.isValidGreekVatNumber).toHaveBeenCalledWith('123456789');
    expect(prisma.clientCompany.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountingOfficeId: 'office-1',
        legalName: 'Demo Company',
        vatNumber: '123456789',
        entityType: undefined,
        myDataMode: undefined,
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant,
        action: AuditAction.CREATE,
        entityType: 'ClientCompany',
        entityId: 'company-1',
      }),
    );
  });

  it('rejects invalid Greek VAT numbers', async () => {
    vatValidator.isValidGreekVatNumber.mockReturnValue(false);

    await expect(
      service.create(tenant, {
        legalName: 'Demo Company',
        vatNumber: '123',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns not found when a company is outside the current office', async () => {
    prisma.clientCompany.findFirst.mockResolvedValue(null);

    await expect(service.findOne(tenant, 'company-2')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.clientCompany.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'company-2',
        accountingOfficeId: 'office-1',
        deletedAt: null,
      },
    });
  });

  it('soft deletes a company and records an audit entry', async () => {
    const deletedCompany = { ...company, deletedAt: new Date('2026-01-02T00:00:00.000Z') };
    prisma.clientCompany.findFirst.mockResolvedValue(company);
    prisma.clientCompany.update.mockResolvedValue(deletedCompany);

    await service.softDelete(tenant, 'company-1');

    expect(prisma.clientCompany.update).toHaveBeenCalledWith({
      where: { id: 'company-1' },
      data: { deletedAt: expect.any(Date) },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant,
        action: AuditAction.DELETE,
        entityId: 'company-1',
      }),
    );
  });
});
