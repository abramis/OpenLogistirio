import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, FixedAsset, FixedAssetStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { CreateFixedAssetDto } from './dto/create-fixed-asset.dto';
import { FindFixedAssetsQueryDto } from './dto/find-fixed-assets-query.dto';
import { UpdateFixedAssetDto } from './dto/update-fixed-asset.dto';

@Injectable()
export class FixedAssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(tenant: TenantContext, query: FindFixedAssetsQueryDto = {}) {
    return this.prisma.fixedAsset.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: query.clientCompanyId,
        category: query.category,
        status: query.status,
      },
      include: {
        clientCompany: {
          select: {
            id: true,
            legalName: true,
            vatNumber: true,
          },
        },
        depreciationEntries: {
          orderBy: { fiscalYear: 'desc' },
          take: 3,
        },
      },
      orderBy: [{ acquisitionDate: 'desc' }, { code: 'asc' }],
    });
  }

  async findOne(tenant: TenantContext, id: string) {
    const asset = await this.prisma.fixedAsset.findFirst({
      where: {
        id,
        accountingOfficeId: tenant.accountingOfficeId,
      },
      include: {
        clientCompany: {
          select: {
            id: true,
            legalName: true,
            vatNumber: true,
          },
        },
        depreciationEntries: {
          orderBy: { fiscalYear: 'desc' },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException('Fixed asset was not found.');
    }

    return asset;
  }

  async create(tenant: TenantContext, dto: CreateFixedAssetDto) {
    await this.ensureTenantCompany(tenant, dto.clientCompanyId);
    this.ensureValidAmounts(dto.netValue, dto.vatAmount, dto.totalValue);

    const asset = await this.prisma.fixedAsset.create({
      data: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: dto.clientCompanyId,
        code: dto.code,
        description: dto.description,
        category: dto.category,
        acquisitionDate: new Date(dto.acquisitionDate),
        depreciationStartDate: new Date(dto.depreciationStartDate ?? dto.acquisitionDate),
        acquisitionDocumentNumber: dto.acquisitionDocumentNumber,
        supplierName: dto.supplierName,
        netValue: dto.netValue,
        vatAmount: dto.vatAmount,
        totalValue: dto.totalValue,
        depreciationRate: dto.depreciationRate,
        notes: dto.notes,
      },
    });

    await this.auditService.record({
      tenant,
      action: AuditAction.CREATE,
      entityType: 'FixedAsset',
      entityId: asset.id,
      newValue: this.toAuditJson(asset),
    });

    return this.findOne(tenant, asset.id);
  }

  async update(tenant: TenantContext, id: string, dto: UpdateFixedAssetDto) {
    const existing = await this.findOne(tenant, id);

    if (dto.clientCompanyId) {
      await this.ensureTenantCompany(tenant, dto.clientCompanyId);
    }

    if (dto.netValue !== undefined || dto.vatAmount !== undefined || dto.totalValue !== undefined) {
      this.ensureValidAmounts(
        dto.netValue ?? Number(existing.netValue),
        dto.vatAmount ?? Number(existing.vatAmount),
        dto.totalValue ?? Number(existing.totalValue),
      );
    }

    const updated = await this.prisma.fixedAsset.update({
      where: { id: existing.id },
      data: {
        clientCompanyId: dto.clientCompanyId,
        code: dto.code,
        description: dto.description,
        category: dto.category,
        acquisitionDate: dto.acquisitionDate ? new Date(dto.acquisitionDate) : undefined,
        depreciationStartDate: dto.depreciationStartDate
          ? new Date(dto.depreciationStartDate)
          : undefined,
        acquisitionDocumentNumber: dto.acquisitionDocumentNumber,
        supplierName: dto.supplierName,
        netValue: dto.netValue,
        vatAmount: dto.vatAmount,
        totalValue: dto.totalValue,
        depreciationRate: dto.depreciationRate,
        notes: dto.notes,
      },
    });

    await this.auditService.record({
      tenant,
      action: AuditAction.UPDATE,
      entityType: 'FixedAsset',
      entityId: updated.id,
      oldValue: this.toAuditJson(existing),
      newValue: this.toAuditJson(updated),
    });

    return this.findOne(tenant, updated.id);
  }

  async generateDepreciation(tenant: TenantContext, id: string, fiscalYear: number) {
    if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2200) {
      throw new BadRequestException('Fiscal year must be a valid year.');
    }

    const asset = await this.findOne(tenant, id);
    const existingEntry = await this.prisma.fixedAssetDepreciationEntry.findUnique({
      where: {
        fixedAssetId_fiscalYear: {
          fixedAssetId: asset.id,
          fiscalYear,
        },
      },
    });

    if (existingEntry) {
      return existingEntry;
    }

    if (asset.status !== FixedAssetStatus.ACTIVE) {
      throw new BadRequestException('Only active fixed assets can be depreciated.');
    }

    // TODO: Verify current Greek tax depreciation rules and category rates before
    // production use. This MVP uses the user-entered annual rate and prorates by
    // active months inside the fiscal year.
    const annualAmount = roundMoney(
      (Number(asset.netValue) * Number(asset.depreciationRate)) / 100,
    );
    const activeMonths = countActiveMonthsInYear(
      asset.depreciationStartDate,
      asset.disposalDate,
      fiscalYear,
    );
    const proratedAmount = roundMoney((annualAmount * activeMonths) / 12);
    const remainingBookValue = roundMoney(
      Number(asset.netValue) - Number(asset.accumulatedDepreciation),
    );
    const amount = Math.min(proratedAmount, Math.max(remainingBookValue, 0));
    const accumulatedAmount = roundMoney(Number(asset.accumulatedDepreciation) + amount);
    const bookValueAfter = roundMoney(Number(asset.netValue) - accumulatedAmount);

    const entry = await this.prisma.fixedAssetDepreciationEntry.create({
      data: {
        fixedAssetId: asset.id,
        fiscalYear,
        amount,
        accumulatedAmount,
        bookValueAfter,
      },
    });

    await this.prisma.fixedAsset.update({
      where: { id: asset.id },
      data: {
        accumulatedDepreciation: accumulatedAmount,
      },
    });

    await this.auditService.record({
      tenant,
      action: AuditAction.CREATE,
      entityType: 'FixedAssetDepreciationEntry',
      entityId: entry.id,
      newValue: {
        fixedAssetId: asset.id,
        fiscalYear,
        amount,
        accumulatedAmount,
        bookValueAfter,
      },
    });

    return entry;
  }

  private async ensureTenantCompany(tenant: TenantContext, clientCompanyId: string): Promise<void> {
    const company = await this.prisma.clientCompany.findFirst({
      where: {
        id: clientCompanyId,
        accountingOfficeId: tenant.accountingOfficeId,
        deletedAt: null,
      },
    });

    if (!company) {
      throw new NotFoundException('Client company was not found.');
    }
  }

  private ensureValidAmounts(netValue: number, vatAmount: number, totalValue: number): void {
    const expectedTotal = roundMoney(netValue + vatAmount);

    if (roundMoney(totalValue) !== expectedTotal) {
      throw new BadRequestException('Total value must equal net value plus VAT amount.');
    }
  }

  private toAuditJson(asset: FixedAsset): Prisma.InputJsonValue {
    return {
      id: asset.id,
      accountingOfficeId: asset.accountingOfficeId,
      clientCompanyId: asset.clientCompanyId,
      code: asset.code,
      description: asset.description,
      category: asset.category,
      acquisitionDate: asset.acquisitionDate.toISOString(),
      depreciationStartDate: asset.depreciationStartDate.toISOString(),
      netValue: String(asset.netValue),
      vatAmount: String(asset.vatAmount),
      totalValue: String(asset.totalValue),
      depreciationRate: String(asset.depreciationRate),
      accumulatedDepreciation: String(asset.accumulatedDepreciation),
      status: asset.status,
    };
  }
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function countActiveMonthsInYear(
  startDate: Date,
  disposalDate: Date | null,
  fiscalYear: number,
): number {
  const yearStart = new Date(Date.UTC(fiscalYear, 0, 1));
  const yearEnd = new Date(Date.UTC(fiscalYear, 11, 31));
  const effectiveStart = startDate > yearStart ? startDate : yearStart;
  const effectiveEnd = disposalDate && disposalDate < yearEnd ? disposalDate : yearEnd;

  if (effectiveEnd < effectiveStart) {
    return 0;
  }

  return effectiveEnd.getUTCMonth() - effectiveStart.getUTCMonth() + 1;
}
