import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DeclarationWorkpaperStatus,
  DeclarationWorkpaperType,
  DocumentType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { GenerateVatWorkpaperDto } from './dto/generate-vat-workpaper.dto';

@Injectable()
export class DeclarationsService {
  constructor(private readonly prisma: PrismaService) {}

  findWorkpapers(tenant: TenantContext, clientCompanyId?: string) {
    return this.prisma.declarationWorkpaper.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId,
      },
      include: {
        clientCompany: {
          select: { id: true, legalName: true, vatNumber: true },
        },
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { generatedAt: 'desc' }],
    });
  }

  async generateVatWorkpaper(tenant: TenantContext, dto: GenerateVatWorkpaperDto) {
    const company = await this.prisma.clientCompany.findFirst({
      where: {
        id: dto.clientCompanyId,
        accountingOfficeId: tenant.accountingOfficeId,
        deletedAt: null,
      },
    });

    if (!company) {
      throw new NotFoundException('Client company was not found.');
    }

    const documents = await this.prisma.document.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: dto.clientCompanyId,
        deletedAt: null,
        issueDate: toPeriodDateFilter(dto.year, dto.month),
      },
    });
    const totals = toVatTotals(documents);
    const title = dto.month
      ? `Workpaper ΦΠΑ ${String(dto.month).padStart(2, '0')}/${dto.year}`
      : `Workpaper ΦΠΑ ${dto.year}`;

    const existing = await this.prisma.declarationWorkpaper.findFirst({
      where: {
        clientCompanyId: dto.clientCompanyId,
        type: DeclarationWorkpaperType.VAT_RETURN,
        periodYear: dto.year,
        periodMonth: dto.month ?? null,
      },
    });

    if (existing) {
      return this.prisma.declarationWorkpaper.update({
        where: { id: existing.id },
        data: {
          title,
          totals,
          status: DeclarationWorkpaperStatus.DRAFT,
          generatedAt: new Date(),
        },
      });
    }

    return this.prisma.declarationWorkpaper.create({
      data: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: dto.clientCompanyId,
        type: DeclarationWorkpaperType.VAT_RETURN,
        title,
        periodYear: dto.year,
        periodMonth: dto.month,
        totals,
      },
    });
  }
}

function toPeriodDateFilter(year: number, month?: number): Prisma.DateTimeFilter {
  if (month) {
    return {
      gte: new Date(Date.UTC(year, month - 1, 1)),
      lt: new Date(Date.UTC(year, month, 1)),
    };
  }

  return {
    gte: new Date(Date.UTC(year, 0, 1)),
    lt: new Date(Date.UTC(year + 1, 0, 1)),
  };
}

function toVatTotals(
  documents: Array<{
    documentType: DocumentType;
    netAmount: Prisma.Decimal;
    vatAmount: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    myDataStatus: string;
  }>,
): Prisma.InputJsonValue {
  const totals = {
    salesNet: 0,
    salesVat: 0,
    purchasesNet: 0,
    purchasesVat: 0,
    payableVat: 0,
    documentCount: documents.length,
    failedMyData: documents.filter((document) => document.myDataStatus === 'FAILED').length,
  };

  for (const document of documents) {
    const net = Number(document.netAmount);
    const vat = Number(document.vatAmount);

    if (document.documentType === DocumentType.PURCHASE_INVOICE) {
      totals.purchasesNet += net;
      totals.purchasesVat += vat;
    } else {
      totals.salesNet += net;
      totals.salesVat += vat;
    }
  }

  totals.payableVat = roundMoney(totals.salesVat - totals.purchasesVat);
  totals.salesNet = roundMoney(totals.salesNet);
  totals.salesVat = roundMoney(totals.salesVat);
  totals.purchasesNet = roundMoney(totals.purchasesNet);
  totals.purchasesVat = roundMoney(totals.purchasesVat);

  return totals;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
