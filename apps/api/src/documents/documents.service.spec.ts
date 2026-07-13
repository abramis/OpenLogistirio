import { BadRequestException } from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentsService } from './documents.service';

const tenant: TenantContext = {
  accountingOfficeId: 'office-1',
  userId: 'user-1',
};

const baseDto: CreateDocumentDto = {
  clientCompanyId: 'company-1',
  documentType: DocumentType.SALES_INVOICE,
  series: 'A',
  documentNumber: '1',
  issueDate: '2026-07-14',
  netAmount: 100,
  vatAmount: 24,
  totalAmount: 124,
  vatCategory: 'VAT_24',
};

describe('DocumentsService myDATA field validation', () => {
  let prisma: {
    clientCompany: { findFirst: jest.Mock };
    clientSetupItem: { findFirst: jest.Mock };
    document: { create: jest.Mock };
  };
  let service: DocumentsService;

  beforeEach(() => {
    prisma = {
      clientCompany: { findFirst: jest.fn().mockResolvedValue({ id: 'company-1' }) },
      clientSetupItem: {
        findFirst: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve({ code: where.code }),
        ),
      },
      document: { create: jest.fn().mockResolvedValue({ id: 'document-1' }) },
    };
    service = new DocumentsService(prisma as unknown as PrismaService);
  });

  it('stores payment, tax and correlation mapping fields', async () => {
    await service.create(tenant, {
      ...baseDto,
      documentType: DocumentType.CREDIT_NOTE,
      paymentMethodType: 5,
      correlatedInvoiceMark: '4000012345',
      withheldAmount: 20,
      withheldCategory: 3,
      feesAmount: 1,
      feesCategory: 10,
      stampDutyAmount: 1.2,
      stampDutyCategory: 1,
      otherTaxesAmount: 2,
      otherTaxesCategory: 17,
      deductionsAmount: 0.2,
      totalAmount: 108,
    });

    expect(prisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMethodType: 5,
          correlatedInvoiceMark: '4000012345',
          withheldCategory: 3,
          stampDutyCategory: 1,
          deductionsAmount: 0.2,
          totalAmount: 108,
        }),
      }),
    );
  });

  it('requires an exemption reason for zero VAT', async () => {
    await expect(
      service.create(tenant, {
        ...baseDto,
        vatCategory: 'VAT_0',
        vatAmount: 0,
        totalAmount: 100,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('requires a tax category for every positive categorized tax', async () => {
    await expect(
      service.create(tenant, {
        ...baseDto,
        feesAmount: 1,
        totalAmount: 125,
      }),
    ).rejects.toThrow('Fees category is required');
  });

  it('rejects a total that does not include taxes and deductions', async () => {
    await expect(
      service.create(tenant, {
        ...baseDto,
        withheldAmount: 20,
        withheldCategory: 3,
        totalAmount: 124,
      }),
    ).rejects.toThrow('Total amount must equal');
  });
});
