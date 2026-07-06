import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { CreateDocumentDto } from './dto/create-document.dto';
import { FindDocumentsQueryDto } from './dto/find-documents-query.dto';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenant: TenantContext, query: FindDocumentsQueryDto = {}) {
    return this.prisma.document.findMany({
      where: this.toWhereInput(tenant, query),
      include: {
        clientCompany: {
          select: {
            id: true,
            legalName: true,
            vatNumber: true,
            entityType: true,
            myDataMode: true,
            myDataAuthorized: true,
          },
        },
      },
      orderBy: [{ issueDate: 'desc' }, { documentNumber: 'desc' }],
    });
  }

  async create(tenant: TenantContext, dto: CreateDocumentDto) {
    const clientCompany = await this.prisma.clientCompany.findFirst({
      where: {
        id: dto.clientCompanyId,
        accountingOfficeId: tenant.accountingOfficeId,
        deletedAt: null,
      },
    });

    if (!clientCompany) {
      throw new NotFoundException('Client company was not found.');
    }

    const expectedTotal = Number((dto.netAmount + dto.vatAmount).toFixed(2));
    if (Number(dto.totalAmount.toFixed(2)) !== expectedTotal) {
      throw new BadRequestException('Total amount must equal net amount plus VAT amount.');
    }

    const setupCodes = await this.resolveSetupCodes(tenant, dto);

    return this.prisma.document.create({
      data: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: dto.clientCompanyId,
        documentType: dto.documentType,
        series: dto.series,
        documentNumber: dto.documentNumber,
        issueDate: new Date(dto.issueDate),
        counterpartyName: dto.counterpartyName,
        counterpartyVatNumber: dto.counterpartyVatNumber,
        movementCode: setupCodes.movementCode,
        journalCode: setupCodes.journalCode,
        netAmount: dto.netAmount,
        vatAmount: dto.vatAmount,
        totalAmount: dto.totalAmount,
        vatCategory: dto.vatCategory,
      },
      include: {
        clientCompany: {
          select: {
            id: true,
            legalName: true,
            vatNumber: true,
            entityType: true,
            myDataMode: true,
            myDataAuthorized: true,
          },
        },
      },
    });
  }

  private toWhereInput(tenant: TenantContext, query: FindDocumentsQueryDto) {
    const where = {
      accountingOfficeId: tenant.accountingOfficeId,
      deletedAt: null,
      clientCompanyId: query.clientCompanyId,
      documentType: query.documentType,
      myDataStatus: query.myDataStatus,
      movementCode: query.movementCode,
      journalCode: query.journalCode,
      issueDate:
        query.dateFrom || query.dateTo
          ? {
              gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
              lte: query.dateTo ? new Date(query.dateTo) : undefined,
            }
          : undefined,
      OR: query.search
        ? [
            { documentNumber: { contains: query.search } },
            { series: { contains: query.search } },
            { counterpartyName: { contains: query.search } },
            { counterpartyVatNumber: { contains: query.search } },
          ]
        : undefined,
    };

    return where;
  }

  private async resolveSetupCodes(tenant: TenantContext, dto: CreateDocumentDto) {
    const movementCode = dto.movementCode ?? defaultMovementCode(dto.documentType);
    const journalCode = dto.journalCode ?? defaultJournalCode(dto.documentType);

    return {
      movementCode: movementCode
        ? await this.resolveClientSetupCode(
            tenant,
            dto.clientCompanyId,
            'MOVEMENT_CODE',
            movementCode,
          )
        : undefined,
      journalCode: journalCode
        ? await this.resolveClientSetupCode(tenant, dto.clientCompanyId, 'JOURNAL', journalCode)
        : undefined,
    };
  }

  private async resolveClientSetupCode(
    tenant: TenantContext,
    clientCompanyId: string,
    kind: string,
    code: string,
  ): Promise<string | undefined> {
    const setupItem = await this.prisma.clientSetupItem.findFirst({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId,
        kind,
        code,
      },
    });

    if (setupItem) {
      return setupItem.code;
    }

    if (isBuiltInFallbackSetupCode(kind, code)) {
      return code;
    }

    throw new BadRequestException(`${kind} ${code} is not configured for this client.`);
  }
}

function defaultMovementCode(documentType: DocumentType): string | undefined {
  const defaults: Record<DocumentType, string> = {
    SALES_INVOICE: 'SALE_INVOICE',
    PURCHASE_INVOICE: 'PURCHASE_INVOICE',
    CREDIT_NOTE: 'CREDIT_NOTE',
    RETAIL_RECEIPT: 'SALE_INVOICE',
  };

  return defaults[documentType];
}

function defaultJournalCode(documentType: DocumentType): string | undefined {
  const defaults: Record<DocumentType, string> = {
    SALES_INVOICE: 'SALES',
    PURCHASE_INVOICE: 'PURCHASES',
    CREDIT_NOTE: 'SALES',
    RETAIL_RECEIPT: 'SALES',
  };

  return defaults[documentType];
}

function isBuiltInFallbackSetupCode(kind: string, code: string): boolean {
  if (kind === 'MOVEMENT_CODE') {
    return ['SALE_INVOICE', 'PURCHASE_INVOICE', 'CREDIT_NOTE'].includes(code);
  }

  if (kind === 'JOURNAL') {
    return ['SALES', 'PURCHASES', 'CASH_BANK'].includes(code);
  }

  return false;
}
