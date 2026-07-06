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

interface VatBreakdownRow {
  vatCategory: string;
  salesNet: number;
  salesVat: number;
  purchasesNet: number;
  purchasesVat: number;
  payableVat: number;
  documents: number;
}

interface DocumentTypeBreakdownRow {
  documentType: string;
  net: number;
  vat: number;
  total: number;
  documents: number;
}

function toVatTotals(
  documents: Array<{
    documentType: DocumentType;
    movementCode?: string | null;
    vatCategory: string;
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
    vatBreakdown: [] as VatBreakdownRow[],
    documentTypeBreakdown: [] as DocumentTypeBreakdownRow[],
  };
  const vatBreakdown = new Map<string, (typeof totals.vatBreakdown)[number]>();
  const documentTypeBreakdown = new Map<string, (typeof totals.documentTypeBreakdown)[number]>();

  for (const document of documents) {
    const sign = document.documentType === DocumentType.CREDIT_NOTE ? -1 : 1;
    const net = roundMoney(Number(document.netAmount) * sign);
    const vat = roundMoney(Number(document.vatAmount) * sign);
    const total = roundMoney(Number(document.totalAmount) * sign);
    const vatRow = getVatBreakdownRow(vatBreakdown, document.vatCategory);
    const typeRow = getDocumentTypeBreakdownRow(documentTypeBreakdown, document.documentType);

    if (isPurchaseDocument(document)) {
      totals.purchasesNet += net;
      totals.purchasesVat += vat;
      vatRow.purchasesNet += net;
      vatRow.purchasesVat += vat;
    } else {
      totals.salesNet += net;
      totals.salesVat += vat;
      vatRow.salesNet += net;
      vatRow.salesVat += vat;
    }

    vatRow.payableVat = roundMoney(vatRow.salesVat - vatRow.purchasesVat);
    vatRow.documents += 1;
    typeRow.net += net;
    typeRow.vat += vat;
    typeRow.total += total;
    typeRow.documents += 1;
  }

  totals.payableVat = roundMoney(totals.salesVat - totals.purchasesVat);
  totals.salesNet = roundMoney(totals.salesNet);
  totals.salesVat = roundMoney(totals.salesVat);
  totals.purchasesNet = roundMoney(totals.purchasesNet);
  totals.purchasesVat = roundMoney(totals.purchasesVat);
  totals.vatBreakdown = [...vatBreakdown.values()].map((row) => ({
    ...row,
    salesNet: roundMoney(row.salesNet),
    salesVat: roundMoney(row.salesVat),
    purchasesNet: roundMoney(row.purchasesNet),
    purchasesVat: roundMoney(row.purchasesVat),
    payableVat: roundMoney(row.payableVat),
  }));
  totals.documentTypeBreakdown = [...documentTypeBreakdown.values()].map((row) => ({
    ...row,
    net: roundMoney(row.net),
    vat: roundMoney(row.vat),
    total: roundMoney(row.total),
  }));

  return totals as unknown as Prisma.InputJsonValue;
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

function getVatBreakdownRow(rows: Map<string, VatBreakdownRow>, vatCategory: string) {
  const existing = rows.get(vatCategory);
  if (existing) {
    return existing;
  }

  const row = {
    vatCategory,
    salesNet: 0,
    salesVat: 0,
    purchasesNet: 0,
    purchasesVat: 0,
    payableVat: 0,
    documents: 0,
  };
  rows.set(vatCategory, row);
  return row;
}

function getDocumentTypeBreakdownRow(
  rows: Map<string, DocumentTypeBreakdownRow>,
  documentType: DocumentType,
) {
  const existing = rows.get(documentType);
  if (existing) {
    return existing;
  }

  const row = {
    documentType,
    net: 0,
    vat: 0,
    total: 0,
    documents: 0,
  };
  rows.set(documentType, row);
  return row;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
