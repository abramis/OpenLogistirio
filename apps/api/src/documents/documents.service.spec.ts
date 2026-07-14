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
    clientSetupItem: { findFirst: jest.Mock; findMany: jest.Mock };
    document: { create: jest.Mock; findFirst: jest.Mock };
  };
  let service: DocumentsService;

  beforeEach(() => {
    prisma = {
      clientCompany: { findFirst: jest.fn().mockResolvedValue({ id: 'company-1' }) },
      clientSetupItem: {
        findFirst: jest
          .fn()
          .mockImplementation(({ where }) => Promise.resolve({ code: where.code })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      document: {
        create: jest.fn().mockResolvedValue({ id: 'document-1' }),
        findFirst: jest.fn(),
      },
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

  it('stores multiple payments only when they reconcile with the document total', async () => {
    await service.create(tenant, {
      ...baseDto,
      payments: [
        { type: 3, amount: 24 },
        { type: 7, amount: 100, transactionId: 'txn-1', tid: 'POS-1' },
      ],
    });

    expect(prisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMethodType: 3,
          payments: {
            create: [
              expect.objectContaining({ paymentNumber: 1, amount: 24 }),
              expect.objectContaining({ paymentNumber: 2, type: 7, transactionId: 'txn-1' }),
            ],
          },
        }),
      }),
    );
    await expect(
      service.create(tenant, { ...baseDto, payments: [{ type: 3, amount: 123 }] }),
    ).rejects.toThrow('Payment amounts must equal');
  });

  it('links a credit note to the original document and derives its AADE MARK', async () => {
    prisma.document.findFirst.mockResolvedValue({
      id: 'original-1',
      clientCompanyId: 'company-1',
      myDataStatus: 'SENT',
      myDataMark: '4000012345',
    });

    await service.create(tenant, {
      ...baseDto,
      documentType: DocumentType.CREDIT_NOTE,
      correctsDocumentId: 'original-1',
    });

    expect(prisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          correctsDocumentId: 'original-1',
          correlatedInvoiceMark: '4000012345',
        }),
      }),
    );
  });

  it('requires a cancelled original document before creating a replacement', async () => {
    prisma.document.findFirst.mockResolvedValue({
      id: 'original-1',
      clientCompanyId: 'company-1',
      myDataStatus: 'SENT',
      myDataMark: '4000012345',
    });

    await expect(
      service.create(tenant, { ...baseDto, replacesDocumentId: 'original-1' }),
    ).rejects.toThrow('replacement invoice requires a cancelled original');
  });

  it('aggregates multiple lines and persists their individual VAT mappings', async () => {
    await service.create(tenant, {
      ...baseDto,
      netAmount: 150,
      vatAmount: 30,
      totalAmount: 180,
      lines: [
        {
          description: 'Υπηρεσία 24%',
          quantity: 1,
          measurementUnit: 7,
          netAmount: 100,
          vatAmount: 24,
          vatCategory: 'VAT_24',
        },
        {
          description: 'Έντυπο 6%',
          quantity: 2,
          measurementUnit: 1,
          netAmount: 50,
          vatAmount: 6,
          vatCategory: 'VAT_6',
          incomeClassificationType: 'E3_561_001',
          incomeClassificationCategory: 'category1_1',
        },
      ],
    });

    expect(prisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          netAmount: 150,
          vatAmount: 30,
          totalAmount: 180,
          vatCategory: 'MULTIPLE',
          lines: {
            create: expect.arrayContaining([
              expect.objectContaining({ lineNumber: 1, vatCategory: 'VAT_24' }),
              expect.objectContaining({ lineNumber: 2, vatCategory: 'VAT_6' }),
            ]),
          },
        }),
      }),
    );
  });

  it('applies the most specific configured classification profile to a line', async () => {
    prisma.clientSetupItem.findMany.mockResolvedValue([
      {
        metadata: {
          documentType: 'SALES_INVOICE',
          vatCategory: 'VAT_24',
          itemCode: 'CONSULTING',
          incomeClassificationType: 'E3_561_001',
          incomeClassificationCategory: 'category1_1',
          priority: 10,
          isActive: true,
        },
      },
    ]);

    await service.create(tenant, {
      ...baseDto,
      lines: [
        {
          itemCode: 'CONSULTING',
          netAmount: 100,
          vatAmount: 24,
          vatCategory: 'VAT_24',
        },
      ],
    });

    expect(prisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lines: {
            create: [
              expect.objectContaining({
                incomeClassificationType: 'E3_561_001',
                incomeClassificationCategory: 'category1_1',
              }),
            ],
          },
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
