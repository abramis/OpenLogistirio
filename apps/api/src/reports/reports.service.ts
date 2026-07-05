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
      include: {
        clientCompany: {
          select: { id: true, legalName: true, vatNumber: true },
        },
      },
    });
    const months = new Map<
      string,
      {
        period: string;
        salesVat: number;
        purchasesVat: number;
        payableVat: number;
        documents: number;
      }
    >();

    for (const document of documents) {
      const period = document.issueDate.toISOString().slice(0, 7);
      const row = months.get(period) ?? {
        period,
        salesVat: 0,
        purchasesVat: 0,
        payableVat: 0,
        documents: 0,
      };
      const vat = Number(document.vatAmount);

      if (document.documentType === DocumentType.PURCHASE_INVOICE) {
        row.purchasesVat += vat;
      } else {
        row.salesVat += vat;
      }

      row.payableVat = roundMoney(row.salesVat - row.purchasesVat);
      row.documents += 1;
      months.set(period, row);
    }

    return [...months.values()].sort((a, b) => a.period.localeCompare(b.period));
  }
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
