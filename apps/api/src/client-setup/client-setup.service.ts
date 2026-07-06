import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ClientSetupItem, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { ApplyClientSetupTemplateDto } from './dto/apply-client-setup-template.dto';
import {
  CLIENT_SETUP_KIND_LABELS,
  CLIENT_SETUP_TEMPLATES,
  ClientSetupTemplate,
  ClientSetupTemplateItem,
} from './client-setup.templates';

@Injectable()
export class ClientSetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  listTemplates() {
    return CLIENT_SETUP_TEMPLATES.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      recommendedFor: template.recommendedFor,
      itemCount: template.items.length,
      kinds: summarizeKinds(template.items),
    }));
  }

  async findItems(tenant: TenantContext, clientCompanyId: string): Promise<ClientSetupItem[]> {
    await this.ensureTenantCompany(tenant, clientCompanyId);

    return this.prisma.clientSetupItem.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId,
      },
      orderBy: [{ kind: 'asc' }, { code: 'asc' }],
    });
  }

  async applyTemplate(
    tenant: TenantContext,
    clientCompanyId: string,
    dto: ApplyClientSetupTemplateDto,
  ) {
    await this.ensureTenantCompany(tenant, clientCompanyId);
    const template = this.findTemplate(dto.templateId);
    const includeKinds = dto.includeKinds?.map((kind) => kind.trim()).filter(Boolean);
    const items =
      includeKinds && includeKinds.length > 0
        ? template.items.filter((item) => includeKinds.includes(item.kind))
        : template.items;

    if (items.length === 0) {
      throw new BadRequestException('No setup items matched the selected template options.');
    }

    const applied = await Promise.all(
      items.map((item) =>
        this.prisma.clientSetupItem.upsert({
          where: {
            clientCompanyId_kind_code: {
              clientCompanyId,
              kind: item.kind,
              code: item.code,
            },
          },
          create: {
            accountingOfficeId: tenant.accountingOfficeId,
            clientCompanyId,
            kind: item.kind,
            code: item.code,
            name: item.name,
            description: item.description,
            metadata: toJson(item.metadata),
            sourceTemplate: template.id,
          },
          update: {
            name: item.name,
            description: item.description,
            metadata: toJson(item.metadata),
            sourceTemplate: template.id,
          },
        }),
      ),
    );

    await this.auditService.record({
      tenant,
      action: AuditAction.CREATE,
      entityType: 'ClientSetup',
      entityId: clientCompanyId,
      newValue: {
        clientCompanyId,
        templateId: template.id,
        itemCount: applied.length,
        kinds: summarizeKinds(applied),
      },
    });

    return {
      templateId: template.id,
      appliedCount: applied.length,
      items: applied,
    };
  }

  private findTemplate(templateId: string): ClientSetupTemplate {
    const template = CLIENT_SETUP_TEMPLATES.find((entry) => entry.id === templateId);
    if (!template) {
      throw new BadRequestException('Unknown client setup template.');
    }
    return template;
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
}

function summarizeKinds(items: Array<ClientSetupTemplateItem | ClientSetupItem>) {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  }

  return [...counts.entries()].map(([kind, count]) => ({
    kind,
    label: CLIENT_SETUP_KIND_LABELS[kind] ?? kind,
    count,
  }));
}

function toJson(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  return value as Prisma.InputJsonValue | undefined;
}
