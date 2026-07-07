import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { FindAuditLogsQueryDto } from './dto/find-audit-logs-query.dto';

interface AuditEntryInput {
  tenant: TenantContext;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenant: TenantContext, query: FindAuditLogsQueryDto = {}) {
    return this.prisma.auditLog.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        action: query.action,
        entityType: query.entityType,
        entityId: query.entityId,
        userId: query.userId,
        createdAt:
          query.dateFrom || query.dateTo
            ? {
                gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
                lte: query.dateTo ? new Date(query.dateTo) : undefined,
              }
            : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: query.take ?? 100,
    });
  }

  async record(input: AuditEntryInput) {
    await this.prisma.auditLog.create({
      data: {
        accountingOfficeId: input.tenant.accountingOfficeId,
        userId: input.tenant.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        oldValue: input.oldValue ?? Prisma.JsonNull,
        newValue: input.newValue ?? Prisma.JsonNull,
      },
    });
  }
}
