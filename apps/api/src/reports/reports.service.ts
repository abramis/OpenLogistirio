import { Injectable } from '@nestjs/common';
import { DocumentType, MyDataStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async officeSummary(tenant: TenantContext) {
    const [clients, documents, obligations, fixedAssets, failedMyData] = await Promise.all([
      this.prisma.clientCompany.count({
        where: { accountingOfficeId: tenant.accountingOfficeId, deletedAt: null },
      }),
      this.prisma.document.count({
        where: { accountingOfficeId: tenant.accountingOfficeId, deletedAt: null },
      }),
      this.prisma.officeObligation.count({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_CLIENT', 'READY_TO_SUBMIT'] },
        },
      }),
      this.prisma.fixedAsset.count({
        where: { accountingOfficeId: tenant.accountingOfficeId, status: 'ACTIVE' },
      }),
      this.prisma.document.count({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          deletedAt: null,
          myDataStatus: MyDataStatus.FAILED,
        },
      }),
    ]);

    return {
      clients,
      documents,
      openObligations: obligations,
      activeFixedAssets: fixedAssets,
      failedMyData,
    };
  }

  async vatSummary(tenant: TenantContext, year: number, clientCompanyId?: string) {
    const documents = await this.prisma.document.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId,
        deletedAt: null,
        issueDate: {
          gte: new Date(Date.UTC(year, 0, 1)),
          lt: new Date(Date.UTC(year + 1, 0, 1)),
        },
      },
    });
    const months = new Map<string, VatSummaryRow>();

    for (const document of documents) {
      const period = document.issueDate.toISOString().slice(0, 7);
      const row = months.get(period) ?? createVatSummaryRow(period);
      const sign = document.documentType === DocumentType.CREDIT_NOTE ? -1 : 1;
      const net = roundMoney(Number(document.netAmount) * sign);
      const vat = roundMoney(Number(document.vatAmount) * sign);

      if (isPurchaseDocument(document)) {
        row.purchasesNet += net;
        row.purchasesVat += vat;
      } else {
        row.salesNet += net;
        row.salesVat += vat;
      }

      row.payableVat = roundMoney(row.salesVat - row.purchasesVat);
      row.documents += 1;
      if (document.myDataStatus === MyDataStatus.FAILED) {
        row.failedMyData += 1;
      }
      months.set(period, row);
    }

    return [...months.values()]
      .map((row) => ({
        ...row,
        salesNet: roundMoney(row.salesNet),
        salesVat: roundMoney(row.salesVat),
        purchasesNet: roundMoney(row.purchasesNet),
        purchasesVat: roundMoney(row.purchasesVat),
        payableVat: roundMoney(row.payableVat),
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }
}

interface VatSummaryRow {
  period: string;
  salesNet: number;
  salesVat: number;
  purchasesNet: number;
  purchasesVat: number;
  payableVat: number;
  documents: number;
  failedMyData: number;
}

function createVatSummaryRow(period: string): VatSummaryRow {
  return {
    period,
    salesNet: 0,
    salesVat: 0,
    purchasesNet: 0,
    purchasesVat: 0,
    payableVat: 0,
    documents: 0,
    failedMyData: 0,
  };
}

function isPurchaseDocument(document: {
  documentType: DocumentType;
  movementCode?: string | null;
}): boolean {
  return (
    document.documentType === DocumentType.PURCHASE_INVOICE ||
    document.movementCode === 'PURCHASE_INVOICE'
  );
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
