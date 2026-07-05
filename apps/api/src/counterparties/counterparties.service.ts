import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Counterparty, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { CreateCounterpartyDto } from './dto/create-counterparty.dto';
import { FindCounterpartiesQueryDto } from './dto/find-counterparties-query.dto';
import { UpdateCounterpartyDto } from './dto/update-counterparty.dto';

@Injectable()
export class CounterpartiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(tenant: TenantContext, query: FindCounterpartiesQueryDto = {}) {
    return this.prisma.counterparty.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: query.clientCompanyId,
        type: query.type,
        deletedAt: null,
        OR: query.search
          ? [
              { name: { contains: query.search } },
              { vatNumber: { contains: query.search } },
              { email: { contains: query.search } },
            ]
          : undefined,
      },
      include: {
        clientCompany: {
          select: { id: true, legalName: true, vatNumber: true },
        },
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  async create(tenant: TenantContext, dto: CreateCounterpartyDto) {
    await this.ensureTenantCompany(tenant, dto.clientCompanyId);

    const counterparty = await this.prisma.counterparty.create({
      data: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: dto.clientCompanyId,
        type: dto.type,
        name: dto.name,
        vatNumber: dto.vatNumber,
        country: dto.country ?? 'GR',
        taxOffice: dto.taxOffice,
        address: dto.address,
        email: dto.email,
        phone: dto.phone,
        notes: dto.notes,
      },
    });

    await this.auditService.record({
      tenant,
      action: AuditAction.CREATE,
      entityType: 'Counterparty',
      entityId: counterparty.id,
      newValue: this.toAuditJson(counterparty),
    });

    return counterparty;
  }

  async update(tenant: TenantContext, id: string, dto: UpdateCounterpartyDto) {
    const existing = await this.getTenantCounterparty(tenant, id);

    if (dto.clientCompanyId) {
      await this.ensureTenantCompany(tenant, dto.clientCompanyId);
    }

    const updated = await this.prisma.counterparty.update({
      where: { id: existing.id },
      data: dto,
    });

    await this.auditService.record({
      tenant,
      action: AuditAction.UPDATE,
      entityType: 'Counterparty',
      entityId: updated.id,
      oldValue: this.toAuditJson(existing),
      newValue: this.toAuditJson(updated),
    });

    return updated;
  }

  async softDelete(tenant: TenantContext, id: string): Promise<void> {
    const existing = await this.getTenantCounterparty(tenant, id);
    const deleted = await this.prisma.counterparty.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.record({
      tenant,
      action: AuditAction.DELETE,
      entityType: 'Counterparty',
      entityId: deleted.id,
      oldValue: this.toAuditJson(existing),
      newValue: this.toAuditJson(deleted),
    });
  }

  private async getTenantCounterparty(tenant: TenantContext, id: string) {
    const counterparty = await this.prisma.counterparty.findFirst({
      where: {
        id,
        accountingOfficeId: tenant.accountingOfficeId,
        deletedAt: null,
      },
    });

    if (!counterparty) {
      throw new NotFoundException('Counterparty was not found.');
    }

    return counterparty;
  }

  private async ensureTenantCompany(tenant: TenantContext, clientCompanyId: string) {
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

  private toAuditJson(counterparty: Counterparty): Prisma.InputJsonValue {
    return {
      id: counterparty.id,
      accountingOfficeId: counterparty.accountingOfficeId,
      clientCompanyId: counterparty.clientCompanyId,
      type: counterparty.type,
      name: counterparty.name,
      vatNumber: counterparty.vatNumber,
      country: counterparty.country,
      email: counterparty.email,
      phone: counterparty.phone,
      deletedAt: counterparty.deletedAt?.toISOString() ?? null,
    };
  }
}
