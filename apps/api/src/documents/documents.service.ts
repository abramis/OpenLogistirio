import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
}
